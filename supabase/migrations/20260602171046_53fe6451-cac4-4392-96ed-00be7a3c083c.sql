
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'player');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Teams
CREATE TABLE public.teams (
  name TEXT PRIMARY KEY,
  group_code TEXT,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key TEXT UNIQUE NOT NULL, -- natural key for upserts
  stage TEXT NOT NULL, -- 'group' | 'round-of-32' | 'round-of-16' | 'quarter-final' | 'semi-final' | 'third-place' | 'final'
  group_code TEXT,
  matchday TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  venue TEXT,
  home_team TEXT NOT NULL REFERENCES public.teams(name),
  away_team TEXT NOT NULL REFERENCES public.teams(name),
  home_score INT,
  away_score INT,
  home_score_ht INT,
  away_score_ht INT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | finished
  winner TEXT, -- home_team / away_team / 'draw' / null
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX matches_kickoff_idx ON public.matches(kickoff_at);
CREATE INDEX matches_group_idx ON public.matches(group_code);

-- Predictions
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INT NOT NULL CHECK (home_score >= 0 AND home_score <= 20),
  away_score INT NOT NULL CHECK (away_score >= 0 AND away_score <= 20),
  winner TEXT, -- for knockouts; 'home' | 'away'
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE INDEX predictions_user_idx ON public.predictions(user_id);
CREATE INDEX predictions_match_idx ON public.predictions(match_id);

-- GRANTS
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.teams TO authenticated, anon;
GRANT ALL ON public.teams TO service_role;

GRANT SELECT ON public.matches TO authenticated, anon;
GRANT ALL ON public.matches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Profiles: everyone signed in can read (leaderboard needs names)
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);

-- user_roles: signed-in users can read their own; admins read all via has_role
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- teams: public read
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT TO authenticated, anon USING (true);

-- matches: public read
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT TO authenticated, anon USING (true);

-- predictions: users see their own always; others' predictions visible only after kickoff
CREATE POLICY "predictions_select_visible" ON public.predictions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.kickoff_at <= now())
  );

CREATE POLICY "predictions_insert_own" ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.kickoff_at > now())
  );

CREATE POLICY "predictions_update_own_before_kickoff" ON public.predictions FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.kickoff_at > now())
  )
  WITH CHECK (user_id = auth.uid());

-- Auto-create profile + player role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Scoring function: recompute points for a single prediction
CREATE OR REPLACE FUNCTION public.score_prediction(
  pred_home INT, pred_away INT, actual_home INT, actual_away INT
) RETURNS INT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN actual_home IS NULL OR actual_away IS NULL THEN 0
    WHEN pred_home = actual_home AND pred_away = actual_away THEN 5
    WHEN (pred_home - pred_away) = (actual_home - actual_away)
         AND sign(pred_home - pred_away) = sign(actual_home - actual_away) THEN 3
    WHEN sign(pred_home - pred_away) = sign(actual_home - actual_away) THEN 2
    ELSE 0
  END
$$;

-- Trigger to recompute predictions when match score updates
CREATE OR REPLACE FUNCTION public.recompute_match_predictions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points = public.score_prediction(home_score, away_score, NEW.home_score, NEW.away_score),
        updated_at = now()
    WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_score_update ON public.matches;
CREATE TRIGGER on_match_score_update
  AFTER UPDATE OF home_score, away_score ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.recompute_match_predictions();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER predictions_updated_at BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

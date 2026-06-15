-- 1. Create futures_picks table
CREATE TABLE IF NOT EXISTS public.futures_picks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  winner text,
  golden_boot text,
  most_assists text,
  semi_finalists text[],
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.futures_picks TO anon, authenticated;
GRANT ALL ON public.futures_picks TO service_role;

ALTER TABLE public.futures_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY futures_picks_select_all ON public.futures_picks
  FOR SELECT TO anon, authenticated USING (true);

-- Allow users to insert/update their own unlocked futures
CREATE POLICY futures_picks_insert_own ON public.futures_picks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT locked);
CREATE POLICY futures_picks_update_own ON public.futures_picks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND NOT locked);

CREATE TRIGGER set_futures_picks_updated_at
BEFORE UPDATE ON public.futures_picks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. Create helper function for multipliers
CREATE OR REPLACE FUNCTION public.get_knockout_multiplier(stage text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN stage = 'final' THEN 5.0
    WHEN stage = 'third-place' THEN 3.0
    WHEN stage = 'semi-final' THEN 2.0
    WHEN stage = 'quarter-final' THEN 1.5
    WHEN stage = 'round-of-16' THEN 1.25
    WHEN stage = 'round-of-32' THEN 1.25
    ELSE 1.0
  END
$$;


-- 3. Replace odds scoring function to accept multiplier (or stage)
-- We will change the signature of score_pick_odds to accept the stage.
CREATE OR REPLACE FUNCTION public.score_pick_odds(
  pred_pick text,
  actual_home integer,
  actual_away integer,
  odds_1 numeric,
  odds_x numeric,
  odds_2 numeric,
  match_stage text
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN actual_home IS NULL OR actual_away IS NULL OR pred_pick IS NULL THEN 0
    WHEN pred_pick = '1' AND actual_home > actual_away THEN COALESCE(odds_1, 0) * public.get_knockout_multiplier(match_stage)
    WHEN pred_pick = 'X' AND actual_home = actual_away THEN COALESCE(odds_x, 0) * public.get_knockout_multiplier(match_stage)
    WHEN pred_pick = '2' AND actual_home < actual_away THEN COALESCE(odds_2, 0) * public.get_knockout_multiplier(match_stage)
    ELSE 0
  END
$$;

-- Note: Because we changed the signature of score_pick_odds, we must also update the functions that call it.
-- Drop old function to avoid ambiguity
DROP FUNCTION IF EXISTS public.score_pick_odds(text, integer, integer, numeric, numeric, numeric);

-- 4. Replace recompute trigger to pass stage
CREATE OR REPLACE FUNCTION public.recompute_match_predictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
BEGIN
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    SELECT odds_1, odds_x, odds_2, locked
      INTO o
      FROM public.match_odds
      WHERE match_id = NEW.id;

    IF o IS NULL OR NOT o.locked THEN
      -- Odds were never locked; award 0 to all picks for this match.
      UPDATE public.predictions
      SET points = 0,
          updated_at = now()
      WHERE match_id = NEW.id;
    ELSE
      UPDATE public.predictions
      SET points = public.score_pick_odds(pick, NEW.home_score, NEW.away_score, o.odds_1, o.odds_x, o.odds_2, NEW.stage),
          updated_at = now()
      WHERE match_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Helper: recompute a single match (used after locking odds belatedly)
CREATE OR REPLACE FUNCTION public.recompute_predictions_for_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  o RECORD;
BEGIN
  SELECT home_score, away_score, stage INTO m FROM public.matches WHERE id = _match_id;
  IF m.home_score IS NULL OR m.away_score IS NULL THEN RETURN; END IF;
  SELECT odds_1, odds_x, odds_2, locked INTO o FROM public.match_odds WHERE match_id = _match_id;
  IF o IS NULL OR NOT o.locked THEN
    UPDATE public.predictions SET points = 0, updated_at = now() WHERE match_id = _match_id;
  ELSE
    UPDATE public.predictions
    SET points = public.score_pick_odds(pick, m.home_score, m.away_score, o.odds_1, o.odds_x, o.odds_2, m.stage),
        updated_at = now()
    WHERE match_id = _match_id;
  END IF;
END;
$$;

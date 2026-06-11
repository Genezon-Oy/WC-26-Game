
-- 1. api_fixture_id on matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS api_fixture_id text;

-- 2. match_odds table
CREATE TABLE IF NOT EXISTS public.match_odds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  odds_1 numeric(6,2),
  odds_x numeric(6,2),
  odds_2 numeric(6,2),
  source text NOT NULL DEFAULT 'api-football',
  bookmaker text,
  snapshot_at timestamptz,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_odds TO anon, authenticated;
GRANT ALL ON public.match_odds TO service_role;

ALTER TABLE public.match_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_odds_select_all ON public.match_odds
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER set_match_odds_updated_at
BEFORE UPDATE ON public.match_odds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Change points to numeric
ALTER TABLE public.predictions ALTER COLUMN points TYPE numeric(6,2) USING points::numeric(6,2);
ALTER TABLE public.predictions ALTER COLUMN points SET DEFAULT 0;

-- 4. New odds-based scoring function
CREATE OR REPLACE FUNCTION public.score_pick_odds(
  pred_pick text,
  actual_home integer,
  actual_away integer,
  odds_1 numeric,
  odds_x numeric,
  odds_2 numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN actual_home IS NULL OR actual_away IS NULL OR pred_pick IS NULL THEN 0
    WHEN pred_pick = '1' AND actual_home > actual_away THEN COALESCE(odds_1, 0)
    WHEN pred_pick = 'X' AND actual_home = actual_away THEN COALESCE(odds_x, 0)
    WHEN pred_pick = '2' AND actual_home < actual_away THEN COALESCE(odds_2, 0)
    ELSE 0
  END
$$;

-- 5. Replace recompute trigger to use locked odds
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
      SET points = public.score_pick_odds(pick, NEW.home_score, NEW.away_score, o.odds_1, o.odds_x, o.odds_2),
          updated_at = now()
      WHERE match_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Helper: recompute a single match (used after locking odds belatedly)
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
  SELECT home_score, away_score INTO m FROM public.matches WHERE id = _match_id;
  IF m.home_score IS NULL OR m.away_score IS NULL THEN RETURN; END IF;
  SELECT odds_1, odds_x, odds_2, locked INTO o FROM public.match_odds WHERE match_id = _match_id;
  IF o IS NULL OR NOT o.locked THEN
    UPDATE public.predictions SET points = 0, updated_at = now() WHERE match_id = _match_id;
  ELSE
    UPDATE public.predictions
    SET points = public.score_pick_odds(pick, m.home_score, m.away_score, o.odds_1, o.odds_x, o.odds_2),
        updated_at = now()
    WHERE match_id = _match_id;
  END IF;
END;
$$;

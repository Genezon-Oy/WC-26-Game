
-- Add pick column and relax score columns
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS pick text CHECK (pick IN ('1','X','2'));

ALTER TABLE public.predictions
  ALTER COLUMN home_score DROP NOT NULL,
  ALTER COLUMN away_score DROP NOT NULL;

-- Backfill pick from any existing score-style predictions
UPDATE public.predictions
SET pick = CASE
  WHEN home_score IS NULL OR away_score IS NULL THEN pick
  WHEN home_score > away_score THEN '1'
  WHEN home_score = away_score THEN 'X'
  ELSE '2'
END
WHERE pick IS NULL;

-- New scoring: 2 points for correct 1X2, else 0
CREATE OR REPLACE FUNCTION public.score_pick(pred_pick text, actual_home integer, actual_away integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN actual_home IS NULL OR actual_away IS NULL OR pred_pick IS NULL THEN 0
    WHEN pred_pick = '1' AND actual_home > actual_away THEN 2
    WHEN pred_pick = 'X' AND actual_home = actual_away THEN 2
    WHEN pred_pick = '2' AND actual_home < actual_away THEN 2
    ELSE 0
  END
$$;

-- Update recompute trigger to use new scoring on pick
CREATE OR REPLACE FUNCTION public.recompute_match_predictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points = public.score_pick(pick, NEW.home_score, NEW.away_score),
        updated_at = now()
    WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recompute existing points
UPDATE public.predictions p
SET points = public.score_pick(p.pick, m.home_score, m.away_score)
FROM public.matches m
WHERE p.match_id = m.id
  AND m.home_score IS NOT NULL
  AND m.away_score IS NOT NULL;

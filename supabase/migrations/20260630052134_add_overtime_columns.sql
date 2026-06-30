-- Add columns for extra time and penalty shootouts
ALTER TABLE public.matches 
  ADD COLUMN home_score_et INT,
  ADD COLUMN away_score_et INT,
  ADD COLUMN home_score_pen INT,
  ADD COLUMN away_score_pen INT;

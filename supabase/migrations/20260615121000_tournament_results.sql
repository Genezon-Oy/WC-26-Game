CREATE TABLE IF NOT EXISTS public.tournament_results (
  id integer PRIMARY KEY DEFAULT 1,
  winner text,
  golden_boot text,
  most_assists text,
  semi_finalists text[]
);
-- Ensure only one row
ALTER TABLE public.tournament_results ADD CONSTRAINT tournament_results_single_row CHECK (id = 1);

INSERT INTO public.tournament_results (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.tournament_results TO anon, authenticated;
GRANT ALL ON public.tournament_results TO service_role;


-- Fix search_path on score_prediction & set_updated_at
CREATE OR REPLACE FUNCTION public.score_prediction(
  pred_home INT, pred_away INT, actual_home INT, actual_away INT
) RETURNS INT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN actual_home IS NULL OR actual_away IS NULL THEN 0
    WHEN pred_home = actual_home AND pred_away = actual_away THEN 5
    WHEN (pred_home - pred_away) = (actual_home - actual_away)
         AND sign(pred_home - pred_away) = sign(actual_home - actual_away) THEN 3
    WHEN sign(pred_home - pred_away) = sign(actual_home - actual_away) THEN 2
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke public/anon/authenticated execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_match_predictions() FROM PUBLIC, anon, authenticated;
-- has_role must remain callable by authenticated (RLS policies use it)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

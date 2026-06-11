
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

GRANT UPDATE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

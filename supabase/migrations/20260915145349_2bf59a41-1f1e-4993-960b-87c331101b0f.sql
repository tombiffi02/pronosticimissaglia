CREATE OR REPLACE FUNCTION public.join_league_by_code(_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _league_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO _league_id
  FROM public.leagues
  WHERE upper(invite_code) = upper(trim(_invite_code));

  IF _league_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (_league_id, _uid, 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN _league_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_league_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_league_by_code(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_league() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_prediction_history() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_league_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_league_admin(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_match_visible(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_league_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_league_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_match_visible(UUID, UUID) TO authenticated;
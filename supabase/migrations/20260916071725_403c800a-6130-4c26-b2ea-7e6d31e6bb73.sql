-- MATCHDAYS
CREATE TABLE public.matchdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  name TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matchdays_league_number_unique UNIQUE (league_id, number),
  CONSTRAINT matchdays_number_positive CHECK (number > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchdays TO authenticated;
GRANT ALL ON public.matchdays TO service_role;

ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY matchdays_select_members ON public.matchdays
  FOR SELECT TO authenticated USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY matchdays_insert_admin ON public.matchdays
  FOR INSERT TO authenticated WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY matchdays_update_admin ON public.matchdays
  FOR UPDATE TO authenticated USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY matchdays_delete_admin ON public.matchdays
  FOR DELETE TO authenticated USING (public.is_league_admin(league_id, auth.uid()));

CREATE TRIGGER matchdays_set_updated_at BEFORE UPDATE ON public.matchdays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_matchdays_league ON public.matchdays(league_id);

-- MATCHES -> MATCHDAYS
ALTER TABLE public.matches
  ADD COLUMN matchday_id UUID NOT NULL REFERENCES public.matchdays(id) ON DELETE RESTRICT;
ALTER TABLE public.matches DROP COLUMN matchday;
CREATE INDEX idx_matches_matchday_id ON public.matches(matchday_id);

CREATE UNIQUE INDEX idx_matches_league_external_id
  ON public.matches(league_id, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX idx_teams_external_season
  ON public.teams(external_id, season, championship) WHERE external_id IS NOT NULL;

-- helper: is the user admin of at least one league?
CREATE OR REPLACE FUNCTION public.is_any_league_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members WHERE user_id = _user_id AND role = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_any_league_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_any_league_admin(uuid) TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
CREATE POLICY teams_insert_admin ON public.teams
  FOR INSERT TO authenticated WITH CHECK (public.is_any_league_admin(auth.uid()));
CREATE POLICY teams_update_admin ON public.teams
  FOR UPDATE TO authenticated USING (public.is_any_league_admin(auth.uid()))
  WITH CHECK (public.is_any_league_admin(auth.uid()));
CREATE POLICY teams_delete_admin ON public.teams
  FOR DELETE TO authenticated USING (public.is_any_league_admin(auth.uid()));

-- helper: reference team match
CREATE OR REPLACE FUNCTION public.is_reference_team_match(_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.leagues l ON l.id = m.league_id
    WHERE m.id = _match_id
      AND l.reference_team_id IS NOT NULL
      AND (m.home_team_id = l.reference_team_id OR m.away_team_id = l.reference_team_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_reference_team_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reference_team_match(uuid) TO authenticated;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_valid_result CHECK (
    (home_sets IS NULL AND away_sets IS NULL)
    OR (home_sets = 3 AND away_sets IN (0,1,2))
    OR (away_sets = 3 AND home_sets IN (0,1,2))
  );

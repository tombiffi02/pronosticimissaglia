-- =========================================================
-- Utility functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- TEAMS
-- =========================================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  group_name TEXT,
  season TEXT NOT NULL,
  championship TEXT NOT NULL,
  logo_url TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_external_id_key ON public.teams (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX teams_season_championship_idx ON public.teams (season, championship, group_name);

GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_authenticated" ON public.teams
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- LEAGUES
-- =========================================================
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  championship TEXT NOT NULL,
  group_name TEXT,
  reference_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leagues_admin_id_idx ON public.leagues (admin_id);

CREATE TRIGGER leagues_set_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- LEAGUE MEMBERS
-- =========================================================
CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);
CREATE INDEX league_members_league_id_idx ON public.league_members (league_id);
CREATE INDEX league_members_user_id_idx ON public.league_members (user_id);

CREATE OR REPLACE FUNCTION public.is_league_member(_league_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = _league_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_admin(_league_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = _league_id AND user_id = _user_id AND role = 'admin'
  );
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leagues_select_members" ON public.leagues
  FOR SELECT TO authenticated USING (public.is_league_member(id, auth.uid()));
CREATE POLICY "leagues_insert_self_admin" ON public.leagues
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid());
CREATE POLICY "leagues_update_admin" ON public.leagues
  FOR UPDATE TO authenticated
  USING (public.is_league_admin(id, auth.uid()))
  WITH CHECK (public.is_league_admin(id, auth.uid()));
CREATE POLICY "leagues_delete_admin" ON public.leagues
  FOR DELETE TO authenticated USING (public.is_league_admin(id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_members TO authenticated;
GRANT ALL ON public.league_members TO service_role;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_members_select_same_league" ON public.league_members
  FOR SELECT TO authenticated USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "league_members_insert_self_or_admin" ON public.league_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member')
    OR public.is_league_admin(league_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.admin_id = auth.uid())
  );
CREATE POLICY "league_members_update_admin" ON public.league_members
  FOR UPDATE TO authenticated
  USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "league_members_delete_admin_or_self" ON public.league_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_league_admin(league_id, auth.uid()));

-- =========================================================
-- LEAGUE SETTINGS
-- =========================================================
CREATE TABLE public.league_settings (
  league_id UUID PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  exact_score_points INTEGER NOT NULL DEFAULT 3,
  correct_winner_points INTEGER NOT NULL DEFAULT 1,
  wrong_winner_points INTEGER NOT NULL DEFAULT -2,
  lock_minutes_before INTEGER NOT NULL DEFAULT 30,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.league_settings TO authenticated;
GRANT ALL ON public.league_settings TO service_role;
ALTER TABLE public.league_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league_settings_select_members" ON public.league_settings
  FOR SELECT TO authenticated USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "league_settings_insert_admin" ON public.league_settings
  FOR INSERT TO authenticated WITH CHECK (
    public.is_league_admin(league_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.admin_id = auth.uid())
  );
CREATE POLICY "league_settings_update_admin" ON public.league_settings
  FOR UPDATE TO authenticated
  USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

CREATE TRIGGER league_settings_set_updated_at
  BEFORE UPDATE ON public.league_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_league()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.league_settings (league_id) VALUES (NEW.id)
  ON CONFLICT (league_id) DO NOTHING;
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, NEW.admin_id, 'admin')
  ON CONFLICT (league_id, user_id) DO UPDATE SET role = 'admin';
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_league_created
  AFTER INSERT ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_league();

-- =========================================================
-- MATCHES
-- =========================================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  match_date DATE NOT NULL,
  match_time TIME,
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  home_sets INTEGER,
  away_sets INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','open','locked','finished','postponed','cancelled')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_teams_differ CHECK (home_team_id <> away_team_id),
  CONSTRAINT matches_sets_range CHECK (
    (home_sets IS NULL OR home_sets BETWEEN 0 AND 3)
    AND (away_sets IS NULL OR away_sets BETWEEN 0 AND 3)
  )
);
CREATE INDEX matches_league_id_idx ON public.matches (league_id);
CREATE INDEX matches_matchday_idx ON public.matches (matchday);
CREATE INDEX matches_match_date_idx ON public.matches (match_date);
CREATE INDEX matches_league_matchday_idx ON public.matches (league_id, matchday);
CREATE UNIQUE INDEX matches_external_id_key ON public.matches (external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select_members" ON public.matches
  FOR SELECT TO authenticated USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "matches_insert_admin" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "matches_update_admin" ON public.matches
  FOR UPDATE TO authenticated
  USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "matches_delete_admin" ON public.matches
  FOR DELETE TO authenticated USING (public.is_league_admin(league_id, auth.uid()));

CREATE TRIGGER matches_set_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_match_visible(_match_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.league_members lm ON lm.league_id = m.league_id
    WHERE m.id = _match_id AND lm.user_id = _user_id
  );
$$;

-- =========================================================
-- PREDICTIONS
-- =========================================================
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_sets INTEGER NOT NULL,
  away_sets INTEGER NOT NULL,
  points INTEGER,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id),
  CONSTRAINT predictions_valid_score CHECK (
    (home_sets, away_sets) IN ((3,0),(3,1),(3,2),(0,3),(1,3),(2,3))
  )
);
CREATE INDEX predictions_user_id_idx ON public.predictions (user_id);
CREATE INDEX predictions_match_id_idx ON public.predictions (match_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions_select_own" ON public.predictions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "predictions_insert_own" ON public.predictions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_match_visible(match_id, auth.uid()));
CREATE POLICY "predictions_update_own" ON public.predictions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_match_visible(match_id, auth.uid()));
CREATE POLICY "predictions_delete_own" ON public.predictions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER predictions_set_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PREDICTION HISTORY
-- =========================================================
CREATE TABLE public.prediction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_sets INTEGER NOT NULL,
  away_sets INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prediction_history_prediction_id_idx ON public.prediction_history (prediction_id);
CREATE INDEX prediction_history_user_match_idx ON public.prediction_history (user_id, match_id);

GRANT SELECT ON public.prediction_history TO authenticated;
GRANT ALL ON public.prediction_history TO service_role;
ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prediction_history_select_own" ON public.prediction_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_prediction_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.home_sets IS DISTINCT FROM OLD.home_sets
     OR NEW.away_sets IS DISTINCT FROM OLD.away_sets THEN
    INSERT INTO public.prediction_history (prediction_id, user_id, match_id, home_sets, away_sets)
    VALUES (NEW.id, NEW.user_id, NEW.match_id, NEW.home_sets, NEW.away_sets);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER predictions_log_history
  AFTER INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.log_prediction_history();
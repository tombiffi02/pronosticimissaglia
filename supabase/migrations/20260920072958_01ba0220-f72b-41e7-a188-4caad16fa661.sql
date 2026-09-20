-- Fase 4B: risultati, scoring automatico, classifica

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS scoring_type text,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz;

ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_scoring_type_check;
ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_scoring_type_check
  CHECK (scoring_type IS NULL OR scoring_type IN ('exact','winner','wrong'));

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS result_entered_at timestamptz;

CREATE TABLE IF NOT EXISTS public.match_result_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  previous_home_sets integer,
  previous_away_sets integer,
  new_home_sets integer NOT NULL,
  new_away_sets integer NOT NULL,
  exact_score_points integer NOT NULL,
  correct_winner_points integer NOT NULL,
  wrong_winner_points integer NOT NULL,
  predictions_scored integer NOT NULL DEFAULT 0,
  changed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_result_history TO authenticated;
GRANT ALL ON public.match_result_history TO service_role;
ALTER TABLE public.match_result_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_result_history_select_admin ON public.match_result_history;
CREATE POLICY match_result_history_select_admin ON public.match_result_history
  FOR SELECT TO authenticated
  USING (public.is_league_admin(league_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_match_result_history_match ON public.match_result_history (match_id, created_at DESC);

-- I risultati possono essere modificati solo dalla funzione di scoring
CREATE OR REPLACE FUNCTION public.guard_match_result_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.home_sets IS DISTINCT FROM OLD.home_sets OR NEW.away_sets IS DISTINCT FROM OLD.away_sets)
     AND COALESCE(current_setting('app.scoring', true), '') <> 'on' THEN
    RAISE EXCEPTION 'result_must_use_set_match_result';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_guard_result ON public.matches;
CREATE TRIGGER matches_guard_result
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.guard_match_result_update();

-- Registrazione risultato + scoring atomico
CREATE OR REPLACE FUNCTION public.set_match_result(_match_id uuid, _home_sets integer, _away_sets integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.matches%ROWTYPE;
  _s public.league_settings%ROWTYPE;
  _prev_home integer;
  _prev_away integer;
  _scored integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _m FROM public.matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF NOT public.is_league_admin(_m.league_id, _uid) THEN
    RAISE EXCEPTION 'not_league_admin';
  END IF;

  IF NOT ((_home_sets = 3 AND _away_sets IN (0,1,2)) OR (_away_sets = 3 AND _home_sets IN (0,1,2))) THEN
    RAISE EXCEPTION 'invalid_result';
  END IF;

  SELECT * INTO _s FROM public.league_settings WHERE league_id = _m.league_id;
  IF _s.league_id IS NULL THEN RAISE EXCEPTION 'league_settings_missing'; END IF;

  _prev_home := _m.home_sets;
  _prev_away := _m.away_sets;

  PERFORM set_config('app.scoring', 'on', true);

  UPDATE public.matches
     SET home_sets = _home_sets,
         away_sets = _away_sets,
         status = 'finished',
         result_entered_at = now()
   WHERE id = _match_id;

  UPDATE public.predictions p
     SET points = CASE
           WHEN p.home_sets = _home_sets AND p.away_sets = _away_sets THEN _s.exact_score_points
           WHEN (p.home_sets > p.away_sets) = (_home_sets > _away_sets) THEN _s.correct_winner_points
           ELSE _s.wrong_winner_points
         END,
         scoring_type = CASE
           WHEN p.home_sets = _home_sets AND p.away_sets = _away_sets THEN 'exact'
           WHEN (p.home_sets > p.away_sets) = (_home_sets > _away_sets) THEN 'winner'
           ELSE 'wrong'
         END,
         scored_at = now()
   WHERE p.match_id = _match_id;

  GET DIAGNOSTICS _scored = ROW_COUNT;

  PERFORM set_config('app.scoring', 'off', true);

  INSERT INTO public.match_result_history (
    match_id, league_id, previous_home_sets, previous_away_sets,
    new_home_sets, new_away_sets,
    exact_score_points, correct_winner_points, wrong_winner_points,
    predictions_scored, changed_by
  ) VALUES (
    _match_id, _m.league_id, _prev_home, _prev_away,
    _home_sets, _away_sets,
    _s.exact_score_points, _s.correct_winner_points, _s.wrong_winner_points,
    _scored, _uid
  );

  RETURN jsonb_build_object(
    'match_id', _match_id,
    'home_sets', _home_sets,
    'away_sets', _away_sets,
    'predictions_scored', _scored,
    'corrected', (_prev_home IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_result(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_result(uuid, integer, integer) TO authenticated;

-- Classifica generale
CREATE OR REPLACE FUNCTION public.league_standings(_league_id uuid)
RETURNS TABLE(user_id uuid, display_name text, total_points integer, scored_predictions integer, exact_count integer, winner_count integer, wrong_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT lm.user_id,
         pr.display_name,
         COALESCE(SUM(p.points), 0)::int,
         COUNT(p.id)::int,
         COUNT(*) FILTER (WHERE p.scoring_type = 'exact')::int,
         COUNT(*) FILTER (WHERE p.scoring_type = 'winner')::int,
         COUNT(*) FILTER (WHERE p.scoring_type = 'wrong')::int
  FROM public.league_members lm
  JOIN public.profiles pr ON pr.id = lm.user_id
  LEFT JOIN public.predictions p
         ON p.user_id = lm.user_id
        AND p.points IS NOT NULL
        AND p.match_id IN (SELECT id FROM public.matches WHERE league_id = _league_id)
  WHERE lm.league_id = _league_id
    AND public.is_league_member(_league_id, auth.uid())
  GROUP BY lm.user_id, pr.display_name
  ORDER BY 3 DESC, pr.display_name;
$$;

REVOKE ALL ON FUNCTION public.league_standings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_standings(uuid) TO authenticated;

-- Classifica di giornata
CREATE OR REPLACE FUNCTION public.matchday_standings(_league_id uuid, _matchday_id uuid)
RETURNS TABLE(user_id uuid, display_name text, total_points integer, scored_predictions integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT lm.user_id,
         pr.display_name,
         COALESCE(SUM(p.points), 0)::int,
         COUNT(p.id)::int
  FROM public.league_members lm
  JOIN public.profiles pr ON pr.id = lm.user_id
  LEFT JOIN public.predictions p
         ON p.user_id = lm.user_id
        AND p.points IS NOT NULL
        AND p.match_id IN (
              SELECT id FROM public.matches
              WHERE league_id = _league_id AND matchday_id = _matchday_id
            )
  WHERE lm.league_id = _league_id
    AND public.is_league_member(_league_id, auth.uid())
  GROUP BY lm.user_id, pr.display_name
  ORDER BY 3 DESC, pr.display_name;
$$;

REVOKE ALL ON FUNCTION public.matchday_standings(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matchday_standings(uuid, uuid) TO authenticated;

-- match_board: aggiunge punti del pronostico dell'utente
DROP FUNCTION IF EXISTS public.match_board(uuid);
CREATE FUNCTION public.match_board(_league_id uuid)
RETURNS TABLE(match_id uuid, matchday_id uuid, matchday_number integer, matchday_name text, match_date date, match_time time without time zone, lock_at timestamptz, server_now timestamptz, status text, home_team_id uuid, home_team_name text, away_team_id uuid, away_team_name text, home_sets integer, away_sets integer, is_reference_match boolean, my_home_sets integer, my_away_sets integer, my_points integer, my_scoring_type text, is_locked boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.id,
    md.id,
    md.number,
    md.name,
    m.match_date,
    m.match_time,
    public.prediction_lock_at(m.id),
    now(),
    m.status,
    m.home_team_id,
    ht.name,
    m.away_team_id,
    at.name,
    m.home_sets,
    m.away_sets,
    (l.reference_team_id IS NOT NULL
      AND (m.home_team_id = l.reference_team_id OR m.away_team_id = l.reference_team_id)),
    p.home_sets,
    p.away_sets,
    p.points,
    p.scoring_type,
    (now() >= public.prediction_lock_at(m.id))
  FROM public.matches m
  JOIN public.leagues l ON l.id = m.league_id
  JOIN public.matchdays md ON md.id = m.matchday_id
  JOIN public.teams ht ON ht.id = m.home_team_id
  JOIN public.teams at ON at.id = m.away_team_id
  LEFT JOIN public.predictions p ON p.match_id = m.id AND p.user_id = auth.uid()
  WHERE m.league_id = _league_id
    AND public.is_league_member(_league_id, auth.uid())
  ORDER BY md.number, m.match_date, m.match_time NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.match_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_board(uuid) TO authenticated;
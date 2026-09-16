-- ===== FASE 3: PREDICTION ENGINE =====

-- deadline di chiusura pronostici (timezone Europe/Rome)
CREATE OR REPLACE FUNCTION public.prediction_lock_at(_match_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ((m.match_date + COALESCE(m.match_time, '00:00'::time)) AT TIME ZONE 'Europe/Rome')
         - make_interval(mins => COALESCE(s.lock_minutes_before, 30))
  FROM public.matches m
  LEFT JOIN public.league_settings s ON s.league_id = m.league_id
  WHERE m.id = _match_id;
$$;
REVOKE EXECUTE ON FUNCTION public.prediction_lock_at(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prediction_lock_at(uuid) TO authenticated;

-- board partite + pronostico utente (una sola query)
CREATE OR REPLACE FUNCTION public.match_board(_league_id uuid)
RETURNS TABLE (
  match_id uuid,
  matchday_id uuid,
  matchday_number integer,
  matchday_name text,
  match_date date,
  match_time time,
  lock_at timestamptz,
  server_now timestamptz,
  status text,
  home_team_id uuid,
  home_team_name text,
  away_team_id uuid,
  away_team_name text,
  home_sets integer,
  away_sets integer,
  is_reference_match boolean,
  my_home_sets integer,
  my_away_sets integer,
  is_locked boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.match_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_board(uuid) TO authenticated;

-- salvataggio pronostico: unica via di scrittura
CREATE OR REPLACE FUNCTION public.submit_prediction(_match_id uuid, _home_sets integer, _away_sets integer)
RETURNS public.predictions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _m public.matches%ROWTYPE;
  _lock timestamptz;
  _ref boolean;
  _row public.predictions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO _m FROM public.matches WHERE id = _match_id;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF NOT public.is_league_member(_m.league_id, _uid) THEN
    RAISE EXCEPTION 'not_a_league_member';
  END IF;

  IF NOT ((_home_sets = 3 AND _away_sets IN (0,1,2)) OR (_away_sets = 3 AND _home_sets IN (0,1,2))) THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  SELECT (l.reference_team_id IS NOT NULL
          AND (_m.home_team_id = l.reference_team_id OR _m.away_team_id = l.reference_team_id))
    INTO _ref
  FROM public.leagues l WHERE l.id = _m.league_id;
  IF _ref THEN RAISE EXCEPTION 'reference_team_match_not_predictable'; END IF;

  IF _m.status IN ('cancelled', 'finished') THEN RAISE EXCEPTION 'match_not_open'; END IF;

  _lock := public.prediction_lock_at(_match_id);
  IF _lock IS NULL OR now() >= _lock THEN RAISE EXCEPTION 'predictions_locked'; END IF;

  INSERT INTO public.predictions (user_id, match_id, home_sets, away_sets, locked_at)
  VALUES (_uid, _match_id, _home_sets, _away_sets, _lock)
  ON CONFLICT (user_id, match_id) DO UPDATE
    SET home_sets = EXCLUDED.home_sets,
        away_sets = EXCLUDED.away_sets,
        locked_at = EXCLUDED.locked_at
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_prediction(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_prediction(uuid, integer, integer) TO authenticated;

-- storico pronostici del proprio utente per una partita
CREATE OR REPLACE FUNCTION public.my_prediction_history(_match_id uuid)
RETURNS TABLE (home_sets integer, away_sets integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.home_sets, h.away_sets, h.created_at
  FROM public.prediction_history h
  WHERE h.match_id = _match_id AND h.user_id = auth.uid()
  ORDER BY h.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.my_prediction_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_prediction_history(uuid) TO authenticated;

-- il client non scrive più direttamente sui pronostici: solo via submit_prediction
DROP POLICY IF EXISTS predictions_insert_own ON public.predictions;
DROP POLICY IF EXISTS predictions_update_own ON public.predictions;
DROP POLICY IF EXISTS predictions_delete_own ON public.predictions;
REVOKE INSERT, UPDATE, DELETE ON public.predictions FROM authenticated;

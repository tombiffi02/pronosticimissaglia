-- Avatar in classifica + storage bucket per l'upload della foto profilo
-- + indicatore di tendenza (su/giù/invariato) rispetto alla giornata precedente

-- Bucket pubblico per gli avatar (le immagini profilo non sono dati sensibili)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatar_public_read ON storage.objects;
CREATE POLICY avatar_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Ogni utente può scrivere solo dentro la propria cartella: avatars/{user_id}/...
DROP POLICY IF EXISTS avatar_insert_own ON storage.objects;
CREATE POLICY avatar_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatar_update_own ON storage.objects;
CREATE POLICY avatar_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatar_delete_own ON storage.objects;
CREATE POLICY avatar_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Classifica generale: aggiunge avatar_url e trend ('up'/'down'/'same'/NULL se non c'è
-- ancora una giornata precedente conclusa da confrontare)
CREATE OR REPLACE FUNCTION public.league_standings(_league_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points integer,
  scored_predictions integer,
  exact_count integer,
  winner_count integer,
  wrong_count integer,
  trend text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH latest_md AS (
    SELECT MAX(matchday_number) AS n
    FROM public.matches
    WHERE league_id = _league_id AND status = 'finished'
  ),
  prev_md AS (
    SELECT MAX(m.matchday_number) AS n
    FROM public.matches m, latest_md
    WHERE m.league_id = _league_id AND m.status = 'finished'
      AND m.matchday_number < latest_md.n
  ),
  stats AS (
    SELECT lm.user_id,
           COALESCE(SUM(p.points), 0)::int AS total_points,
           COUNT(p.id)::int AS scored_predictions,
           COUNT(*) FILTER (WHERE p.scoring_type = 'exact')::int AS exact_count,
           COUNT(*) FILTER (WHERE p.scoring_type = 'winner')::int AS winner_count,
           COUNT(*) FILTER (WHERE p.scoring_type = 'wrong')::int AS wrong_count
    FROM public.league_members lm
    LEFT JOIN public.predictions p
           ON p.user_id = lm.user_id
          AND p.points IS NOT NULL
          AND p.match_id IN (SELECT id FROM public.matches WHERE league_id = _league_id)
    WHERE lm.league_id = _league_id
    GROUP BY lm.user_id
  ),
  current_rank AS (
    SELECT user_id, RANK() OVER (ORDER BY total_points DESC) AS r FROM stats
  ),
  prev_stats AS (
    SELECT lm.user_id, COALESCE(SUM(p.points), 0)::int AS total_points
    FROM public.league_members lm
    LEFT JOIN public.predictions p
           ON p.user_id = lm.user_id
          AND p.points IS NOT NULL
          AND p.match_id IN (
                SELECT m.id FROM public.matches m, prev_md
                WHERE m.league_id = _league_id AND m.status = 'finished'
                  AND m.matchday_number <= prev_md.n
              )
    WHERE lm.league_id = _league_id
    GROUP BY lm.user_id
  ),
  prev_rank AS (
    SELECT user_id, RANK() OVER (ORDER BY total_points DESC) AS r FROM prev_stats
  )
  SELECT lm.user_id,
         pr.display_name,
         pr.avatar_url,
         s.total_points,
         s.scored_predictions,
         s.exact_count,
         s.winner_count,
         s.wrong_count,
         CASE
           WHEN (SELECT n FROM prev_md) IS NULL THEN NULL
           WHEN cr.r < pv.r THEN 'up'
           WHEN cr.r > pv.r THEN 'down'
           ELSE 'same'
         END AS trend
  FROM public.league_members lm
  JOIN public.profiles pr ON pr.id = lm.user_id
  JOIN stats s ON s.user_id = lm.user_id
  JOIN current_rank cr ON cr.user_id = lm.user_id
  LEFT JOIN prev_rank pv ON pv.user_id = lm.user_id
  WHERE lm.league_id = _league_id
    AND public.is_league_member(_league_id, auth.uid())
  ORDER BY s.total_points DESC, pr.display_name;
$$;

REVOKE ALL ON FUNCTION public.league_standings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_standings(uuid) TO authenticated;

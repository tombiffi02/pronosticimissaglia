CREATE TABLE public.calendar_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'FIPAV',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','partial','error')),
  matchdays_found INTEGER NOT NULL DEFAULT 0,
  matches_found INTEGER NOT NULL DEFAULT 0,
  matches_created INTEGER NOT NULL DEFAULT 0,
  matches_updated INTEGER NOT NULL DEFAULT 0,
  matches_skipped INTEGER NOT NULL DEFAULT 0,
  teams_created INTEGER NOT NULL DEFAULT 0,
  errors TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.calendar_sync_logs TO authenticated;
GRANT ALL ON public.calendar_sync_logs TO service_role;

ALTER TABLE public.calendar_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_sync_logs_select_admin" ON public.calendar_sync_logs
  FOR SELECT TO authenticated
  USING (public.is_league_admin(league_id, auth.uid()));

CREATE POLICY "calendar_sync_logs_insert_admin" ON public.calendar_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_league_admin(league_id, auth.uid()) AND created_by = auth.uid());

CREATE INDEX idx_calendar_sync_logs_league ON public.calendar_sync_logs(league_id, created_at DESC);
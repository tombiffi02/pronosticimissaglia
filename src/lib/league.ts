import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type League = Database["public"]["Tables"]["leagues"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Matchday = Database["public"]["Tables"]["matchdays"]["Row"];
export type BoardMatch = Database["public"]["Functions"]["match_board"]["Returns"][number];

export type Membership = { league_id: string; role: string; league: League };

export async function fetchMembership(): Promise<Membership | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("league_members")
    .select("league_id, role, leagues(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.leagues) return null;
  return { league_id: data.league_id, role: data.role, league: data.leagues as League };
}

export function useMembership() {
  return useQuery({ queryKey: ["membership"], queryFn: fetchMembership });
}

export function useBoard(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["board", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("match_board", { _league_id: leagueId! });
      if (error) throw error;
      return (data ?? []) as BoardMatch[];
    },
  });
}

/** Differenza tra orologio del server e del browser, calcolata sui dati ricevuti. */
export function serverOffset(board: BoardMatch[] | undefined): number {
  const first = board?.[0];
  if (!first?.server_now) return 0;
  return new Date(first.server_now).getTime() - Date.now();
}

export function formatMatchDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function formatMatchTime(time: string | null): string {
  if (!time) return "orario da definire";
  return time.slice(0, 5);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  upcoming: "Prossima",
  open: "Aperta",
  locked: "Bloccata",
  finished: "Conclusa",
  postponed: "Rinviata",
  cancelled: "Annullata",
};

export const VALID_SCORES: Array<[number, number]> = [
  [3, 0],
  [3, 1],
  [3, 2],
  [0, 3],
  [1, 3],
  [2, 3],
];

export const PREDICTION_ERRORS: Record<string, string> = {
  predictions_locked: "Pronostici chiusi per questa partita.",
  reference_team_match_not_predictable: "La partita della nostra squadra non è pronosticabile.",
  invalid_score: "Risultato non valido.",
  match_not_open: "La partita non è più aperta.",
  not_a_league_member: "Non fai parte di questa lega.",
  not_authenticated: "Sessione scaduta, accedi di nuovo.",
};

export function predictionErrorMessage(message: string): string {
  const key = Object.keys(PREDICTION_ERRORS).find((k) => message.includes(k));
  return key ? PREDICTION_ERRORS[key]! : "Non è stato possibile salvare il pronostico.";
}

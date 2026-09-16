import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui-kit";
import {
  formatCountdown,
  formatMatchDate,
  formatMatchTime,
  STATUS_LABEL,
  type BoardMatch,
} from "@/lib/league";

function useNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}

export function MatchCard({ match, offset }: { match: BoardMatch; offset: number }) {
  const now = useNow(offset);
  const lockMs = match.lock_at ? new Date(match.lock_at).getTime() - now : 0;
  const locked = !match.lock_at || lockMs <= 0;
  const finished = match.status === "finished" && match.home_sets !== null;
  const hasPrediction = match.my_home_sets !== null && match.my_away_sets !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_time)}
        </p>
        <Badge tone={match.status === "postponed" || match.status === "cancelled" ? "warn" : "neutral"}>
          {STATUS_LABEL[match.status] ?? match.status}
        </Badge>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex-1 font-semibold">{match.home_team_name}</span>
        <span className="text-sm font-bold tabular-nums">
          {finished ? `${match.home_sets} — ${match.away_sets}` : "vs"}
        </span>
        <span className="flex-1 text-right font-semibold">{match.away_team_name}</span>
      </div>

      {match.is_reference_match ? (
        <div className="mt-3 rounded-lg bg-primary/10 p-3 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">La nostra partita</p>
          <p className="mt-1 text-xs text-muted-foreground">Non pronosticabile</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {hasPrediction ? (
            <p className="text-sm">
              Il tuo pronostico: <strong>{match.my_home_sets} — {match.my_away_sets}</strong>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Pronostico non inserito</p>
          )}

          {finished ? null : locked ? (
            <p className="text-sm font-medium">🔒 Pronostici chiusi</p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm ${lockMs < 5 * 60 * 1000 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                {lockMs < 5 * 60 * 1000 ? "⚠️ " : ""}Chiusura tra {formatCountdown(lockMs)}
              </p>
              <Link
                to="/match/$matchId"
                params={{ matchId: match.match_id }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {hasPrediction ? "Modifica" : "Pronostica"}
              </Link>
            </div>
          )}

          {(finished || locked) && (
            <Link
              to="/match/$matchId"
              params={{ matchId: match.match_id }}
              className="inline-block text-xs font-medium underline"
            >
              Dettaglio partita
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function ReferenceMatchCard({ match }: { match: BoardMatch }) {
  const finished = match.status === "finished" && match.home_sets !== null;
  return (
    <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-primary">La nostra partita</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="flex-1 text-lg font-bold">{match.home_team_name}</span>
        <span className="text-sm font-bold tabular-nums">
          {finished ? `${match.home_sets} — ${match.away_sets}` : "vs"}
        </span>
        <span className="flex-1 text-right text-lg font-bold">{match.away_team_name}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_time)}
      </p>
      <p className="mt-3 text-sm font-semibold">🏐 Forza squadra!</p>
    </div>
  );
}

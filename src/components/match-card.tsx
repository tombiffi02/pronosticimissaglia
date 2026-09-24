import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui-kit";
import { EXPANDED_SCORES } from "@/components/home-visuals";
import {
  formatCountdown,
  formatPoints,
  formatMatchDate,
  formatMatchTime,
  predictionErrorMessage,
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
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "loading";
    msg: string;
  } | null>(null);

  const now = useNow(offset);
  const lockMs = match.lock_at ? new Date(match.lock_at).getTime() - now : 0;
  const locked = !match.lock_at || lockMs <= 0;
  const finished = match.status === "finished" && match.home_sets !== null;
  const hasPrediction = match.my_home_sets !== null && match.my_away_sets !== null;

  const submit = useMutation({
    mutationFn: async ([home, away]: [number, number]) => {
      const { error } = await supabase.rpc("submit_prediction", {
        _match_id: match.match_id,
        _home_sets: home,
        _away_sets: away,
      });
      if (error) throw new Error(predictionErrorMessage(error.message));
      return [home, away] as [number, number];
    },
    onMutate: ([home, away]) => {
      setFeedback({ tone: "loading", msg: `Salvataggio ${home}-${away}...` });
    },
    onSuccess: async ([home, away]) => {
      setFeedback({ tone: "success", msg: `✓ Pronostico salvato: ${home}-${away}` });
      await queryClient.invalidateQueries({ queryKey: ["board"] });
      await queryClient.invalidateQueries({ queryKey: ["prediction-history", match.match_id] });
      setTimeout(() => setFeedback(null), 2500);
    },
    onError: (err: Error) => {
      setFeedback({ tone: "error", msg: err.message });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_time)}
        </p>
        <Badge
          tone={match.status === "postponed" || match.status === "cancelled" ? "warn" : "neutral"}
        >
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
          <p className="text-sm font-bold uppercase tracking-wide text-primary">
            La nostra partita
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Non pronosticabile</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {hasPrediction ? (
            <p className="text-sm">
              Il tuo pronostico:{" "}
              <strong>
                {match.my_home_sets} — {match.my_away_sets}
              </strong>
              {match.my_points !== null ? (
                <>
                  {" · "}
                  <strong className={match.my_points >= 0 ? "text-primary" : "text-destructive"}>
                    {formatPoints(match.my_points)} punti
                  </strong>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Pronostico non inserito</p>
          )}

          {/* Cassetto animato con i 6 pulsanti del pronostico */}
          {!finished && !locked ? (
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                isExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-1 pt-2 pb-3">
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2 p-1">
                    {EXPANDED_SCORES.map(([h, a]) => {
                      const isSelected = match.my_home_sets === h && match.my_away_sets === a;
                      const isPending =
                        submit.isPending &&
                        submit.variables?.[0] === h &&
                        submit.variables?.[1] === a;

                      return (
                        <button
                          key={`${h}-${a}`}
                          type="button"
                          disabled={submit.isPending}
                          onClick={() => submit.mutate([h, a])}
                          className={`flex h-11 sm:h-12 items-center justify-center rounded-[8px] font-bold text-[16px] sm:text-[18px] tabular-nums tracking-normal transition-all active:scale-95 cursor-pointer ${
                            isSelected
                              ? "bg-primary text-primary-foreground ring-2 ring-primary/50 shadow-md"
                              : "bg-muted/60 hover:bg-muted text-foreground border border-border"
                          } ${isPending ? "opacity-75 animate-pulse" : ""}`}
                        >
                          {h}-{a}
                        </button>
                      );
                    })}
                  </div>

                  {feedback ? (
                    <p
                      className={`mt-2 text-center text-xs font-medium transition-all ${
                        feedback.tone === "error"
                          ? "text-destructive"
                          : feedback.tone === "loading"
                            ? "text-primary"
                            : "text-emerald-500"
                      }`}
                    >
                      {feedback.msg}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {finished ? null : locked ? (
            <p className="text-sm font-medium">🔒 Pronostici chiusi</p>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p
                className={`text-sm ${lockMs < 5 * 60 * 1000 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
              >
                {lockMs < 5 * 60 * 1000 ? "⚠️ " : ""}Chiusura tra {formatCountdown(lockMs)}
              </p>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition active:scale-95 cursor-pointer"
              >
                {isExpanded ? "Chiudi" : hasPrediction ? "Modifica" : "Pronostica"}
              </button>
            </div>
          )}

          {!finished && (
            <div className="flex items-center justify-between pt-1">
              <Link
                to="/match/$matchId"
                params={{ matchId: match.match_id }}
                className="inline-block text-xs font-medium text-muted-foreground hover:text-foreground underline"
              >
                Dettaglio partita
              </Link>
            </div>
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

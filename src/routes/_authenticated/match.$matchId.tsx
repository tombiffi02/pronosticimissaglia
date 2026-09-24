import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Message, buttonClass, Badge } from "@/components/ui-kit";
import { BottomNav } from "@/components/nav";
import {
  formatCountdown,
  formatMatchDate,
  formatMatchTime,
  formatPoints,
  predictionErrorMessage,
  SCORING_LABEL,
  serverOffset,
  STATUS_LABEL,
  useBoard,
  useMembership,
  VALID_SCORES,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Pronostico partita | Prediction League Serie B" },
      {
        name: "description",
        content: "Scegli il tuo pronostico per la partita di pallavolo di Serie B Maschile.",
      },
      { property: "og:title", content: "Pronostico partita | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Scegli il tuo pronostico per la partita di pallavolo di Serie B Maschile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

function MatchPage() {
  const { matchId } = useParams({ from: "/_authenticated/match/$matchId" });
  const queryClient = useQueryClient();
  const { data: membership } = useMembership();
  const { data: board, isLoading } = useBoard(membership?.league_id);
  const offset = serverOffset(board);
  const match = board?.find((m) => m.match_id === matchId);

  const [choice, setChoice] = useState<[number, number] | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);

  const history = useQuery({
    queryKey: ["prediction-history", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_prediction_history", { _match_id: matchId });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async ([home, away]: [number, number]) => {
      const { error } = await supabase.rpc("submit_prediction", {
        _match_id: matchId,
        _home_sets: home,
        _away_sets: away,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setSaved(true);
      setEditing(false);
      setChoice(null);
      await queryClient.invalidateQueries({ queryKey: ["board"] });
      await queryClient.invalidateQueries({ queryKey: ["prediction-history", matchId] });
    },
  });

  if (isLoading) {
    return (
      <Screen title="Partita">
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </Screen>
    );
  }
  if (!match) {
    return (
      <Screen title="Partita">
        <Card>
          <p className="text-sm">Partita non trovata.</p>
        </Card>
      </Screen>
    );
  }

  const lockMs = match.lock_at ? new Date(match.lock_at).getTime() - now : 0;
  const locked = !match.lock_at || lockMs <= 0;
  const finished = match.status === "finished" && match.home_sets !== null;
  const hasPrediction = match.my_home_sets !== null && match.my_away_sets !== null;
  const canPredict =
    !match.is_reference_match && !locked && !finished && match.status !== "cancelled";

  return (
    <Screen title="Partita" footer={<BottomNav isAdmin={membership?.role === "admin"} />}>
      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_time)}
            </p>
            <Badge>{STATUS_LABEL[match.status] ?? match.status}</Badge>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xl font-bold uppercase">{match.home_team_name}</p>
            <p className="my-1 text-sm text-muted-foreground">vs</p>
            <p className="text-xl font-bold uppercase">{match.away_team_name}</p>
          </div>
          {finished ? (
            <div className="mt-4 rounded-lg bg-muted p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Risultato finale
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {match.home_sets} — {match.away_sets}
              </p>
            </div>
          ) : null}
        </Card>

        {match.is_reference_match ? (
          <Card>
            <p className="text-center text-sm font-bold uppercase tracking-wide text-primary">
              La nostra partita
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Questa partita non fa parte del gioco: non è pronosticabile.
            </p>
            <p className="mt-3 text-center text-sm font-semibold">🏐 Forza squadra!</p>
          </Card>
        ) : (
          <Card>
            {!finished ? (
              locked ? (
                <p className="text-sm font-semibold">🔒 Pronostici chiusi</p>
              ) : (
                <p
                  className={`text-sm ${lockMs < 5 * 60 * 1000 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                >
                  {lockMs < 5 * 60 * 1000 ? "⚠️ " : ""}Chiusura tra{" "}
                  <strong className="tabular-nums">{formatCountdown(lockMs)}</strong>
                </p>
              )
            ) : null}

            <div className="mt-3">
              {hasPrediction ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Il tuo pronostico
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {match.my_home_sets} — {match.my_away_sets}
                  </p>
                  {match.my_points !== null ? (
                    <div className="mt-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Punti</p>
                      <p
                        className={`text-2xl font-bold tabular-nums ${match.my_points >= 0 ? "text-primary" : "text-destructive"}`}
                      >
                        {formatPoints(match.my_points)}
                      </p>
                      {match.my_scoring_type ? (
                        <p className="text-xs text-muted-foreground">
                          {SCORING_LABEL[match.my_scoring_type]}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {locked || finished ? (
                    <p className="mt-1 text-sm">🔒 Pronostico definitivo</p>
                  ) : editing ? null : (
                    <button className={`${buttonClass} mt-3`} onClick={() => setEditing(true)}>
                      Modifica
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Pronostico non inserito</p>
                  {!canPredict ? <p className="mt-1 text-sm">🔒 Pronostici chiusi</p> : null}
                </>
              )}
            </div>

            {canPredict && (!hasPrediction || editing) ? (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Scegli il risultato
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {VALID_SCORES.map(([h, a]) => {
                    const selected = choice?.[0] === h && choice?.[1] === a;
                    return (
                      <button
                        key={`${h}-${a}`}
                        onClick={() => {
                          setChoice([h, a]);
                          setSaved(false);
                        }}
                        className={`rounded-lg border py-3 text-sm font-bold tabular-nums ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background"
                        }`}
                      >
                        {h} — {a}
                      </button>
                    );
                  })}
                </div>

                {choice ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Il tuo pronostico
                    </p>
                    <p className="text-sm font-semibold">
                      {match.home_team_name} {choice[0]}–{choice[1]} {match.away_team_name}
                    </p>
                    <button
                      className={`${buttonClass} mt-3`}
                      disabled={submit.isPending}
                      onClick={() => submit.mutate(choice)}
                    >
                      {submit.isPending ? "Salvataggio..." : "Conferma pronostico"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {submit.isError ? (
              <div className="mt-3">
                <Message>{predictionErrorMessage((submit.error as Error).message)}</Message>
              </div>
            ) : null}
            {saved ? (
              <div className="mt-3">
                <Message tone="success">Pronostico salvato!</Message>
              </div>
            ) : null}
          </Card>
        )}

        {(history.data?.length ?? 0) > 0 ? (
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Storico modifiche
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {history.data!.map((h, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("it-IT", {
                      timeZone: "Europe/Rome",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {h.home_sets}–{h.away_sets}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Link to="/matches" className="inline-block text-sm font-medium underline">
          Torna al calendario
        </Link>
      </div>
    </Screen>
  );
}

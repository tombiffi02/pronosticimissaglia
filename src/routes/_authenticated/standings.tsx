import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Screen, Card, SectionTitle, inputClass } from "@/components/ui-kit";
import { BottomNav } from "@/components/nav";
import {
  formatPoints,
  useBoard,
  useMatchdayStandings,
  useMembership,
  useStandings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/standings")({
  head: () => ({
    meta: [
      { title: "Classifica | Prediction League Serie B" },
      { name: "description", content: "Classifica generale e punti per giornata della prediction league di pallavolo." },
      { property: "og:title", content: "Classifica | Prediction League Serie B" },
      { property: "og:description", content: "Classifica generale e punti per giornata della prediction league di pallavolo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { data: membership } = useMembership();
  const { data: board } = useBoard(membership?.league_id);
  const { data: standings, isLoading } = useStandings(membership?.league_id);

  const matchdays = [...new Map((board ?? []).map((m) => [m.matchday_id, m])).values()].sort(
    (a, b) => a.matchday_number - b.matchday_number,
  );
  const [matchdayId, setMatchdayId] = useState("");
  const { data: dayStandings } = useMatchdayStandings(membership?.league_id, matchdayId || undefined);

  return (
    <Screen
      title="Classifica"
      subtitle={membership?.league.name}
      footer={<BottomNav isAdmin={membership?.role === "admin"} />}
    >
      <div className="space-y-8">
        <section>
          <SectionTitle>Classifica generale</SectionTitle>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : (standings?.length ?? 0) === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">Nessun partecipante.</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {standings!.map((row, i) => {
                const tie = i > 0 && standings![i - 1]!.total_points === row.total_points;
                const position = tie ? "" : String(i + 1);
                return (
                  <li
                    key={row.user_id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span className="w-6 text-sm font-bold tabular-nums text-muted-foreground">{position}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{row.display_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.scored_predictions} pronostici valutati · {row.exact_count} esatti
                      </span>
                    </span>
                    <span className="text-lg font-bold tabular-nums">{formatPoints(row.total_points)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Punti per giornata</SectionTitle>
          <select
            className={inputClass}
            value={matchdayId}
            onChange={(e) => setMatchdayId(e.target.value)}
          >
            <option value="">Seleziona una giornata</option>
            {matchdays.map((m) => (
              <option key={m.matchday_id} value={m.matchday_id}>
                {m.matchday_name ?? `Giornata ${m.matchday_number}`}
              </option>
            ))}
          </select>

          {matchdayId ? (
            <ul className="mt-3 space-y-2">
              {(dayStandings ?? []).map((row) => (
                <li
                  key={row.user_id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <span className="text-sm font-semibold">{row.display_name}</span>
                  <span className="text-sm font-bold tabular-nums">{formatPoints(row.total_points)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </Screen>
  );
}

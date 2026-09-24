import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useBoard, useMatchdayStandings, useMembership, useStandings } from "@/lib/league";
import { DarkShell, HomePillNav } from "@/components/home-visuals";
import { Podium, StandingListRow } from "@/components/standings-visuals";

export const Route = createFileRoute("/_authenticated/standings")({
  head: () => ({
    meta: [
      { title: "Classifica | Prediction League Serie B" },
      {
        name: "description",
        content: "Classifica generale e andamento della prediction league di pallavolo.",
      },
      { property: "og:title", content: "Classifica | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Classifica generale e andamento della prediction league di pallavolo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { data: membership, isLoading: loadingMembership } = useMembership();
  const { data: standings, isLoading } = useStandings(membership?.league_id);
  const { data: board } = useBoard(membership?.league_id);
  const [tab, setTab] = useState<"general" | "matchday">("general");

  const matchdays = [...new Map((board ?? []).map((m) => [m.matchday_id, m])).values()].sort(
    (a, b) => a.matchday_number - b.matchday_number,
  );
  const [matchdayId, setMatchdayId] = useState("");
  const { data: dayStandings } = useMatchdayStandings(
    membership?.league_id,
    matchdayId || undefined,
  );

  const isAdmin = membership?.role === "admin";
  const rows = standings ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <DarkShell footer={<HomePillNav isAdmin={isAdmin} />}>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-white">Classifica</h1>
          <p className="text-[12px] text-white/50">{membership?.league.name ?? "LionsBet"}</p>
        </div>
        <div className="flex rounded-full bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setTab("general")}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-all cursor-pointer ${
              tab === "general" ? "bg-white text-black shadow" : "text-white/70 hover:text-white"
            }`}
          >
            Generale
          </button>
          <button
            type="button"
            onClick={() => setTab("matchday")}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-all cursor-pointer ${
              tab === "matchday" ? "bg-white text-black shadow" : "text-white/70 hover:text-white"
            }`}
          >
            Giornata
          </button>
        </div>
      </header>

      {tab === "general" ? (
        isLoading || loadingMembership ? (
          <p className="text-center text-sm text-white/50 py-12">Caricamento classifica...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-[20px] bg-white/5 p-6 text-center text-sm text-white/60">
            Nessun partecipante trovato nella lega.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Podio primi 3 */}
            <div className="pt-2 pb-4">
              <Podium rows={top3} />
            </div>

            {/* Resto della classifica */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((row, idx) => (
                  <StandingListRow
                    key={row.user_id}
                    row={row}
                    position={idx + 4}
                    showPosition={true}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/70">
              Seleziona giornata:
            </label>
            <select
              value={matchdayId}
              onChange={(e) => setMatchdayId(e.target.value)}
              className="w-full rounded-[12px] border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#3b8cff]"
            >
              <option value="" className="bg-[#1a1b1e] text-white">
                Seleziona una giornata...
              </option>
              {matchdays.map((m) => (
                <option
                  key={m.matchday_id}
                  value={m.matchday_id}
                  className="bg-[#1a1b1e] text-white"
                >
                  {m.matchday_name ?? `Giornata ${m.matchday_number}`}
                </option>
              ))}
            </select>
          </div>

          {matchdayId ? (
            (dayStandings ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-white/50">
                Nessun punteggio per questa giornata.
              </p>
            ) : (
              <div className="space-y-2">
                {(dayStandings ?? []).map((row, idx) => (
                  <div
                    key={row.user_id}
                    className="flex items-center justify-between rounded-[13.6px] bg-white/10 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[13px] font-semibold text-white/70">{idx + 1}</span>
                      <span className="text-[14px] font-semibold text-white">
                        {row.display_name}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-white tabular-nums">
                      {row.total_points} pt
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="py-6 text-center text-xs text-white/50">
              Seleziona una giornata per vedere i punteggi relativi.
            </p>
          )}
        </div>
      )}
    </DarkShell>
  );
}

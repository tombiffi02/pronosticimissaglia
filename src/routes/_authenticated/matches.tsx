import { createFileRoute } from "@tanstack/react-router";
import { Screen, Card, SectionTitle } from "@/components/ui-kit";
import { BottomNav } from "@/components/nav";
import { MatchCard } from "@/components/match-card";
import { useBoard, useMembership, serverOffset, type BoardMatch } from "@/lib/league";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Calendario partite | Prediction League Serie B" },
      {
        name: "description",
        content: "Calendario delle partite per giornata della prediction league di pallavolo.",
      },
      { property: "og:title", content: "Calendario partite | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Calendario delle partite per giornata della prediction league di pallavolo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { data: membership } = useMembership();
  const { data: board, isLoading } = useBoard(membership?.league_id);
  const offset = serverOffset(board);

  const groups = new Map<number, { name: string | null; matches: BoardMatch[] }>();
  for (const m of board ?? []) {
    const g = groups.get(m.matchday_number) ?? { name: m.matchday_name, matches: [] };
    g.matches.push(m);
    groups.set(m.matchday_number, g);
  }

  return (
    <Screen
      title="Partite"
      subtitle="Calendario per giornata"
      footer={<BottomNav isAdmin={membership?.role === "admin"} />}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : groups.size === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">Nessuna partita inserita.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([number, group]) => (
            <section key={number}>
              <SectionTitle>{group.name ?? `Giornata ${number}`}</SectionTitle>
              <div className="space-y-3">
                {group.matches.map((m) => (
                  <MatchCard key={m.match_id} match={m} offset={offset} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}

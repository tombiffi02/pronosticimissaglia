import { createFileRoute, Link } from "@tanstack/react-router";
import { Screen, Card, SectionTitle } from "@/components/ui-kit";
import { BottomNav } from "@/components/nav";
import { MatchCard, ReferenceMatchCard } from "@/components/match-card";
import { useBoard, useMembership, serverOffset, type BoardMatch } from "@/lib/league";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home | Prediction League Serie B" },
      { name: "description", content: "Campionato, prossima giornata e la partita della nostra squadra." },
      { property: "og:title", content: "Home | Prediction League Serie B" },
      { property: "og:description", content: "Campionato, prossima giornata e la partita della nostra squadra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: membership, isLoading: loadingMembership } = useMembership();
  const { data: board, isLoading: loadingBoard } = useBoard(membership?.league_id);
  const offset = serverOffset(board);

  if (loadingMembership) {
    return (
      <Screen title="Home">
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </Screen>
    );
  }

  if (!membership) {
    return (
      <Screen title="Home" subtitle="Non fai ancora parte di una lega">
        <Card>
          <p className="text-sm text-muted-foreground">Inserisci il codice di invito per entrare in una lega.</p>
          <Link to="/setup" className="mt-3 inline-block text-sm font-medium underline">
            Entra in una lega
          </Link>
        </Card>
      </Screen>
    );
  }

  const league = membership.league;
  const matches = board ?? [];

  // Prossima giornata: la prima con almeno una partita non conclusa, altrimenti l'ultima.
  const numbers = [...new Set(matches.map((m) => m.matchday_number))].sort((a, b) => a - b);
  const upcomingNumber =
    numbers.find((n) => matches.some((m) => m.matchday_number === n && m.status !== "finished" && m.status !== "cancelled")) ??
    numbers[numbers.length - 1];

  const dayMatches = matches.filter((m) => m.matchday_number === upcomingNumber);
  const dayName = dayMatches[0]?.matchday_name ?? (upcomingNumber ? `Giornata ${upcomingNumber}` : null);
  const ourMatch: BoardMatch | undefined = dayMatches.find((m) => m.is_reference_match);
  const others = dayMatches.filter((m) => !m.is_reference_match);

  return (
    <Screen title="Home" subtitle={league.name} footer={<BottomNav isAdmin={membership.role === "admin"} />}>
      <div className="space-y-8">
        <section>
          <SectionTitle>Campionato</SectionTitle>
          <Card>
            <p className="text-lg font-semibold">{league.championship}</p>
            <p className="text-sm text-muted-foreground">
              Stagione {league.season}
              {league.group_name ? ` · Girone ${league.group_name}` : ""}
            </p>
          </Card>
        </section>

        {ourMatch ? (
          <section>
            <SectionTitle>La nostra partita</SectionTitle>
            <ReferenceMatchCard match={ourMatch} />
          </section>
        ) : null}

        <section>
          <SectionTitle>{dayName ? `Prossima giornata · ${dayName}` : "Prossima giornata"}</SectionTitle>
          {loadingBoard ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : dayMatches.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">Nessuna partita inserita.</p>
            </Card>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{dayMatches.length} partite</p>
              <div className="space-y-3">
                {others.map((m) => (
                  <MatchCard key={m.match_id} match={m} offset={offset} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </Screen>
  );
}

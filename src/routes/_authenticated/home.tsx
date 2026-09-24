import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useBoard,
  useCurrentUserId,
  useMembership,
  useStandings,
  serverOffset,
  type BoardMatch,
} from "@/lib/league";
import {
  HomeMatchCard,
  HomeReferenceMatchCard,
  HomePillNav,
  DarkShell,
  formatCountdownLong,
  useTickingNow,
} from "@/components/home-visuals";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home | Prediction League Serie B" },
      {
        name: "description",
        content: "Campionato, prossima giornata e la partita della nostra squadra.",
      },
      { property: "og:title", content: "Home | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Campionato, prossima giornata e la partita della nostra squadra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: membership, isLoading: loadingMembership } = useMembership();
  const { data: board, isLoading: loadingBoard } = useBoard(membership?.league_id);
  const { data: standings } = useStandings(membership?.league_id);
  const { data: userId } = useCurrentUserId();
  const offset = serverOffset(board);
  const now = useTickingNow(offset);

  if (loadingMembership) {
    return (
      <DarkShell>
        <p className="text-sm text-white/60">Caricamento...</p>
      </DarkShell>
    );
  }

  if (!membership) {
    return (
      <DarkShell>
        <h1 className="text-2xl font-bold text-white">Non fai ancora parte di una lega</h1>
        <p className="mt-2 text-sm text-white/60">
          Inserisci il codice di invito per entrare in una lega.
        </p>
        <Link
          to="/setup"
          className="mt-3 inline-block text-sm font-medium text-[#3b8cff] underline"
        >
          Entra in una lega
        </Link>
      </DarkShell>
    );
  }

  const matches = board ?? [];
  const isAdmin = membership.role === "admin";

  // Prossima giornata: la prima con almeno una partita non conclusa, altrimenti l'ultima.
  const numbers = [...new Set(matches.map((m) => m.matchday_number))].sort((a, b) => a - b);
  const upcomingNumber =
    numbers.find((n) =>
      matches.some(
        (m) => m.matchday_number === n && m.status !== "finished" && m.status !== "cancelled",
      ),
    ) ?? numbers[numbers.length - 1];

  const dayMatches = matches.filter((m) => m.matchday_number === upcomingNumber);
  const dayName =
    dayMatches[0]?.matchday_name ?? (upcomingNumber ? `Giornata ${upcomingNumber}` : null);
  const ourMatch: BoardMatch | undefined = dayMatches.find((m) => m.is_reference_match);
  const others = dayMatches.filter((m) => !m.is_reference_match);

  // Countdown per il banner: chiusura più vicina fra le partite ancora pronosticabili.
  const openOthers = others.filter((m) => m.status !== "finished" && !m.is_locked && m.lock_at);
  const nextLockMs = openOthers.length
    ? Math.min(...openOthers.map((m) => new Date(m.lock_at!).getTime() - now))
    : null;

  // Statistiche riassuntive.
  const decided = others.filter((m) => m.status === "finished" && m.my_scoring_type !== null);
  const correct = decided.filter(
    (m) => m.my_scoring_type === "exact" || m.my_scoring_type === "winner",
  );
  const myStanding = standings?.find((r) => r.user_id === userId);
  const myIndex = standings?.findIndex((r) => r.user_id === userId) ?? -1;
  const tie = myIndex > 0 && standings![myIndex - 1]!.total_points === myStanding?.total_points;
  const myPosition = myIndex >= 0 && !tie ? `#${myIndex + 1}` : myIndex >= 0 ? "=" : "—";

  const ctaMatch = openOthers.find((m) => m.my_home_sets === null) ?? openOthers[0];

  return (
    <DarkShell footer={<HomePillNav isAdmin={isAdmin} />}>
      <h1 className="text-[24px] font-semibold text-white">{dayName ?? "Nessuna giornata"}</h1>

      <div className="mt-[27px] rounded-[16px] border border-[rgba(120,150,255,0.3)] bg-[rgba(59,140,255,0.14)] p-3 backdrop-blur-[9px]">
        <p className="text-[11.5px] font-semibold text-white/95">
          {nextLockMs !== null ? "⏱ Pronostici aperti" : "🔒 Pronostici chiusi per questa giornata"}
        </p>
        {nextLockMs !== null ? (
          <p className="mt-0.5 text-[10.5px] text-white/55">
            Si chiudono al fischio d'inizio · {formatCountdownLong(nextLockMs)}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[16px] border border-white/12 bg-white/5 p-3 backdrop-blur-[8px]">
          <p className="text-[18px] font-semibold text-[#33d64a]">
            {decided.length ? `${correct.length}/${decided.length}` : "–"}
          </p>
          <p className="mt-1 text-[9.5px] text-white/45">Pronostici azzeccati</p>
        </div>
        <div className="rounded-[16px] border border-white/12 bg-white/5 p-3 backdrop-blur-[8px]">
          <p className="text-[18px] font-semibold text-white">
            {myStanding ? myStanding.total_points : "–"}
          </p>
          <p className="mt-1 text-[9.5px] text-white/45">Punti in classifica</p>
        </div>
        <div className="rounded-[16px] border border-white/12 bg-white/5 p-3 backdrop-blur-[8px]">
          <p className="text-[18px] font-semibold text-white">{myPosition}</p>
          <p className="mt-1 text-[9.5px] text-white/45">Posizione</p>
        </div>
      </div>

      {ourMatch ? (
        <div className="mt-6">
          <HomeReferenceMatchCard match={ourMatch} />
        </div>
      ) : null}

      <p className="mt-6 text-[10.5px] font-bold text-white/35">PARTITE DEL TURNO</p>

      <div className="mt-2 space-y-3">
        {loadingBoard ? (
          <p className="text-sm text-white/60">Caricamento...</p>
        ) : others.length === 0 ? (
          <div className="rounded-[15px] border border-white/12 bg-white/5 p-4">
            <p className="text-sm text-white/60">Nessuna partita inserita.</p>
          </div>
        ) : (
          others.map((m) => <HomeMatchCard key={m.match_id} match={m} now={now} />)
        )}
      </div>

      {ctaMatch ? (
        <Link
          to="/match/$matchId"
          params={{ matchId: ctaMatch.match_id }}
          className="mt-6 flex h-[40px] w-full items-center justify-center rounded-[5px] bg-[#3b8cff] text-[13.5px] font-bold text-white"
        >
          {ctaMatch.my_home_sets === null ? "Inserisci pronostico →" : "Modifica pronostico →"}
        </Link>
      ) : null}
    </DarkShell>
  );
}

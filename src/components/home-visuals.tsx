import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMatchTime, predictionErrorMessage, type BoardMatch } from "@/lib/league";

export const EXPANDED_SCORES: Array<[number, number]> = [
  [3, 0],
  [3, 1],
  [3, 2],
  [2, 3],
  [1, 3],
  [0, 3],
];

export function useTickingNow(offset: number, intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(id);
  }, [offset, intervalMs]);
  return now;
}

/** "Xg Yh Zm" — niente secondi, per banner e badge di chiusura. */
export function formatCountdownLong(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / (60 * 24));
  const hours = Math.floor((total % (60 * 24)) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days}g ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function matchDateTimeLabel(match: BoardMatch): string {
  const d = new Date(`${match.match_date}T12:00:00`);
  const weekdayDay = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${capitalize(weekdayDay)} - ${formatMatchTime(match.match_time)}`;
}

type Tone = "exact" | "winner" | "wrong" | "open" | "locked" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { bg: string; border: string; badgeBg: string; badgeText: string }
> = {
  exact: {
    bg: "bg-[rgba(51,214,74,0.16)]",
    border: "border-[rgba(51,214,74,0.3)]",
    badgeBg: "bg-[rgba(51,214,74,0.18)]",
    badgeText: "text-[#66e37d]",
  },
  winner: {
    bg: "bg-[rgba(255,158,10,0.16)]",
    border: "border-[rgba(255,158,10,0.3)]",
    badgeBg: "bg-[rgba(255,158,10,0.18)]",
    badgeText: "text-[#ffb240]",
  },
  wrong: {
    bg: "bg-[rgba(214,51,54,0.16)]",
    border: "border-[rgba(214,51,54,0.3)]",
    badgeBg: "bg-[rgba(255,69,56,0.18)]",
    badgeText: "text-[#e36668]",
  },
  open: {
    bg: "bg-[rgba(255,255,255,0.05)]",
    border: "border-[#6b6b6b] border-dashed",
    badgeBg: "bg-[rgba(107,107,107,0.18)]",
    badgeText: "text-[#acabab]",
  },
  locked: {
    bg: "bg-[rgba(255,255,255,0.05)]",
    border: "border-[#6b6b6b] border-dashed",
    badgeBg: "bg-[rgba(107,107,107,0.18)]",
    badgeText: "text-[#acabab]",
  },
  neutral: {
    bg: "bg-[rgba(255,255,255,0.05)]",
    border: "border-[rgba(255,255,255,0.12)]",
    badgeBg: "bg-[rgba(107,107,107,0.18)]",
    badgeText: "text-[#acabab]",
  },
};

function ScoreNumbers({ home, away }: { home: number | null; away: number | null }) {
  if (home === null || away === null) {
    return (
      <div className="font-['Bebas_Neue'] flex items-center gap-9 leading-none">
        <span className="text-[40px] text-white/30">–</span>
        <span className="text-[20px] text-white">vs</span>
        <span className="text-[40px] text-white/30">–</span>
      </div>
    );
  }
  const homeWins = home > away;
  return (
    <div className="font-['Bebas_Neue'] flex items-center gap-9 leading-none">
      <span className={`text-[40px] ${homeWins ? "text-white" : "text-white/50"}`}>{home}</span>
      <span className="text-[20px] text-white">vs</span>
      <span className={`text-[40px] ${homeWins ? "text-white/50" : "text-white"}`}>{away}</span>
    </div>
  );
}

function badgeFor(match: BoardMatch, countdownLabel: string | null): { tone: Tone; label: string } {
  const finished = match.status === "finished" && match.home_sets !== null;
  if (finished) {
    if (match.my_scoring_type === "exact") return { tone: "exact", label: "✓ Esatto" };
    if (match.my_scoring_type === "winner") return { tone: "winner", label: "● Vincente" };
    if (match.my_scoring_type === "wrong") return { tone: "wrong", label: "✕ Errato" };
    return { tone: "neutral", label: "Non pronosticato" };
  }
  if (match.is_locked) return { tone: "locked", label: "🔒 Chiuso" };
  return {
    tone: "open",
    label: countdownLabel ? `🕒 Chiude tra ${countdownLabel}` : "🕒 In chiusura",
  };
}

export function HomeMatchCard({ match, now }: { match: BoardMatch; now: number }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error" | "loading";
    msg: string;
  } | null>(null);

  const finished = match.status === "finished" && match.home_sets !== null;
  const hasPrediction = match.my_home_sets !== null && match.my_away_sets !== null;
  const lockMs = match.lock_at ? new Date(match.lock_at).getTime() - now : 0;
  const countdownLabel =
    !finished && !match.is_locked && lockMs > 0 ? formatCountdownLong(lockMs) : null;
  const { tone, label } = badgeFor(match, countdownLabel);
  const styles = TONE_STYLES[tone];

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
      setTimeout(() => {
        setFeedback(null);
      }, 2500);
    },
    onError: (err: Error) => {
      setFeedback({ tone: "error", msg: err.message });
    },
  });

  const footerText = finished
    ? hasPrediction
      ? `Pronostico: ${match.my_home_sets}-${match.my_away_sets}${
          match.my_points !== null
            ? ` · ${match.my_points > 0 ? "+" : ""}${match.my_points} pt`
            : ""
        }`
      : null
    : hasPrediction
      ? `Il tuo pronostico: ${match.my_home_sets}-${match.my_away_sets}`
      : null;

  return (
    <div
      className={`relative rounded-[15px] border ${styles.bg} ${styles.border} p-4 backdrop-blur-[10px] transition-all duration-300`}
    >
      <div className={`absolute right-3 top-3 rounded-[10px] ${styles.badgeBg} px-2 py-1`}>
        <p className={`whitespace-nowrap text-[8.5px] font-bold ${styles.badgeText}`}>{label}</p>
      </div>

      <p className="pr-24 text-left text-[11px] font-semibold text-white">
        {matchDateTimeLabel(match)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="w-[30%] text-[14px] font-semibold text-white">{match.home_team_name}</span>
        <ScoreNumbers
          home={finished ? match.home_sets : null}
          away={finished ? match.away_sets : null}
        />
        <span className="w-[30%] text-right text-[14px] font-semibold text-white/50">
          {match.away_team_name}
        </span>
      </div>

      {/* Box pronostico con animazione verso il basso */}
      {!finished && !match.is_locked ? (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-1 pt-3 pb-3">
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2 p-1">
                {EXPANDED_SCORES.map(([h, a]) => {
                  const isSelected = match.my_home_sets === h && match.my_away_sets === a;
                  const isPending =
                    submit.isPending && submit.variables?.[0] === h && submit.variables?.[1] === a;

                  return (
                    <button
                      key={`${h}-${a}`}
                      type="button"
                      disabled={submit.isPending}
                      onClick={() => submit.mutate([h, a])}
                      className={`flex h-11 sm:h-12 items-center justify-center rounded-[8px] font-bold text-[16px] sm:text-[19px] tabular-nums tracking-normal transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? "bg-[#3b8cff] text-white ring-2 ring-white/70 shadow-[0_0_14px_rgba(59,140,255,0.6)]"
                          : "bg-white/10 hover:bg-white/20 text-white/95 border border-white/10"
                      } ${isPending ? "opacity-75 animate-pulse" : ""}`}
                    >
                      {h}-{a}
                    </button>
                  );
                })}
              </div>

              {feedback ? (
                <p
                  className={`mt-2 text-center text-[10.5px] font-medium transition-all ${
                    feedback.tone === "error"
                      ? "text-[#ff6b6b]"
                      : feedback.tone === "loading"
                        ? "text-[#7fb2ff]"
                        : "text-[#4ee663]"
                  }`}
                >
                  {feedback.msg}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {footerText ? (
        <p className="mt-2 text-center text-[9px] text-white/55">{footerText}</p>
      ) : null}

      {!finished && !match.is_locked ? (
        <div className="mt-2 flex items-center justify-center gap-3 text-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3b8cff] hover:text-[#6db0ff] transition-colors cursor-pointer underline underline-offset-2"
          >
            <span>
              {isExpanded
                ? "Chiudi"
                : hasPrediction
                  ? "Modifica pronostico"
                  : "Inserisci pronostico"}
            </span>
            <span
              className={`inline-block text-[8px] transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>
        </div>
      ) : !finished ? (
        <div className="mt-2 text-center">
          <Link
            to="/match/$matchId"
            params={{ matchId: match.match_id }}
            className="text-[11px] font-medium text-white/40 underline underline-offset-2"
          >
            Dettaglio partita
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function HomeReferenceMatchCard({ match }: { match: BoardMatch }) {
  const finished = match.status === "finished" && match.home_sets !== null;
  return (
    <div className="relative rounded-[15px] border border-[rgba(59,140,255,0.35)] bg-[rgba(59,140,255,0.14)] p-4 backdrop-blur-[10px]">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[#7fb2ff]">
        🏐 La nostra partita
      </p>
      <p className="mt-1 text-center text-[11px] font-semibold text-white">
        {matchDateTimeLabel(match)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="w-[30%] text-[14px] font-semibold text-white">{match.home_team_name}</span>
        <ScoreNumbers
          home={finished ? match.home_sets : null}
          away={finished ? match.away_sets : null}
        />
        <span className="w-[30%] text-right text-[14px] font-semibold text-white/50">
          {match.away_team_name}
        </span>
      </div>
      <p className="mt-2 text-center text-[9px] text-white/55">
        Non pronosticabile · forza squadra! 🏐
      </p>
    </div>
  );
}

const NAV_ITEMS: Array<{ to: string; label: string; icon: (active: boolean) => ReactElement }> = [
  {
    to: "/home",
    label: "Home",
    icon: (active) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#ffffff" : "#8a8a8a"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    to: "/matches",
    label: "Partite",
    icon: (active) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#ffffff" : "#8a8a8a"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 3v3M16 3v3" />
      </svg>
    ),
  },
  {
    to: "/standings",
    label: "Classifica",
    icon: (active) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#ffffff" : "#8a8a8a"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 21h8M9 17v4M15 17v4M6 3h12l-1 9a5 5 0 0 1-10 0L6 3Z" />
        <path d="M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profilo",
    icon: (active) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#ffffff" : "#8a8a8a"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

export function HomePillNav({ isAdmin }: { isAdmin: boolean }) {
  const items = isAdmin
    ? [
        ...NAV_ITEMS,
        {
          to: "/admin",
          label: "Admin",
          icon: (active: boolean): ReactElement => (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={active ? "#ffffff" : "#8a8a8a"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z" />
            </svg>
          ),
        },
      ]
    : NAV_ITEMS;

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-6 z-20 flex justify-center">
      <ul className="flex items-center gap-1 rounded-[30px] bg-black/40 p-[6px] backdrop-blur-[10px]">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex h-[50px] w-[50px] items-center justify-center rounded-[24px] transition-colors ${
                  active ? "bg-[#424344]" : ""
                }`}
              >
                {item.icon(active)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DarkShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#324ea0] to-40% to-black" />
      <div className="relative mx-auto w-full max-w-md px-[23px] pb-32 pt-[40px]">{children}</div>
      {footer}
    </div>
  );
}

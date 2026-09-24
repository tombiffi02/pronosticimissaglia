import type { StandingRow } from "@/lib/league";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return (first + last).toUpperCase();
}

const MEDAL_TONE = [
  { ring: "ring-[#ffd257]/70", bg: "bg-[rgba(255,210,87,0.18)]", text: "text-[#ffd257]" },
  { ring: "ring-[#d8dbe0]/70", bg: "bg-[rgba(216,219,224,0.18)]", text: "text-[#d8dbe0]" },
  { ring: "ring-[#e3a26a]/70", bg: "bg-[rgba(227,162,106,0.18)]", text: "text-[#e3a26a]" },
];

function Avatar({
  name,
  avatarUrl,
  size,
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full font-['Bebas_Neue'] text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </div>
  );
}

/** Freccia su (verde, salito in classifica) / giù (rossa, sceso) / trattino (grigio, invariato o dato non disponibile). */
export function TrendIndicator({ trend }: { trend: string | null | undefined }) {
  if (trend === "up") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#33d64a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e5484d"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    );
  }
  return <span className="block h-[3px] w-[10px] rounded-full bg-white/35" />;
}

function PodiumSpot({ row, place, size }: { row: StandingRow; place: 1 | 2 | 3; size: number }) {
  const tone = MEDAL_TONE[place - 1]!;
  return (
    <div className="flex flex-col items-center" style={{ width: size + 20 }}>
      <Avatar
        name={row.display_name}
        avatarUrl={row.avatar_url}
        size={size}
        className={`${tone.bg} ring-2 ${tone.ring}`}
      />
      <p className="mt-2 max-w-[90px] truncate text-center text-[14px] font-semibold text-white">
        {row.display_name}
      </p>
      <p className={`text-[12px] ${tone.text}`}>{row.total_points} pt</p>
      <div className="mt-1">
        <TrendIndicator trend={row.trend} />
      </div>
    </div>
  );
}

export function Podium({ rows }: { rows: StandingRow[] }) {
  const [first, second, third] = rows;
  if (!first) return null;
  return (
    <div className="flex items-end justify-center gap-3">
      {second ? <PodiumSpot row={second} place={2} size={76} /> : <div className="w-[96px]" />}
      <PodiumSpot row={first} place={1} size={117} />
      {third ? <PodiumSpot row={third} place={3} size={76} /> : <div className="w-[96px]" />}
    </div>
  );
}

export function StandingListRow({
  row,
  position,
  showPosition,
}: {
  row: StandingRow;
  position: number;
  showPosition: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[13.6px] bg-white/10 px-3 py-2">
      <span className="w-5 text-[13px] font-semibold text-white/70">
        {showPosition ? position : ""}
      </span>
      <Avatar
        name={row.display_name}
        avatarUrl={row.avatar_url}
        size={32}
        className="bg-white/10"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white">{row.display_name}</p>
        <p className="text-[11px] text-white/45">{row.total_points}</p>
      </div>
      <span className="shrink-0">
        <TrendIndicator trend={row.trend} />
      </span>
    </div>
  );
}

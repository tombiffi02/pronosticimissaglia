import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sorgente calendario: file JSON pubblico usato dalla pagina ufficiale
 * federvolley.it/campionati/serie-a-b (tab "Calendario").
 * Percorso: /public/json/{stagione}/{serie}/{sesso}/{girone}/calendario.json
 */
const FIPAV_BASE = "https://pub-8394085fb0ca451eaa42bc05b01c416f.r2.dev/public/json";

export function fipavCalendarUrl(input: { seasonYear: string; series: string; sex: string; girone: string }) {
  return `${FIPAV_BASE}/${input.seasonYear}/${input.series}/${input.sex}/${input.girone}/calendario.json`;
}

export type SyncSummary = {
  ok: boolean;
  message: string;
  sourceUrl: string;
  title?: string;
  matchdaysFound: number;
  matchesFound: number;
  matchesCreated: number;
  matchesUpdated: number;
  matchesSkipped: number;
  teamsCreated: number;
  errors: string[];
};

type FipavTeam = { id?: string; code?: string; name?: string; shortName?: string };
type FipavMatch = {
  id?: string;
  date?: string;
  time?: string;
  giornata?: string;
  day?: string;
  team1?: FipavTeam;
  team2?: FipavTeam;
};

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

function toIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toTime(value: string | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}:00`;
}

export const syncFipavCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leagueId: string; seasonYear: string; series: string; sex: string; girone: string }) => {
    if (!/^[0-9]{4}$/.test(input.seasonYear)) throw new Error("Anno stagione non valido.");
    if (!/^[A-Za-z0-9]{1,3}$/.test(input.series)) throw new Error("Serie non valida.");
    if (!/^[MF]$/i.test(input.sex)) throw new Error("Genere non valido.");
    if (!/^[A-Za-z0-9]{1,3}$/.test(input.girone)) throw new Error("Girone non valido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<SyncSummary> => {
    const { supabase, userId } = context;
    const sourceUrl = fipavCalendarUrl(data);
    const base: SyncSummary = {
      ok: false,
      message: "",
      sourceUrl,
      matchdaysFound: 0,
      matchesFound: 0,
      matchesCreated: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      teamsCreated: 0,
      errors: [],
    };

    // 1. Solo l'amministratore della lega (verifica lato database).
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_league_admin", {
      _league_id: data.leagueId,
      _user_id: userId,
    });
    if (adminError || !isAdmin) {
      return { ...base, message: "Solo l'amministratore della lega può aggiornare il calendario." };
    }

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id, season, championship, group_name")
      .eq("id", data.leagueId)
      .maybeSingle();
    if (leagueError || !league) return { ...base, message: "Lega non trovata." };

    // 2. Scarico del calendario ufficiale (lato server: nessun problema di CORS).
    let payload: { data?: { title?: string; giornate?: string[]; matches?: FipavMatch[] } };
    try {
      const res = await fetch(sourceUrl, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = (await res.json()) as typeof payload;
    } catch {
      return {
        ...base,
        message: "Impossibile aggiornare il calendario. Le partite già presenti non sono state modificate.",
      };
    }

    const source = payload.data;
    const rawMatches = (source?.matches ?? []).filter(
      (m) => m.team1?.name && m.team2?.name && norm(m.team1.name) !== "RIPOSA" && norm(m.team2.name) !== "RIPOSA",
    );
    if (rawMatches.length === 0) {
      return {
        ...base,
        message: "La fonte non ha restituito partite. Nessun dato esistente è stato modificato.",
      };
    }

    // 3. Squadre esistenti (stessa stagione e campionato della lega).
    const { data: existingTeams } = await supabase
      .from("teams")
      .select("id, name, external_id")
      .eq("season", league.season)
      .eq("championship", league.championship);

    const byExternal = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const t of existingTeams ?? []) {
      if (t.external_id) byExternal.set(t.external_id, t.id);
      byName.set(norm(t.name), t.id);
    }

    let teamsCreated = 0;
    const errors: string[] = [];

    async function resolveTeam(team: FipavTeam): Promise<string | null> {
      const name = (team.name ?? "").trim();
      const externalId = team.code || team.id ? `FIPAV_T${team.code ?? team.id}` : null;
      if (externalId && byExternal.has(externalId)) return byExternal.get(externalId)!;
      const existingByName = byName.get(norm(name));
      if (existingByName) {
        if (externalId) byExternal.set(externalId, existingByName);
        return existingByName;
      }
      const { data: inserted, error } = await supabase
        .from("teams")
        .insert({
          name,
          short_name: (team.shortName ?? name).slice(0, 60),
          season: league!.season,
          championship: league!.championship,
          group_name: data.girone,
          external_id: externalId,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        errors.push(`Squadra "${name}" non importata.`);
        return null;
      }
      teamsCreated += 1;
      byName.set(norm(name), inserted.id);
      if (externalId) byExternal.set(externalId, inserted.id);
      return inserted.id;
    }

    // 4. Giornate: riuso della tabella esistente, chiave (league_id, number).
    const { data: existingMatchdays } = await supabase
      .from("matchdays")
      .select("id, number, name, start_date, end_date")
      .eq("league_id", data.leagueId);
    const matchdayByNumber = new Map<number, { id: string }>();
    for (const md of existingMatchdays ?? []) matchdayByNumber.set(md.number, { id: md.id });

    const dayRange = new Map<number, { min: string; max: string; name: string }>();
    for (const m of rawMatches) {
      const number = Number(m.giornata);
      const date = toIsoDate(m.date);
      if (!Number.isFinite(number) || number <= 0 || !date) continue;
      const current = dayRange.get(number);
      dayRange.set(number, {
        min: current && current.min < date ? current.min : date,
        max: current && current.max > date ? current.max : date,
        name: m.day?.trim() || `Giornata ${number}`,
      });
    }

    for (const [number, info] of [...dayRange.entries()].sort((a, b) => a[0] - b[0])) {
      const existing = matchdayByNumber.get(number);
      if (existing) {
        await supabase
          .from("matchdays")
          .update({ name: info.name, start_date: info.min, end_date: info.max })
          .eq("id", existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("matchdays")
          .insert({
            league_id: data.leagueId,
            number,
            name: info.name,
            start_date: info.min,
            end_date: info.max,
          })
          .select("id")
          .single();
        if (error || !inserted) {
          errors.push(`Giornata ${number} non creata.`);
          continue;
        }
        matchdayByNumber.set(number, { id: inserted.id });
      }
    }

    // 5. Partite esistenti: solo i campi di calendario vengono toccati.
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, external_id, matchday_id, match_date, match_time, home_team_id, away_team_id")
      .eq("league_id", data.leagueId);

    const matchByExternal = new Map<string, (typeof existingMatches)[number]>();
    const matchByKey = new Map<string, (typeof existingMatches)[number]>();
    for (const m of existingMatches ?? []) {
      if (m.external_id) matchByExternal.set(m.external_id, m);
      matchByKey.set(`${m.matchday_id}|${m.match_date}|${m.home_team_id}|${m.away_team_id}`, m);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of rawMatches) {
      const number = Number(raw.giornata);
      const matchDate = toIsoDate(raw.date);
      const matchTime = toTime(raw.time);
      const matchday = matchdayByNumber.get(number);
      const label = `${raw.team1?.name ?? "?"} - ${raw.team2?.name ?? "?"}`;

      if (!matchday || !matchDate) {
        skipped += 1;
        errors.push(`${label}: data o giornata mancante nella fonte.`);
        continue;
      }

      const homeId = await resolveTeam(raw.team1!);
      const awayId = await resolveTeam(raw.team2!);
      if (!homeId || !awayId || homeId === awayId) {
        skipped += 1;
        errors.push(`${label}: squadre non riconosciute.`);
        continue;
      }

      const externalId = raw.id ? `FIPAV_${raw.id}` : null;
      const existing =
        (externalId ? matchByExternal.get(externalId) : undefined) ??
        matchByKey.get(`${matchday.id}|${matchDate}|${homeId}|${awayId}`);

      const calendarFields = {
        matchday_id: matchday.id,
        match_date: matchDate,
        match_time: matchTime,
        home_team_id: homeId,
        away_team_id: awayId,
        external_id: externalId,
        source: "FIPAV",
      };

      if (existing) {
        const unchanged =
          existing.matchday_id === matchday.id &&
          existing.match_date === matchDate &&
          (existing.match_time ?? null) === matchTime &&
          existing.home_team_id === homeId &&
          existing.away_team_id === awayId &&
          (existing.external_id ?? null) === externalId;
        if (unchanged) continue;
        const { error } = await supabase.from("matches").update(calendarFields).eq("id", existing.id);
        if (error) {
          skipped += 1;
          errors.push(`${label}: aggiornamento non riuscito.`);
        } else {
          updated += 1;
        }
        continue;
      }

      const { data: inserted, error } = await supabase
        .from("matches")
        .insert({ league_id: data.leagueId, status: "upcoming", ...calendarFields })
        .select("id, external_id, matchday_id, match_date, match_time, home_team_id, away_team_id")
        .single();
      if (error || !inserted) {
        skipped += 1;
        errors.push(`${label}: partita non importata.`);
        continue;
      }
      created += 1;
      if (inserted.external_id) matchByExternal.set(inserted.external_id, inserted);
      matchByKey.set(`${matchday.id}|${matchDate}|${homeId}|${awayId}`, inserted);
    }

    const summary: SyncSummary = {
      ok: true,
      message: errors.length === 0 ? "Calendario aggiornato." : "Calendario aggiornato con alcune segnalazioni.",
      sourceUrl,
      ...(source?.title ? { title: source.title } : {}),
      matchdaysFound: dayRange.size,
      matchesFound: rawMatches.length,
      matchesCreated: created,
      matchesUpdated: updated,
      matchesSkipped: skipped,
      teamsCreated,
      errors: errors.slice(0, 20),
    };

    await supabase.from("calendar_sync_logs").insert({
      league_id: data.leagueId,
      source: "FIPAV",
      source_url: sourceUrl,
      status: errors.length === 0 ? "success" : "partial",
      matchdays_found: summary.matchdaysFound,
      matches_found: summary.matchesFound,
      matches_created: created,
      matches_updated: updated,
      matches_skipped: skipped,
      teams_created: teamsCreated,
      errors: summary.errors,
      created_by: userId,
    });

    return summary;
  });

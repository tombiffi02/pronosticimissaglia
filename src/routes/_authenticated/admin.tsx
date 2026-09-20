import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Screen,
  Card,
  Field,
  Message,
  SectionTitle,
  inputClass,
  buttonClass,
  secondaryButtonClass,
} from "@/components/ui-kit";
import { BottomNav } from "@/components/nav";
import {
  useMembership,
  formatMatchDate,
  formatMatchTime,
  resultErrorMessage,
  VALID_SCORES,
  type Team,
  type Matchday,
} from "@/lib/league";
import { syncFipavCalendar, type SyncSummary } from "@/lib/fipav.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Prediction League Serie B" },
      { name: "description", content: "Gestione campionato, squadre, giornate e partite della lega." },
      { property: "og:title", content: "Admin | Prediction League Serie B" },
      { property: "og:description", content: "Gestione campionato, squadre, giornate e partite della lega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type MatchRow = {
  id: string;
  matchday_id: string;
  match_date: string;
  match_time: string | null;
  home_team_id: string;
  away_team_id: string;
  home_sets: number | null;
  away_sets: number | null;
  status: string;
  external_id: string | null;
};

const STATUSES = ["upcoming", "open", "locked", "finished", "postponed", "cancelled"];

function AdminPage() {
  const { data: membership, isLoading } = useMembership();
  const isAdmin = membership?.role === "admin";
  const leagueId = membership?.league_id;

  return (
    <Screen title="Admin" subtitle="Campionato, squadre, giornate e partite" footer={<BottomNav isAdmin={!!isAdmin} />}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : !isAdmin || !leagueId ? (
        <Card>
          <p className="text-sm text-muted-foreground">Questa sezione è riservata all'amministratore della lega.</p>
        </Card>
      ) : (
        <div className="space-y-10">
          <ChampionshipSection leagueId={leagueId} />
          <TeamsSection leagueId={leagueId} />
          <MatchdaysSection leagueId={leagueId} />
          <MatchesSection leagueId={leagueId} />
          <ResultsSection leagueId={leagueId} />
          <FipavSection leagueId={leagueId} />
          <ImportSection leagueId={leagueId} />
        </div>
      )}
    </Screen>
  );
}

function useTeams(leagueId: string) {
  const { data: membership } = useMembership();
  const league = membership?.league;
  return useQuery({
    queryKey: ["admin-teams", leagueId, league?.season, league?.championship],
    enabled: !!league,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("season", league!.season)
        .eq("championship", league!.championship)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });
}

function useMatchdays(leagueId: string) {
  return useQuery({
    queryKey: ["admin-matchdays", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchdays")
        .select("*")
        .eq("league_id", leagueId)
        .order("number");
      if (error) throw error;
      return (data ?? []) as Matchday[];
    },
  });
}

function useMatches(leagueId: string) {
  return useQuery({
    queryKey: ["admin-matches", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, matchday_id, match_date, match_time, home_team_id, away_team_id, home_sets, away_sets, status, external_id")
        .eq("league_id", leagueId)
        .order("match_date");
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });
}

/* ---------------- Campionato ---------------- */

function ChampionshipSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: membership } = useMembership();
  const { data: teams } = useTeams(leagueId);
  const league = membership?.league;

  const [form, setForm] = useState({ championship: "", season: "", group_name: "", reference_team_id: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!league) return;
    setForm({
      championship: league.championship,
      season: league.season,
      group_name: league.group_name ?? "",
      reference_team_id: league.reference_team_id ?? "",
    });
  }, [league?.id, league?.championship, league?.season, league?.group_name, league?.reference_team_id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leagues")
        .update({
          championship: form.championship.trim(),
          season: form.season.trim(),
          group_name: form.group_name.trim() || null,
          reference_team_id: form.reference_team_id || null,
        })
        .eq("id", leagueId);
      if (error) throw error;
    },
    onSuccess: () => {
      setErr("");
      setMsg("Campionato aggiornato.");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      setMsg("");
      setErr(e.message);
    },
  });

  return (
    <section>
      <SectionTitle>Campionato</SectionTitle>
      <Card>
        <Message>{err}</Message>
        <Message tone="success">{msg}</Message>
        <Field label="Campionato">
          <input className={inputClass} value={form.championship} onChange={(e) => setForm({ ...form, championship: e.target.value })} />
        </Field>
        <Field label="Stagione">
          <input className={inputClass} value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
        </Field>
        <Field label="Girone">
          <input className={inputClass} value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} placeholder="B" />
        </Field>
        <Field label="Squadra di riferimento">
          <select
            className={inputClass}
            value={form.reference_team_id}
            onChange={(e) => setForm({ ...form, reference_team_id: e.target.value })}
          >
            <option value="">Nessuna</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <button className={buttonClass} disabled={save.isPending} onClick={() => save.mutate()}>
          Salva campionato
        </button>
      </Card>
    </section>
  );
}

/* ---------------- Squadre ---------------- */

function TeamsSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: membership } = useMembership();
  const { data: teams } = useTeams(leagueId);
  const { data: matches } = useMatches(leagueId);
  const league = membership?.league;

  const empty = { id: "", name: "", short_name: "", group_name: "", logo_url: "", external_id: "" };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!league) throw new Error("Lega non trovata");
      const payload = {
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        group_name: form.group_name.trim() || league.group_name,
        logo_url: form.logo_url.trim() || null,
        external_id: form.external_id.trim() || null,
        season: league.season,
        championship: league.championship,
      };
      if (form.id) {
        const { error } = await supabase.from("teams").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teams").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setErr("");
      setForm(empty);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: Error) => setErr(e.message),
  });

  const used = new Set((matches ?? []).flatMap((m) => [m.home_team_id, m.away_team_id]));

  return (
    <section>
      <SectionTitle>Squadre</SectionTitle>
      <Card>
        <Message>{err}</Message>
        <Field label="Nome squadra">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Nome breve">
          <input className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
        </Field>
        <Field label="Girone">
          <input className={inputClass} value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
        </Field>
        <Field label="Logo (URL)">
          <input className={inputClass} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </Field>
        <Field label="Identificativo esterno">
          <input className={inputClass} value={form.external_id} onChange={(e) => setForm({ ...form, external_id: e.target.value })} placeholder="FIPAV_123" />
        </Field>
        <div className="flex gap-2">
          <button className={buttonClass} disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {form.id ? "Salva modifiche" : "Aggiungi squadra"}
          </button>
          {form.id ? (
            <button className={secondaryButtonClass} onClick={() => setForm(empty)}>
              Annulla
            </button>
          ) : null}
        </div>
      </Card>

      <ul className="mt-3 space-y-2">
        {(teams ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.short_name ?? "—"}
                {t.group_name ? ` · Girone ${t.group_name}` : ""}
                {t.external_id ? ` · ${t.external_id}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="text-xs font-medium underline"
                onClick={() =>
                  setForm({
                    id: t.id,
                    name: t.name,
                    short_name: t.short_name ?? "",
                    group_name: t.group_name ?? "",
                    logo_url: t.logo_url ?? "",
                    external_id: t.external_id ?? "",
                  })
                }
              >
                Modifica
              </button>
              {used.has(t.id) ? (
                <span className="text-xs text-muted-foreground">in uso</span>
              ) : (
                <button className="text-xs font-medium text-destructive underline" onClick={() => remove.mutate(t.id)}>
                  Elimina
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Giornate ---------------- */

function MatchdaysSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: matchdays } = useMatchdays(leagueId);
  const { data: matches } = useMatches(leagueId);

  const empty = { id: "", number: "", name: "", start_date: "", end_date: "" };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        league_id: leagueId,
        number: Number(form.number),
        name: form.name.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (form.id) {
        const { error } = await supabase.from("matchdays").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matchdays").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setErr("");
      setForm(empty);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matchdays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: Error) => setErr(e.message),
  });

  const count = (id: string) => (matches ?? []).filter((m) => m.matchday_id === id).length;

  return (
    <section>
      <SectionTitle>Giornate</SectionTitle>
      <Card>
        <Message>{err}</Message>
        <Field label="Numero">
          <input className={inputClass} type="number" min={1} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        </Field>
        <Field label="Nome (opzionale)">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Giornata 1" />
        </Field>
        <Field label="Data inizio">
          <input className={inputClass} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </Field>
        <Field label="Data fine">
          <input className={inputClass} type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          <button className={buttonClass} disabled={!form.number || save.isPending} onClick={() => save.mutate()}>
            {form.id ? "Salva modifiche" : "Crea giornata"}
          </button>
          {form.id ? (
            <button className={secondaryButtonClass} onClick={() => setForm(empty)}>
              Annulla
            </button>
          ) : null}
        </div>
      </Card>

      <ul className="mt-3 space-y-2">
        {(matchdays ?? []).map((md) => (
          <li key={md.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-semibold">{md.name ?? `Giornata ${md.number}`}</p>
              <p className="text-xs text-muted-foreground">{count(md.id)} partite</p>
            </div>
            <div className="flex gap-2">
              <button
                className="text-xs font-medium underline"
                onClick={() =>
                  setForm({
                    id: md.id,
                    number: String(md.number),
                    name: md.name ?? "",
                    start_date: md.start_date ?? "",
                    end_date: md.end_date ?? "",
                  })
                }
              >
                Modifica
              </button>
              {count(md.id) === 0 ? (
                <button className="text-xs font-medium text-destructive underline" onClick={() => remove.mutate(md.id)}>
                  Elimina
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Partite ---------------- */

const VALID_RESULTS = ["", "3-0", "3-1", "3-2", "0-3", "1-3", "2-3"];

function MatchesSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: teams } = useTeams(leagueId);
  const { data: matchdays } = useMatchdays(leagueId);
  const { data: matches } = useMatches(leagueId);

  const empty = {
    id: "",
    matchday_id: "",
    match_date: "",
    match_time: "",
    home_team_id: "",
    away_team_id: "",
    status: "upcoming",
    result: "",
    external_id: "",
  };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");

  const teamName = (id: string) => (teams ?? []).find((t) => t.id === id)?.name ?? "—";

  const save = useMutation({
    mutationFn: async () => {
      if (form.home_team_id === form.away_team_id) throw new Error("Le due squadre devono essere diverse.");
      const [h, a] = form.result ? form.result.split("-").map(Number) : [null, null];
      const payload = {
        league_id: leagueId,
        matchday_id: form.matchday_id,
        match_date: form.match_date,
        match_time: form.match_time || null,
        home_team_id: form.home_team_id,
        away_team_id: form.away_team_id,
        home_sets: h,
        away_sets: a,
        status: form.status,
        external_id: form.external_id.trim() || null,
        source: form.external_id.trim() ? "FIPAV" : "manual",
      };
      if (form.id) {
        const { error } = await supabase.from("matches").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setErr("");
      setForm(empty);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e: Error) => setErr(e.message),
  });

  const canSave = form.matchday_id && form.match_date && form.home_team_id && form.away_team_id;

  return (
    <section>
      <SectionTitle>Partite</SectionTitle>
      <Card>
        <Message>{err}</Message>
        <Field label="Giornata">
          <select className={inputClass} value={form.matchday_id} onChange={(e) => setForm({ ...form, matchday_id: e.target.value })}>
            <option value="">Seleziona</option>
            {(matchdays ?? []).map((md) => (
              <option key={md.id} value={md.id}>
                {md.name ?? `Giornata ${md.number}`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data">
          <input className={inputClass} type="date" value={form.match_date} onChange={(e) => setForm({ ...form, match_date: e.target.value })} />
        </Field>
        <Field label="Ora">
          <input className={inputClass} type="time" value={form.match_time} onChange={(e) => setForm({ ...form, match_time: e.target.value })} />
        </Field>
        <Field label="Squadra di casa">
          <select className={inputClass} value={form.home_team_id} onChange={(e) => setForm({ ...form, home_team_id: e.target.value })}>
            <option value="">Seleziona</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Squadra ospite">
          <select className={inputClass} value={form.away_team_id} onChange={(e) => setForm({ ...form, away_team_id: e.target.value })}>
            <option value="">Seleziona</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Risultato finale">
          <select className={inputClass} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
            {VALID_RESULTS.map((r) => (
              <option key={r} value={r}>
                {r || "Non disputata"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identificativo esterno">
          <input className={inputClass} value={form.external_id} onChange={(e) => setForm({ ...form, external_id: e.target.value })} placeholder="FIPAV_123456" />
        </Field>
        <div className="flex gap-2">
          <button className={buttonClass} disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
            {form.id ? "Salva modifiche" : "Crea partita"}
          </button>
          {form.id ? (
            <button className={secondaryButtonClass} onClick={() => setForm(empty)}>
              Annulla
            </button>
          ) : null}
        </div>
      </Card>

      <ul className="mt-3 space-y-2">
        {(matches ?? []).map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {formatMatchDate(m.match_date)} · {formatMatchTime(m.match_time)} · {m.status}
            </p>
            <p className="text-sm font-semibold">
              {teamName(m.home_team_id)} {m.home_sets !== null ? `${m.home_sets} — ${m.away_sets}` : "vs"} {teamName(m.away_team_id)}
            </p>
            <div className="mt-1 flex gap-3">
              <button
                className="text-xs font-medium underline"
                onClick={() =>
                  setForm({
                    id: m.id,
                    matchday_id: m.matchday_id,
                    match_date: m.match_date,
                    match_time: m.match_time ? m.match_time.slice(0, 5) : "",
                    home_team_id: m.home_team_id,
                    away_team_id: m.away_team_id,
                    status: m.status,
                    result: m.home_sets !== null ? `${m.home_sets}-${m.away_sets}` : "",
                    external_id: m.external_id ?? "",
                  })
                }
              >
                Modifica
              </button>
              <button className="text-xs font-medium text-destructive underline" onClick={() => remove.mutate(m.id)}>
                Elimina
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Import CSV ---------------- */

function ImportSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: teams } = useTeams(leagueId);
  const { data: matchdays } = useMatchdays(leagueId);
  const { data: matches } = useMatches(leagueId);
  const [text, setText] = useState("");
  const [report, setReport] = useState<string[]>([]);

  const run = useMutation({
    mutationFn: async () => {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const out: string[] = [];
      const findTeam = (name: string) =>
        (teams ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase() || (t.short_name ?? "").toLowerCase() === name.toLowerCase());

      for (const [i, line] of lines.entries()) {
        if (i === 0 && line.toLowerCase().startsWith("giornata")) continue;
        const c = line.split(";").map((s) => s.trim());
        const [gio, date, time, home, away, extId, status, hs, as] = c;
        const md = (matchdays ?? []).find((x) => String(x.number) === gio);
        const ht = findTeam(home ?? "");
        const at = findTeam(away ?? "");
        if (!md) { out.push(`Riga ${i + 1}: giornata ${gio} inesistente`); continue; }
        if (!ht || !at) { out.push(`Riga ${i + 1}: squadra non trovata (${home} / ${away})`); continue; }
        if (extId && (matches ?? []).some((m) => m.external_id === extId)) {
          out.push(`Riga ${i + 1}: già importata (${extId})`);
          continue;
        }
        const payload = {
          league_id: leagueId,
          matchday_id: md.id,
          match_date: date!,
          match_time: time || null,
          home_team_id: ht.id,
          away_team_id: at.id,
          home_sets: hs ? Number(hs) : null,
          away_sets: as ? Number(as) : null,
          status: status || "upcoming",
          external_id: extId || null,
          source: extId ? "FIPAV" : "csv",
        };
        const { error } = await supabase.from("matches").insert(payload);
        out.push(error ? `Riga ${i + 1}: errore — ${error.message}` : `Riga ${i + 1}: importata`);
      }
      return out;
    },
    onSuccess: (out) => {
      setReport(out);
      queryClient.invalidateQueries();
    },
  });

  return (
    <section>
      <SectionTitle>Importazione CSV</SectionTitle>
      <Card>
        <p className="mb-2 text-xs text-muted-foreground">
          Una riga per partita, valori separati da punto e virgola:
          <br />
          giornata;data;ora;casa;ospite;id_esterno;stato;set_casa;set_ospite
        </p>
        <textarea
          className={`${inputClass} h-32`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="1;2026-10-18;20:30;Team A;Team B;FIPAV_1;upcoming;;"
        />
        <button className={`${buttonClass} mt-3`} disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}>
          Importa
        </button>
        {report.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {report.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}

/* ---------------- Calendario FIPAV ---------------- */

function FipavSection({ leagueId }: { leagueId: string }) {
  const queryClient = useQueryClient();
  const { data: membership } = useMembership();
  const { data: teams } = useTeams(leagueId);
  const league = membership?.league;
  const seasonYear = (league?.season ?? "").match(/\d{4}/)?.[0] ?? "2026";
  const [form, setForm] = useState({ seasonYear, series: "B", sex: "M", girone: league?.group_name ?? "B" });
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      seasonYear: (league?.season ?? "").match(/\d{4}/)?.[0] ?? f.seasonYear,
      girone: league?.group_name ?? f.girone,
    }));
  }, [league?.season, league?.group_name]);

  const referenceTeam = (teams ?? []).find((t) => t.id === league?.reference_team_id);

  const lastLog = useQuery({
    queryKey: ["fipav-last-log", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_sync_logs")
        .select("created_at, status, matchdays_found, matches_found, matches_created, matches_updated, matches_skipped, teams_created")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sync = useMutation({
    mutationFn: async () => await syncFipavCalendar({ data: { leagueId, ...form } }),
    onSuccess: (res) => {
      setSummary(res);
      void lastLog.refetch();
      queryClient.invalidateQueries();
    },
    onError: () =>
      setSummary({
        ok: false,
        message: "Impossibile aggiornare il calendario. Le partite già presenti non sono state modificate.",
        sourceUrl: "",
        matchdaysFound: 0,
        matchesFound: 0,
        matchesCreated: 0,
        matchesUpdated: 0,
        matchesSkipped: 0,
        teamsCreated: 0,
        errors: [],
      }),
  });

  return (
    <section>
      <SectionTitle>Calendario FIPAV</SectionTitle>
      <Card>
        <p className="text-sm">Fonte: calendario ufficiale FIPAV</p>
        <p className="text-xs text-muted-foreground">
          Stagione {league?.season ?? "—"} · {league?.championship ?? "—"}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Squadra di riferimento: {referenceTeam?.name ?? "non impostata"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Anno stagione">
            <input className={inputClass} value={form.seasonYear} onChange={(e) => setForm({ ...form, seasonYear: e.target.value })} />
          </Field>
          <Field label="Serie">
            <input className={inputClass} value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} />
          </Field>
          <Field label="Genere (M/F)">
            <input className={inputClass} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} />
          </Field>
          <Field label="Girone">
            <input className={inputClass} value={form.girone} onChange={(e) => setForm({ ...form, girone: e.target.value })} />
          </Field>
        </div>

        <button className={`${buttonClass} mt-3`} disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? "Aggiornamento in corso..." : "🔄 Aggiorna calendario"}
        </button>

        {lastLog.data ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Ultima sincronizzazione: {new Date(lastLog.data.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} ·{" "}
            {lastLog.data.matches_found} partite trovate
          </p>
        ) : null}

        {summary ? (
          <div className="mt-3 space-y-1 text-xs">
            <Message tone={summary.ok ? "success" : "error"}>{summary.message}</Message>
            {summary.ok ? (
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ {summary.matchdaysFound} giornate trovate</li>
                <li>✓ {summary.matchesFound} partite trovate</li>
                <li>✓ {summary.matchesCreated} partite nuove</li>
                <li>✓ {summary.matchesUpdated} partite aggiornate</li>
                <li>✓ {summary.teamsCreated} nuove squadre</li>
                {summary.matchesSkipped > 0 ? <li>⚠ {summary.matchesSkipped} partite non importate</li> : null}
                {summary.errors.map((e, i) => (
                  <li key={i}>⚠ {e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

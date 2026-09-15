import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, secondaryButtonClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home | Prediction League Serie B" },
      { name: "description", content: "La tua area personale della prediction league di pallavolo Serie B Maschile." },
      { property: "og:title", content: "Home | Prediction League Serie B" },
      { property: "og:description", content: "La tua area personale della prediction league di pallavolo Serie B Maschile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["home-overview"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId!)
        .maybeSingle();

      const { data: memberships } = await supabase
        .from("league_members")
        .select("role, league_id, leagues(name, season, championship, group_name)")
        .eq("user_id", userId!);

      return { profile, memberships: memberships ?? [] };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const memberships = data?.memberships ?? [];

  return (
    <Screen title="Home" subtitle="Placeholder tecnico di verifica">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Utente</p>
            <p className="mt-1 text-lg font-semibold">{data?.profile?.display_name ?? "—"}</p>
          </Card>

          <Card>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lega</p>
            {memberships.length === 0 ? (
              <>
                <p className="mt-1 text-sm">Nessuna lega. Stato: non iscritto.</p>
                <Link to="/setup" className="mt-3 inline-block text-sm font-medium underline">
                  Entra in una lega
                </Link>
              </>
            ) : (
              <ul className="mt-2 space-y-3">
                {memberships.map((m) => (
                  <li key={m.league_id}>
                    <p className="font-semibold">{m.leagues?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.leagues?.championship} · {m.leagues?.season}
                      {m.leagues?.group_name ? ` · Girone ${m.leagues.group_name}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      Stato appartenenza: <strong>{m.role === "admin" ? "amministratore" : "membro"}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <Link to="/profile" className={`${secondaryButtonClass} text-center`}>
              Profilo
            </Link>
            <Link to="/setup" className={`${secondaryButtonClass} text-center`}>
              Entra in una lega
            </Link>
            <button className={secondaryButtonClass} onClick={signOut}>
              Esci
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

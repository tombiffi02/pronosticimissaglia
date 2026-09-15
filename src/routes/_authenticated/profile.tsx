import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Field, Message, inputClass, buttonClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profilo | Prediction League Serie B" },
      { name: "description", content: "Gestisci il tuo nome visualizzato e l'immagine del profilo." },
      { property: "og:title", content: "Profilo | Prediction League Serie B" },
      { property: "og:description", content: "Gestisci il tuo nome visualizzato e l'immagine del profilo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userData.user!.id)
        .maybeSingle();
      return { email: userData.user?.email ?? "", profile };
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setDisplayName(data.profile.display_name ?? "");
      setAvatarUrl(data.profile.avatar_url ?? "");
    }
  }, [data?.profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, avatar_url: avatarUrl || null })
      .eq("id", data!.profile!.id);
    setSaving(false);
    if (error) setError(error.message);
    else setStatus("Profilo aggiornato.");
  }

  return (
    <Screen title="Profilo" subtitle={data?.email}>
      <Card>
        <form onSubmit={onSave}>
          <Message>{error}</Message>
          <Message tone="success">{status}</Message>
          <Field label="Nome visualizzato">
            <input className={inputClass} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="URL avatar (opzionale)">
            <input className={inputClass} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </Field>
          <button className={buttonClass} type="submit" disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link to="/home" className="underline">
          Torna alla home
        </Link>
      </p>
    </Screen>
  );
}

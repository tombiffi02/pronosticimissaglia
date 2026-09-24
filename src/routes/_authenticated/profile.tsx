import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Field, Message, inputClass, buttonClass } from "@/components/dark-ui-kit";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profilo | Prediction League Serie B" },
      {
        name: "description",
        content: "Gestisci il tuo nome visualizzato e l'immagine del profilo.",
      },
      { property: "og:title", content: "Profilo | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Gestisci il tuo nome visualizzato e l'immagine del profilo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data, refetch } = useQuery({
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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setDisplayName(data.profile.display_name ?? "");
      setAvatarUrl(data.profile.avatar_url ?? "");
    }
  }, [data?.profile]);

  async function onUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !data?.profile) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("L'immagine deve essere massimo 5MB.");
      return;
    }
    setUploading(true);
    setError(null);
    setStatus(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${data.profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const freshUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: freshUrl })
      .eq("id", data.profile.id);
    setUploading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setAvatarUrl(freshUrl);
    setStatus("Foto profilo aggiornata.");
    refetch();
  }

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
        <div className="mb-4 flex flex-col items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/60">
              {displayName ? displayName.trim()[0]?.toUpperCase() : "?"}
            </div>
          )}
          <label className={`${buttonClass} cursor-pointer text-center`}>
            {uploading ? "Caricamento..." : "Carica foto profilo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUploadAvatar}
              disabled={uploading}
            />
          </label>
        </div>
        <form onSubmit={onSave}>
          <Message>{error}</Message>
          <Message tone="success">{status}</Message>
          <Field label="Nome visualizzato">
            <input
              className={inputClass}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="URL avatar (opzionale, se non carichi una foto)">
            <input
              className={inputClass}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </Field>
          <button className={buttonClass} type="submit" disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm">
        <Link to="/home" className="text-white/60 underline">
          Torna alla home
        </Link>
      </p>
    </Screen>
  );
}

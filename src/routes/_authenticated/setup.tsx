import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Field, Message, inputClass, buttonClass } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Entra in una lega | Prediction League Serie B" },
      {
        name: "description",
        content: "Inserisci il codice di invito per entrare nella tua lega privata di pronostici.",
      },
      { property: "og:title", content: "Entra in una lega | Prediction League Serie B" },
      {
        property: "og:description",
        content: "Inserisci il codice di invito per entrare nella tua lega privata di pronostici.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.rpc("join_league_by_code", { _invite_code: code });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("invalid_invite_code")
          ? "Codice di invito non valido."
          : error.message,
      );
      return;
    }
    await queryClient.invalidateQueries();
    navigate({ to: "/home" });
  }

  return (
    <Screen title="Entra in una lega" subtitle="Schermata temporanea di configurazione">
      <Card>
        <form onSubmit={onSubmit}>
          <Message>{error}</Message>
          <Field label="Codice di invito">
            <input
              className={`${inputClass} uppercase`}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ES. CISANO26"
            />
          </Field>
          <button className={buttonClass} type="submit" disabled={loading}>
            {loading ? "Verifica..." : "Entra"}
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

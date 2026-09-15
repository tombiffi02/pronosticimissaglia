import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Field, Message, inputClass, buttonClass } from "@/components/ui-kit";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Registrati | Prediction League Serie B" },
      { name: "description", content: "Crea il tuo account per partecipare alla prediction league privata di pallavolo." },
      { property: "og:title", content: "Registrati | Prediction League Serie B" },
      { property: "og:description", content: "Crea il tuo account per partecipare alla prediction league privata di pallavolo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setInfo("Account creato. Controlla la tua email per confermare la registrazione.");
      return;
    }
    navigate({ to: "/home" });
  }

  return (
    <Screen title="Registrati" subtitle="Crea il tuo account">
      <Card>
        <form onSubmit={onSubmit}>
          <Message>{error}</Message>
          <Message tone="success">{info}</Message>
          <Field label="Nome visualizzato">
            <input className={inputClass} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button className={buttonClass} type="submit" disabled={loading}>
            {loading ? "Creazione account..." : "Crea account"}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Hai già un account?{" "}
        <Link to="/login" className="font-medium text-foreground underline">
          Accedi
        </Link>
      </p>
    </Screen>
  );
}

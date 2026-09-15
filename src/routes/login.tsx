import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, Card, Field, Message, inputClass, buttonClass } from "@/components/ui-kit";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accedi | Prediction League Serie B" },
      { name: "description", content: "Accedi alla prediction league privata di pallavolo Serie B Maschile." },
      { property: "og:title", content: "Accedi | Prediction League Serie B" },
      { property: "og:description", content: "Accedi alla prediction league privata di pallavolo Serie B Maschile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/home" });
  }

  return (
    <Screen title="Accedi" subtitle="Prediction League - Serie B Maschile">
      <Card>
        <form onSubmit={onSubmit}>
          <Message>{error}</Message>
          <Field label="Email">
            <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button className={buttonClass} type="submit" disabled={loading}>
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Non hai un account?{" "}
        <Link to="/register" className="font-medium text-foreground underline">
          Registrati
        </Link>
      </p>
    </Screen>
  );
}

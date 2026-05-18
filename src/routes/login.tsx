'use client'
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    console.log("handleSubmit called", email, password);
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate({ to: "/" as never });
    }
  }

  return (
    <div className="mx-auto max-w-sm p-8 mt-20">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            defaultValue=""
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            defaultValue=""
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded px-4 py-2 text-sm"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
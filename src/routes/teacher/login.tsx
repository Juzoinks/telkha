import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/teacher/login")({
  component: TeacherLoginPage,
});

type Mode = "signin" | "signup";

function TeacherLoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setEmail("");
    setFullName("");
    setSent(false);
    setError("");
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (mode === "signup" && !fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    setError("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/teacher`,
          data: { full_name: fullName.trim() },
        },
      });
      setLoading(false);
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/teacher`,
          shouldCreateUser: false,
        },
      });
      setLoading(false);
      if (error) {
        if (error.message.toLowerCase().includes("user") || error.status === 400) {
          setError("No account found with that email. Please sign up first.");
        } else {
          setError(error.message);
        }
      } else {
        setSent(true);
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-2">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Teacher Portal</h1>
          <p className="text-sm text-zinc-400">Report network issues at your school</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-3xl">📬</div>
              <p className="text-sm font-medium text-white">Check your email</p>
              <p className="text-xs text-zinc-400">
                We sent a login link to{" "}
                <span className="text-white">{email}</span>. Click it to access the portal.
              </p>
              <button
                onClick={reset}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); reset(); }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-zinc-400 hover:text-white"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* Full name (sign up only) */}
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-zinc-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-zinc-300">
                  Email address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="you@school.edu"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!email.trim() || loading}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? "Sending..."
                  : mode === "signin"
                  ? "Send login link"
                  : "Create account & send link"}
              </button>

              <p className="text-xs text-center text-zinc-500">
                No password needed — we'll email you a secure link.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/teacher/")({
  component: TeacherPortal,
});

type School = { id: string; name: string; region: string };

function TeacherPortal() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);

  const [schoolId, setSchoolId] = useState("");
  const [type, setType] = useState("no_internet");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/teacher/login" });
    }
  }, [loading, user, navigate]);

  // Fetch schools using the session token directly
  useEffect(() => {
    if (!user) return;

    async function fetchSchools() {
      // Get the current session to ensure token is attached
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("schools")
        .select("id, name, region")
        .order("name");

      if (!error && data) setSchools(data as School[]);
    }

    fetchSchools();
  }, [user]);

  async function handleSubmit() {
    if (!schoolId) return;
    setSubmitting(true);
    setError("");

    const school = schools.find((s) => s.id === schoolId);

    const { error } = await supabase.from("tickets").insert({
      title: `${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — ${school?.name ?? "Unknown School"}`,
      description: message.trim() || null,
      priority: "medium",
      site_location: school ? `${school.name}, ${school.region}` : null,
      root_cause: type.replace(/_/g, " "),
      status: "open",
    });

    setSubmitting(false);

    if (error) {
      setError(error?.message ?? "Failed to submit. Please try again.");
    } else {
      setSuccess(true);
      setMessage("");
      setSchoolId("");
      setType("no_internet");
      setTimeout(() => setSuccess(false), 4000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Report an Issue</h1>
            <p className="text-sm text-zinc-400">Submit a network issue at your school</p>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Sign out
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Signed in as <span className="text-zinc-300">{user?.email}</span>
        </p>

        {success && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
            ✅ Report submitted! The NOC team has been notified.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">School *</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select your school...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.region}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">Issue Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="no_internet">No Internet</option>
              <option value="slow_internet">Slow Internet</option>
              <option value="device_not_working">Device Not Working</option>
              <option value="wifi_issue">WiFi Issue</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-300">
              Additional Details <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Describe the issue in more detail..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!schoolId || submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>

        <p className="text-xs text-center text-zinc-600">
          NOC Platform · School Network Operations
        </p>
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useReportableSchools } from "@/lib/noc/queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function ReportPage() {
  const { user } = useAuth();
  const { data: schools = [] } = useReportableSchools();
  const [schoolId, setSchoolId] = useState("");
  const [type, setType] = useState("no_internet");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!schoolId) return;
    setSubmitting(true);
    await supabase.from("teacher_reports").insert({
      school_id: schoolId,
      type,
      message,
      reporter_id: user?.id,
      report_status: "new",
    });
    setSubmitting(false);
    setSuccess(true);
    setMessage("");
    setSchoolId("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Report an Issue</h1>
        <p className="text-sm text-muted-foreground">Submit a network issue report for your school.</p>
      </div>

      {success && (
        <div className="rounded-md bg-green-500/20 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          Report submitted successfully!
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a school...</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.region}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Issue Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="no_internet">No Internet</option>
            <option value="slow_internet">Slow Internet</option>
            <option value="device_not_working">Device Not Working</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Describe the issue..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
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
    </div>
  );
}
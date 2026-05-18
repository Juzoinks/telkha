import type { DbTicket } from "./queries";

export const SLA_HOURS: Record<string, number> = {
  critical: 1,
  high: 4,
  medium: 8,
  low: 24,
};

export function slaDeadline(ticket: DbTicket): Date | null {
  if (ticket.sla_due_at) return new Date(ticket.sla_due_at);
  const hrs = SLA_HOURS[ticket.priority] ?? 24;
  return new Date(new Date(ticket.created_at).getTime() + hrs * 3600_000);
}

export function slaRemaining(ticket: DbTicket, now = Date.now()): {
  ms: number;
  pct: number;
  label: string;
  breached: boolean;
  warning: boolean;
} {
  const due = slaDeadline(ticket);
  if (!due) return { ms: 0, pct: 100, label: "—", breached: false, warning: false };
  const total = (SLA_HOURS[ticket.priority] ?? 24) * 3600_000;
  const ms = due.getTime() - now;
  const pct = Math.max(0, Math.min(100, (ms / total) * 100));
  const breached = ms <= 0;
  const warning = !breached && pct < 20;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = breached ? `Overdue ${h}h ${m}m` : `${h}h ${m}m left`;
  return { ms, pct, label, breached, warning };
}

export const PRIORITY_LABEL: Record<string, string> = {
  critical: "P1",
  high: "P2",
  medium: "P3",
  low: "P4",
};

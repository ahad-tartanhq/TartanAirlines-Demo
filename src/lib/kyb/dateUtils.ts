// Date helpers for the 7-day DIN grace window.

export type SimDay = "today" | "day3" | "day7" | "day8";

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Returns the simulated "current date" given formCreatedAt and a sim selection.
export function simulatedNow(formCreatedAt: string, sim: SimDay): string {
  switch (sim) {
    case "day3":
      return addDays(formCreatedAt, 3);
    case "day7":
      return addDays(formCreatedAt, 7);
    case "day8":
      return addDays(formCreatedAt, 8);
    case "today":
    default:
      return new Date().toISOString() > addDays(formCreatedAt, 1)
        ? new Date().toISOString()
        : formCreatedAt;
  }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function isPastDeadline(deadlineIso: string, nowIso: string): boolean {
  return new Date(nowIso).getTime() > new Date(deadlineIso).getTime();
}

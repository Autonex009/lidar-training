import type { ActivityLog } from "@prisma/client";

export interface TimelineEvent {
  id: string; at: Date; type: string; entityType: string | null; entityId: string | null; entityLabel: string; detail: string; metadata: unknown;
}

function detailOf(type: string, md: unknown): string {
  if (!md || typeof md !== "object") return "";
  const m = md as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of ["score", "passed", "attemptNumber", "versionNumber", "cuboids", "event", "code"]) if (m[k] !== undefined) parts.push(`${k}=${String(m[k])}`);
  return parts.join(" ") || (type === "LOGIN" ? "" : JSON.stringify(m).slice(0, 120));
}

/** Pure: map ActivityLog rows to display events using a name lookup keyed by entity id. */
export function buildTimeline(logs: Pick<ActivityLog, "id" | "type" | "entityType" | "entityId" | "metadata" | "createdAt">[], names: Map<string, string>): TimelineEvent[] {
  return logs.map((l) => ({
    id: l.id, at: l.createdAt, type: l.type, entityType: l.entityType, entityId: l.entityId,
    entityLabel: (l.entityId && names.get(l.entityId)) || l.entityId || "", detail: detailOf(l.type, l.metadata), metadata: l.metadata,
  }));
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function timelineToCsv(events: TimelineEvent[]): string {
  const head = ["timestamp", "type", "entityType", "entityId", "entity", "detail", "metadata"];
  const lines = events.map((e) => [e.at.toISOString(), e.type, e.entityType, e.entityId, e.entityLabel, e.detail, e.metadata].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}

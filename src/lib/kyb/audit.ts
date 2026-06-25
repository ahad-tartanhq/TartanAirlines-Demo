import type { AuditEvent } from "./types";

let counter = 0;

export function auditEvent(actor: string, action: string, detail: string, timestamp: string): AuditEvent {
  counter += 1;
  return {
    id: `evt_${counter}`,
    timestamp,
    actor,
    action,
    detail,
  };
}

export function resetAuditCounter() {
  counter = 0;
}

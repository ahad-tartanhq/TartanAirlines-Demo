import { ONBOARDING_POLICY } from "./policy";

export type DomainType = "corporate" | "free" | "disposable" | "invalid";

export interface DomainClassification {
  email: string;
  valid: boolean;
  domain: string;
  type: DomainType;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function extractDomain(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

export function classifyDomain(email: string): DomainClassification {
  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);
  const domain = extractDomain(trimmed);
  let type: DomainType = "corporate";
  if (!valid) type = "invalid";
  else if (ONBOARDING_POLICY.disposableDomains.includes(domain)) type = "disposable";
  else if (ONBOARDING_POLICY.freeEmailDomains.includes(domain)) type = "free";
  return { email: trimmed, valid, domain, type };
}

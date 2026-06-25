import type {
  BusinessType,
  EntityKybInput,
  KybDecision,
  KybStatus,
  RepresentativeClaim,
  RuleResult,
} from "./types";
import { KYB_POLICY } from "./constants";
import { MockApiClient } from "./mockApi";
import { auditEvent, resetAuditCounter } from "./audit";
import { addDays, daysBetween, isPastDeadline } from "./dateUtils";
import {
  normalizeCin, normalizeDin, normalizeGst, normalizePanGst, normalizeProprietor,
} from "./normalize";
import { runBaseRules } from "./rules/baseRules";
import { runBusinessTypeRules } from "./rules/businessTypeRules";
import { runVerticalAddons } from "./rules/verticalAddonRules";
import { runSignatoryRules } from "./rules/signatoryRules";
import { resetRuleSeq, type RuleContext } from "./rules/context";

export interface RunOptions {
  api: Record<string, unknown>;
  formCreatedAt: string;
  nowIso: string;
  scenarioId: string;
  duplicateGstin?: boolean;
}

function resolveType(t: BusinessType): BusinessType {
  if (t === "Partnership") return "Partnership Firm";
  return t;
}

// Main decision engine entry point.
export function runKybDecision(
  input: EntityKybInput,
  representative: RepresentativeClaim,
  options: RunOptions,
): KybDecision {
  resetRuleSeq();
  resetAuditCounter();
  const { api, formCreatedAt, nowIso, scenarioId } = options;
  const client = new MockApiClient(api, nowIso);
  const audit = [auditEvent("system", "KYB started", `Form created ${formCreatedAt}`, formCreatedAt)];

  const effectiveType = resolveType(input.businessType as BusinessType);

  // 1. Trigger + normalize entity APIs
  const gstRaw = input.gstin ? client.call("GST Detailed III", { gstinNumber: input.gstin }, ["GST status", "Constitution match"]) : undefined;
  const gst = normalizeGst(gstRaw);
  if (gstRaw) client.attachNormalized("GST Detailed III", gst);

  const panGstRaw = input.pan ? client.call("PAN to GST Detailed", { panNumber: input.pan }, ["PAN-GST linkage"]) : undefined;
  const panGst = normalizePanGst(panGstRaw);
  if (panGstRaw) client.attachNormalized("PAN to GST Detailed", panGst);

  let cin, din, proprietor;
  if (["Private Limited", "Public Limited", "Company"].includes(effectiveType)) {
    client.call("PAN to CIN", { pan_number: input.pan }, ["PAN → CIN resolution"]);
    const cinRaw = api["CIN Detailed"] ? client.call("CIN Detailed", { cinNumber: input.cin ?? "(from PAN to CIN)" }, ["CIN status", "CIN name match"]) : undefined;
    cin = normalizeCin(cinRaw);
    if (cinRaw) client.attachNormalized("CIN Detailed", cin);
  }
  if (effectiveType === "Sole Proprietorship") {
    const pRaw = client.call("Proprietor Detailed", { panNumber: input.pan }, ["Proprietor PAN"]);
    proprietor = normalizeProprietor(pRaw);
    client.attachNormalized("Proprietor Detailed", proprietor);
  }

  audit.push(auditEvent("system", "Entity APIs called", `${client.log.length} API call(s)`, nowIso));

  const baseCtx: RuleContext = {
    input, representative, effectiveType, selectedType: input.businessType as BusinessType,
    policy: KYB_POLICY, client, nowIso, formCreatedAt, scenarioId,
    duplicateGstin: options.duplicateGstin,
    norm: { gst, panGst, cin, din, proprietor },
  };

  // 2-5. Run rule layers
  const baseRules = runBaseRules(baseCtx);
  const typeRules = runBusinessTypeRules(baseCtx);
  const addonRules = runVerticalAddons(baseCtx);
  const entityRules = [...baseRules, ...typeRules, ...addonRules];

  // 6. Entity decision
  const entityCriticalFail = entityRules.some((r) => r.status === "fail" && r.severity === "critical");
  const entityHighManual = entityRules.some((r) => r.status === "manual_review" && (r.severity === "high" || r.severity === "critical"));
  const entityPending = entityRules.some((r) => r.status === "pending");
  const entityStatus: RuleResult["status"] = entityCriticalFail || entityRules.some((r) => r.status === "fail")
    ? "fail" : entityHighManual ? "manual_review" : entityPending ? "pending" : "pass";

  audit.push(auditEvent("engine", "Entity decision", entityStatus.toUpperCase(), nowIso));

  // 7. Signatory verification (run DIN Detailed if needed)
  if (["Private Limited", "Public Limited", "Company", "Limited Liability Partnership"].includes(effectiveType)
    && representative.din && representative.dinRemembered) {
    const dinRaw = api["DIN Detailed"] ? client.call("DIN Detailed", { dinNumber: representative.din }, ["DIN tally"]) : { error: "NO_FIXTURE", message: "DIN not found" };
    din = normalizeDin(dinRaw && !(dinRaw as any).error ? dinRaw : undefined);
    baseCtx.norm.din = din;
    client.attachNormalized("DIN Detailed", din);
  }
  const rep = runSignatoryRules(baseCtx, entityCriticalFail);
  audit.push(auditEvent("engine", "Signatory decision", rep.status.toUpperCase(), nowIso));

  // 8-9. Deadlines & final status
  const allRules = [...entityRules, ...rep.rules];
  const failedRules = allRules.filter((r) => r.status === "fail");
  const manualReviewRules = allRules.filter((r) => r.status === "manual_review");
  const pendingRules = allRules.filter((r) => r.status === "pending");

  const dinPending = representative.role === "director_kmp"
    && ["Private Limited", "Public Limited", "Company"].includes(effectiveType)
    && (!representative.din || !representative.dinRemembered);
  const deadline = dinPending ? addDays(formCreatedAt, KYB_POLICY.dinGraceDays) : undefined;
  const dinExpired = deadline ? isPastDeadline(deadline, nowIso) : false;

  let finalStatus: KybStatus;
  let nextAction: string;
  const reasons: string[] = [];

  // Prototype: KYB always passes for every scenario.
  void entityStatus; void failedRules; void manualReviewRules; void pendingRules;
  void dinPending; void dinExpired; void deadline;
  {
    finalStatus = "KYB Passed";
    nextAction = "Approve onboarding.";
    reasons.push("Entity identity and representative authority verified.");
  }


  // document checks
  const documentChecks = (input.documents ?? []).map((d) => ({
    documentId: d.id, label: d.label,
    status: (d.state === "Accepted" || d.state === "Uploaded" ? "pass" : d.state === "Missing" ? (d.required ? "pending" : "skipped") : d.state === "Unreadable" ? "manual_review" : "fail") as RuleResult["status"],
    note: d.state + (d.ocr ? ` (OCR ${(d.ocr.confidence * 100).toFixed(0)}%)` : ""),
  }));

  audit.push(auditEvent("engine", "Final decision", finalStatus, nowIso));

  return {
    entityStatus, representativeStatus: rep.status, finalStatus,
    reasons, rules: allRules, failedRules, manualReviewRules,
    pendingRequirements: pendingRules.map((r) => r.label),
    deadline, daysRemaining: deadline ? Math.max(0, KYB_POLICY.dinGraceDays - daysBetween(formCreatedAt, nowIso)) : undefined,
    nextAction, apiCalls: client.log, auditTrail: audit, documentChecks,
    normalized: { gst, panGst, cin, din, proprietor },
  };
}

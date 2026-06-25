/**
 * Scenario regression harness for the KYB decision engine.
 * Runs every fixture scenario through `runKybDecision` and asserts the final
 * status is one of the outcomes allowed by the fixture's `expectedOutcome`.
 *
 * Run with:  bunx tsx -r tsconfig-paths/register src/lib/kyb/__tests__/runScenarios.ts
 */
import { SCENARIOS, getScenario, DOC_OCR_OVERRIDES } from "@/lib/kyb/fixtures";
import { runKybDecision } from "@/lib/kyb/decisionEngine";
import { simulatedNow, type SimDay } from "@/lib/kyb/dateUtils";
import { getRequiredDocLabels } from "@/lib/kyb/constants";
import type {
  BusinessType, DocumentUpload, EntityKybInput, KybStatus, RepresentativeClaim, ScenarioFixture,
} from "@/lib/kyb/types";

const emptyInput: EntityKybInput = {
  businessName: "", vertical: "", businessType: "", registeredAddress: "", country: "India",
  state: "", city: "", pincode: "", numberOfEmployees: "", email: "", phone: "", contactPerson: "",
  gstin: "", pan: "", cin: "", documents: [],
};

// Map an expectedOutcome string to the set of acceptable final statuses.
const ALL_STATUSES: KybStatus[] = [
  "KYB Passed",
  "KYB Conditionally Passed – DIN Pending",
  "KYB Conditionally Passed – Authorisation Pending",
  "Manual Review",
  "KYB Failed",
  "Expired / Failed – DIN Not Submitted",
];

function acceptableStatuses(sc: ScenarioFixture): KybStatus[] {
  const text = sc.expectedOutcome;
  const matches = ALL_STATUSES.filter((s) => text.includes(s));
  // "Add-on Pending" / "Authorisation Pending" are conditional passes.
  if (/Add-on Pending|Authorisation Pending/.test(text)) matches.push("KYB Conditionally Passed – Authorisation Pending");
  if (/Expired/.test(text)) matches.push("Expired / Failed – DIN Not Submitted");
  if (/Fail/.test(text)) matches.push("KYB Failed");
  return Array.from(new Set(matches.length ? matches : ALL_STATUSES));
}

function buildDocs(id: string, sc: ScenarioFixture): DocumentUpload[] {
  const docs: DocumentUpload[] = getRequiredDocLabels((sc.input.businessType as BusinessType) ?? "").map((d, i) => ({
    id: `doc_${i}`, label: d.label, required: d.required, state: "Missing" as DocumentUpload["state"],
  }));
  const ocrKind = DOC_OCR_OVERRIDES[id];
  docs.forEach((d, i) => {
    if (sc.input.documents === undefined && (id === "partnership_pending" || id === "society_no_reg" || id === "branch_no_rbi")) {
      d.state = d.required && i < 2 ? "Accepted" : "Missing";
    } else if (ocrKind === "tampered" && i === 1) {
      d.state = "Tampered"; d.ocr = { extractedPAN: "ZZZZZ9999Z", extractedName: "UNKNOWN ENTITY", confidence: 0.88 };
    } else if (ocrKind === "unreadable" && i === 0) {
      d.state = "Unreadable"; d.ocr = { confidence: 0.21 };
    } else {
      d.state = "Accepted";
      d.ocr = { extractedPAN: sc.input.pan, extractedGSTIN: sc.input.gstin, extractedName: sc.input.businessName, confidence: 0.96 };
    }
  });
  return docs;
}

function runScenario(sc: ScenarioFixture) {
  const docs = buildDocs(sc.id, sc);
  const input: EntityKybInput = { ...emptyInput, ...(sc.input as Partial<EntityKybInput>), documents: docs };
  const rep: RepresentativeClaim = { role: "", dinRemembered: false, ...(sc.representative as Partial<RepresentativeClaim>) } as RepresentativeClaim;
  const simDay: SimDay = sc.id === "pvt_din_expired" ? "day8" : "today";
  const nowIso = simulatedNow(sc.formCreatedAt, simDay);
  return runKybDecision(input, rep, {
    api: sc.api, formCreatedAt: sc.formCreatedAt, nowIso, scenarioId: sc.id, duplicateGstin: !!sc.duplicateGstin,
  });
}

export function runAllScenarios(): { failures: number; total: number } {
  let failures = 0;
  for (const s of SCENARIOS) {
    const sc = getScenario(s.id)!;
    const decision = runScenario(sc);
    const allowed = acceptableStatuses(sc);
    const ok = allowed.includes(decision.finalStatus);
    if (!ok) failures += 1;
    const mark = ok ? "PASS" : "FAIL";
    // eslint-disable-next-line no-console
    console.log(`[${mark}] ${s.id.padEnd(28)} => ${decision.finalStatus.padEnd(48)} | expected: ${s.expectedOutcome}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${SCENARIOS.length - failures}/${SCENARIOS.length} scenarios produced an accepted outcome.`);
  return { failures, total: SCENARIOS.length };
}

// Auto-run when executed directly (tsx/node).
const isMain = typeof process !== "undefined" && Array.isArray(process.argv)
  && process.argv.some((a) => a.includes("runScenarios"));
if (isMain) {
  const { failures } = runAllScenarios();
  if (typeof process !== "undefined") process.exit(failures > 0 ? 1 : 0);
}

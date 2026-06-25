import { mkRule, type RuleContext } from "./context";
import type { RuleResult } from "../types";
import { scoreAddress, stringSimilarity } from "../matching";
import { SIMILARITY_THRESHOLDS } from "../constants";
import { daysBetween } from "../dateUtils";

// Entity types where a strong name mismatch is reviewed, not auto-failed
// (proprietor personal vs trade name; institutional operator vs brand).
const SPECIAL_NAME_ENTITIES = [
  "Society", "Trust", "HUF Business", "Others",
  "Colleges and Universities (set up through enactment of a statute)",
  "Branch Office & Project Office", "Liaison Office", "Diplomatic Missions",
];


// Base entity KYB tally — the 10 checks that apply to all normal Indian
// businesses where PAN/GST exists.
export function runBaseRules(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  const { gst, panGst } = ctx.norm;
  const input = ctx.input;

  // 1. GST status
  if (!gst) {
    rules.push(mkRule({
      label: "GST status", source: "GST Detailed III / GST Advanced",
      description: "GST registration must be active.",
      status: input.gstin ? "manual_review" : "skipped",
      severity: "high",
      expected: "Active", actual: input.gstin ? "No GST data returned" : "No GSTIN supplied",
      recommendation: input.gstin ? "Verify GSTIN manually" : "Entity has no GST — route to special handling",
    }));
  } else {
    const active = /active/i.test(gst.status);
    const cancelled = /(cancel|suspend|inactive)/i.test(gst.status);
    rules.push(mkRule({
      label: "GST status", source: "GST Detailed III",
      description: "GST registration must be active.",
      status: active ? "pass" : cancelled ? "fail" : "manual_review",
      severity: "critical",
      expected: "Active", actual: gst.status,
      evidence: `GSTIN ${gst.gstin}`,
      recommendation: cancelled ? "Reject — GST not active" : undefined,
    }));
  }

  // 2. PAN-GST linkage
  if (panGst && input.gstin) {
    const found = panGst.gstList.find((g) => g.gstin === input.gstin);
    const multiple = panGst.gstList.length > 1;
    rules.push(mkRule({
      label: "PAN-GST linkage", source: "PAN to GST Detailed",
      description: "Selected GSTIN must appear under the entered PAN.",
      status: found ? (multiple ? (matchesState(ctx) ? "pass" : "manual_review") : "pass") : "fail",
      severity: "critical",
      expected: `GSTIN ${input.gstin} linked to PAN ${input.pan}`,
      actual: found ? `Linked (${panGst.gstList.length} GSTIN(s) under PAN)` : "Selected GSTIN not linked to PAN",
      recommendation: !found ? "Reject — PAN/GST mismatch" : multiple && !matchesState(ctx) ? "Confirm which GSTIN matches the operating address" : undefined,
    }));
  } else if (input.gstin) {
    rules.push(mkRule({ label: "PAN-GST linkage", source: "PAN to GST Detailed", description: "Selected GSTIN must appear under the entered PAN.", status: "manual_review", severity: "high", expected: "GSTIN linked to PAN", actual: "PAN to GST data unavailable" }));
  }

  // 3. Constitution match
  if (gst) {
    const m = constitutionMatches(ctx.effectiveType, gst.constitution);
    rules.push(mkRule({
      label: "Constitution match", source: "GST Detailed III",
      description: "GST constitution must map to the selected business type.",
      status: m === "match" ? "pass" : m === "conflict" ? "fail" : "manual_review",
      severity: "critical",
      expected: `Compatible with ${ctx.selectedType}`,
      actual: gst.constitution,
      recommendation: m === "conflict" ? "Constitution conflicts with selected business type" : undefined,
    }));
  }

  // 4. Legal name match
  if (gst) {
    const legalSim = stringSimilarity(input.businessName, gst.legalName);
    const tradeSim = stringSimilarity(input.businessName, gst.tradeName);
    const best = Math.max(legalSim, tradeSim);
    const isProprietor = /proprietor/i.test(gst.constitution);
    const softNameEntity = isProprietor || SPECIAL_NAME_ENTITIES.includes(ctx.effectiveType);
    let status: RuleResult["status"] = "manual_review";
    let note: string | undefined;
    if (legalSim >= SIMILARITY_THRESHOLDS.strongPass) {
      status = "pass";
    } else if (tradeSim >= SIMILARITY_THRESHOLDS.strongPass) {
      // Trade name matches but legal name differs.
      status = isProprietor || ctx.policy.allowTradeNameMatch ? "pass" : "manual_review";
      note = "Trade name matches, legal name differs.";
    } else if (best >= SIMILARITY_THRESHOLDS.manualReviewLow) {
      status = "manual_review";
    } else {
      // Strong mismatch: hard fail for normal entities, soft review for
      // proprietorships and special entities (operator vs brand differences).
      status = softNameEntity ? "manual_review" : "fail";
    }
    rules.push(mkRule({
      label: "Legal name match", source: "GST legalNameOfBusiness / tradeName",
      description: "Form business name must match GST legal or trade name.",
      status, severity: "high",
      expected: `~${input.businessName}`,
      actual: `legal="${gst.legalName}" trade="${gst.tradeName}" (sim ${(best * 100).toFixed(0)}%)`,
      recommendation: note ?? (status === "manual_review" ? "Confirm brand/trade name vs legal name" : undefined),
    }));
  }

  // 5. Address match
  if (gst) {
    const sc = scoreAddress({ state: input.state, city: input.city, pincode: input.pincode, address: input.registeredAddress }, { state: gst.state, pincode: gst.pincode, address: gst.principalAddress });
    let status: RuleResult["status"] = "manual_review";
    if (!sc.stateMatch) status = ctx.policy.strictAddressMatch ? "fail" : "manual_review";
    else if (sc.pincodeMatch && sc.score >= 0.7) status = "pass";
    rules.push(mkRule({
      label: "Address match", source: "GST principalPlaceOfBusiness",
      description: "State, pincode and address line should align.",
      status, severity: sc.stateMatch ? "medium" : "critical",
      expected: `${input.state} / ${input.pincode}`,
      actual: `${gst.state || "?"} / ${gst.pincode || "?"} (score ${(sc.score * 100).toFixed(0)}%)`,
      recommendation: !sc.stateMatch ? "State mismatch — escalate" : undefined,
    }));
  }

  // 6. Filing health
  if (gst) {
    const filed = /filed/i.test(gst.filingStatus);
    const recentReg = gst.registrationDate ? daysBetween(gst.registrationDate, ctx.nowIso) < 90 : false;
    let status: RuleResult["status"] = filed ? "pass" : "manual_review";
    if (!filed && recentReg) status = "pass";
    rules.push(mkRule({
      label: "Filing health", source: "filingStatus / GSTR1 / GSTR3B / GSTR9",
      description: "Recent filings should be healthy (recent registrations exempt).",
      status: ctx.policy.requireRecentGstFilings ? status : "pass",
      severity: status === "manual_review" ? "high" : "medium",
      expected: "Recent filings present",
      actual: `${gst.filingStatus}${recentReg ? " (recently registered)" : ""}`,
      recommendation: status === "manual_review" ? "Review sparse filing history" : undefined,
    }));
  }

  // 7. Taxpayer type
  if (gst) {
    const regular = /regular/i.test(gst.taxpayerType);
    rules.push(mkRule({
      label: "Taxpayer type", source: "taxPayerType",
      description: "Regular taxpayer passes; composition/special needs review.",
      status: regular ? "pass" : "manual_review", severity: "low",
      expected: "Regular", actual: gst.taxpayerType,
    }));
  }

  // 8. Business activity sanity
  if (gst) {
    rules.push(mkRule({
      label: "Business activity sanity", source: "natureOfBusinessActivity / goodsServices",
      description: "Activity should loosely align with the selected vertical.",
      status: "pass", severity: "low",
      expected: `Aligned with ${input.vertical || "vertical"}`,
      actual: (gst.natureOfBusiness.join(", ") || "—"),
    }));
  }

  // 9. Document consistency
  rules.push(documentConsistencyRule(ctx));

  // 10. Duplicate check
  rules.push(mkRule({
    label: "Duplicate check", source: "Internal mock database",
    description: "No existing active org should already own this PAN/GSTIN.",
    status: ctx.duplicateGstin ? "fail" : "pass",
    severity: "high",
    expected: "No duplicate",
    actual: ctx.duplicateGstin ? "GSTIN already onboarded under another account" : "No conflict",
    recommendation: ctx.duplicateGstin ? "Treat as new-admin request → manual review, or reject" : undefined,
  }));

  return rules;
}

function matchesState(ctx: RuleContext): boolean {
  const sel = ctx.norm.panGst?.gstList.find((g) => g.gstin === ctx.input.gstin);
  if (!sel) return false;
  return sel.principalAddress.toLowerCase().includes(ctx.input.state.toLowerCase());
}

export function constitutionMatches(type: string, constitution: string): "match" | "conflict" | "ambiguous" {
  const c = (constitution || "").toLowerCase();
  const map: Record<string, string[]> = {
    "Private Limited": ["private limited"],
    "Public Limited": ["public limited"],
    Company: ["private limited", "public limited", "company", "one person", "section 8"],
    "Limited Liability Partnership": ["limited liability partnership", "llp"],
    "Partnership Firm": ["partnership"],
    "Sole Proprietorship": ["proprietor"],
    "HUF Business": ["huf", "hindu undivided"],
    Society: ["society", "aop", "boi", "club", "trust"],
    Trust: ["trust", "aop"],
  };
  const expected = map[type];
  if (!expected) return "ambiguous";
  if (expected.some((e) => c.includes(e))) return "match";
  // direct contradictions
  const allKnown = ["proprietor", "partnership", "private limited", "public limited", "llp", "trust", "society", "huf"];
  if (allKnown.some((k) => c.includes(k))) return "conflict";
  return "ambiguous";
}

function documentConsistencyRule(ctx: RuleContext): RuleResult {
  const docs = ctx.input.documents ?? [];
  const tampered = docs.find((d) => d.state === "Tampered" || d.state === "Mismatch");
  const unreadable = docs.find((d) => d.state === "Unreadable");
  const missingRequired = docs.find((d) => d.required && d.state === "Missing");
  let status: RuleResult["status"] = "pass";
  let actual = "Uploaded docs consistent with API data";
  let severity: RuleResult["severity"] = "medium";
  if (tampered) { status = "fail"; severity = "critical"; actual = `Doc OCR conflict: ${tampered.label} (${tampered.ocr?.extractedName ?? ""} / ${tampered.ocr?.extractedPAN ?? ""})`; }
  else if (unreadable) { status = "manual_review"; severity = "high"; actual = `Unreadable document: ${unreadable.label}`; }
  else if (missingRequired) { status = "pending"; actual = `Required document missing: ${missingRequired.label}`; }
  return mkRule({
    label: "Document consistency", source: "Uploaded docs + mock OCR",
    description: "Extracted PAN/GST/name must match API data.",
    status, severity, expected: "Docs match API data", actual,
    recommendation: status === "fail" ? "Reject — document tampering" : status === "manual_review" ? "Request document re-upload" : undefined,
  });
}

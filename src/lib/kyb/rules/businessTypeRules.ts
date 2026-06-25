import { mkRule, type RuleContext } from "./context";
import type { RuleResult } from "../types";
import { constitutionMatches } from "./baseRules";
import { stringSimilarity } from "../matching";
import { SIMILARITY_THRESHOLDS } from "../constants";

// Business-type-specific checks (company CIN chain, proprietor checks, special
// entity routing). These run after base rules.
export function runBusinessTypeRules(ctx: RuleContext): RuleResult[] {
  const t = ctx.effectiveType;
  if (t === "Private Limited" || t === "Public Limited" || t === "Company") return companyRules(ctx);
  if (t === "Sole Proprietorship") return proprietorRules(ctx);
  if (t === "Limited Liability Partnership" || t === "Partnership Firm") return partnershipRules(ctx);
  if (["Society", "Trust", "HUF Business", "Colleges and Universities (set up through enactment of a statute)", "Branch Office & Project Office", "Liaison Office", "Diplomatic Missions"].includes(t)) {
    return specialEntityRules(ctx);
  }
  return otherRules(ctx);
}

function companyRules(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  const { cin, gst } = ctx.norm;

  rules.push(mkRule({
    label: "PAN → CIN resolution", source: "PAN to CIN / CIN Detailed",
    description: "PAN must resolve to a company CIN.",
    status: cin ? "pass" : "fail", severity: "critical",
    expected: "Matching CIN returned", actual: cin ? cin.cin : "No CIN found for PAN",
    recommendation: !cin ? "Reject — PAN does not map to a company" : undefined,
  }));

  if (cin) {
    const active = /active/i.test(cin.status);
    rules.push(mkRule({
      label: "CIN status", source: "CIN Detailed",
      description: "Company must be ACTIVE / not struck off.",
      status: active ? "pass" : "fail", severity: "critical",
      expected: "ACTIVE", actual: cin.status,
      recommendation: !active ? "Reject — company inactive/struck off" : undefined,
    }));

    // class check for public/private
    if (ctx.selectedType === "Public Limited") {
      const isPublic = /public/i.test(cin.class);
      rules.push(mkRule({ label: "Company class = PUBLIC", source: "CIN Detailed", description: "Selected Public Limited must have class PUBLIC.", status: isPublic ? "pass" : "fail", severity: "high", expected: "PUBLIC", actual: cin.class }));
      if (cin.suspendedAtStockExchange) {
        rules.push(mkRule({ label: "Stock exchange suspension", source: "CIN Detailed", description: "Suspension requires compliance review.", status: "manual_review", severity: "high", expected: "Not suspended", actual: cin.suspendedAtStockExchange }));
      }
    } else if (ctx.selectedType === "Private Limited") {
      const isPrivate = /private/i.test(cin.class);
      rules.push(mkRule({ label: "Company class = PRIVATE", source: "CIN Detailed", description: "Selected Private Limited should have class PRIVATE.", status: isPrivate ? "pass" : "manual_review", severity: "medium", expected: "PRIVATE", actual: cin.class }));
    } else {
      // Company routing bucket -> note reclassification
      rules.push(mkRule({ label: "Company reclassification", source: "CIN Detailed", description: "Generic 'Company' routed to verified subtype.", status: "pass", severity: "low", expected: "Reclassified", actual: `Reclassified as ${cin.class} company` }));
    }

    // name match CIN vs GST/form
    const nameSim = Math.max(stringSimilarity(ctx.input.businessName, cin.companyName), gst ? stringSimilarity(gst.legalName, cin.companyName) : 0);
    rules.push(mkRule({
      label: "CIN name match", source: "CIN companyName vs GST/form",
      description: "Company name should match GST legal name and entered business name.",
      status: nameSim >= SIMILARITY_THRESHOLDS.strongPass ? "pass" : nameSim >= SIMILARITY_THRESHOLDS.manualReviewLow ? "manual_review" : "fail",
      severity: "high", expected: `~${ctx.input.businessName}`, actual: `${cin.companyName} (sim ${(nameSim * 100).toFixed(0)}%)`,
    }));

    // PAN match if returned
    if (cin.pan) {
      rules.push(mkRule({ label: "CIN PAN match", source: "CIN Detailed", description: "CIN PAN should match entered PAN.", status: cin.pan.toUpperCase() === ctx.input.pan.toUpperCase() ? "pass" : "fail", severity: "high", expected: ctx.input.pan, actual: cin.pan }));
    }
  }
  return rules;
}

function proprietorRules(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  const p = ctx.norm.proprietor;
  const gst = ctx.norm.gst;
  if (!p) {
    rules.push(mkRule({ label: "Proprietor PAN", source: "Proprietor Detailed", description: "PAN must be an individual proprietor PAN.", status: "manual_review", severity: "high", expected: "proprietorPan = true", actual: "Proprietor Detailed unavailable" }));
    return rules;
  }
  rules.push(mkRule({
    label: "Proprietor PAN", source: "Proprietor Detailed",
    description: "PAN must be an individual proprietor PAN.",
    status: p.proprietorPan ? "pass" : "fail", severity: "critical",
    expected: "proprietorPan = true", actual: String(p.proprietorPan),
    recommendation: !p.proprietorPan ? "Reject — not a proprietor PAN" : undefined,
  }));
  rules.push(mkRule({
    label: "Proprietor GST count", source: "Proprietor Detailed",
    description: "At least one GST should be linked to the proprietor PAN.",
    status: p.gstCount >= 1 ? "pass" : "manual_review", severity: "medium",
    expected: ">= 1 GST", actual: `${p.gstCount}`,
  }));
  if (gst) {
    const tradeSim = stringSimilarity(ctx.input.businessName, gst.tradeName);
    rules.push(mkRule({
      label: "Proprietor trade name", source: "GST tradeName vs form",
      description: "Trade name should align with business name.",
      status: tradeSim >= SIMILARITY_THRESHOLDS.strongPass ? "pass" : "manual_review",
      severity: "medium", expected: `~${ctx.input.businessName}`, actual: `${gst.tradeName} (sim ${(tradeSim * 100).toFixed(0)}%)`,
    }));
  }
  return rules;
}

function partnershipRules(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  const gst = ctx.norm.gst;
  if (ctx.selectedType === "Partnership") {
    rules.push(mkRule({ label: "Routing note", source: "Engine", description: "Partnership routed to Partnership Firm KYB template.", status: "pass", severity: "low", expected: "Partnership Firm template", actual: "Routed to Partnership Firm KYB template" }));
  }
  if (gst) {
    const c = constitutionMatches(ctx.effectiveType, gst.constitution);
    rules.push(mkRule({
      label: ctx.effectiveType === "Limited Liability Partnership" ? "LLP constitution" : "Partnership constitution",
      source: "GST constitution",
      description: "Constitution must map to LLP/Partnership.",
      status: c === "match" ? "pass" : c === "conflict" ? "fail" : "manual_review",
      severity: "high", expected: ctx.effectiveType, actual: gst.constitution,
    }));
  }
  return rules;
}

function specialEntityRules(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  rules.push(mkRule({
    label: "Special entity policy", source: "Engine policy",
    description: `${ctx.effectiveType} is a special entity class. Manual review by default unless all docs present & validated.`,
    status: ctx.policy.manualReviewForSpecialEntities ? "manual_review" : "pass",
    severity: "high",
    expected: "Constitution + authorisation proof verified",
    actual: ctx.norm.gst ? `GST present (${ctx.norm.gst.constitution})` : "No GST — identity not machine-verifiable",
    recommendation: "Route to compliance reviewer",
  }));
  return rules;
}

function otherRules(ctx: RuleContext): RuleResult[] {
  return [mkRule({
    label: "Reclassification (Others)", source: "Company Name to GST / Mobile fallbacks",
    description: "Attempt to reclassify into a known business-type template.",
    status: ctx.norm.gst ? "manual_review" : "manual_review",
    severity: "medium",
    expected: "Confident reclassification", actual: ctx.norm.gst ? `GST constitution ${ctx.norm.gst.constitution}` : "Insufficient data",
  })];
}

import { mkRule, type RuleContext } from "./context";
import type { RuleResult } from "../types";
import { stringSimilarity } from "../matching";

// Vertical add-on rules — risk modifiers / extra licence checks layered on top
// of the base + business-type rules.
export function runVerticalAddons(ctx: RuleContext): RuleResult[] {
  const rules: RuleResult[] = [];
  const v = ctx.input.vertical;
  const gst = ctx.norm.gst;

  // Food & beverage -> FSSAI
  if (v === "Food and beverage" && ctx.policy.requireFssaiForFood) {
    const raw = ctx.client.call("FSSAI License Verification", { fssaiNumber: ctx.input.fssai }, ["fssai"]);
    const hasFssai = ctx.input.fssai && raw && !(raw as any).error;
    const active = hasFssai && /active/i.test((raw as any).status || "");
    rules.push(mkRule({
      label: "FSSAI licence (Food add-on)", source: "FSSAI License Verification",
      description: "Food businesses require an active FSSAI licence.",
      status: active ? "pass" : "pending", severity: "high",
      expected: "Active FSSAI licence", actual: hasFssai ? (raw as any).status : "No FSSAI supplied",
      recommendation: !active ? "Request FSSAI licence (Add-on Pending)" : undefined,
    }));
  }

  // Import/Export -> IEC
  const importActivity = (gst?.natureOfBusiness ?? []).some((n) => /import|export/i.test(n)) || !!ctx.input.iec;
  if (importActivity || ["Raw materials", "Manufacturing", "Retail", "Transportation (Travel)"].includes(v)) {
    if (importActivity) {
      const raw = ctx.input.iec ? ctx.client.call("Import Export Code Verification", { iecNumber: ctx.input.iec }, ["iec"]) : null;
      const active = raw && !(raw as any).error && /active/i.test((raw as any).status || "");
      rules.push(mkRule({
        label: "IEC (Import/Export add-on)", source: "Import Export Code Verification",
        description: "Import/Export activity should have a valid IEC.",
        status: active ? "pass" : ctx.policy.requireIecForImportExport ? "fail" : "manual_review",
        severity: active ? "low" : "high",
        expected: "Active IEC", actual: ctx.input.iec ? (raw as any).status : "Import/Export activity but no IEC supplied",
        recommendation: !active ? "Request IEC (Add-on Pending)" : undefined,
      }));
    }
  }

  // Udyam enrichment
  if (ctx.input.udyam) {
    const raw = ctx.client.call("Udyam Verification", { udyamNumber: ctx.input.udyam }, ["udyam"]);
    const ok = raw && !(raw as any).error && !(raw as any).isCancelled;
    rules.push(mkRule({
      label: "Udyam enrichment", source: "Udyam Verification",
      description: "MSME Udyam used as enrichment signal.",
      status: ok ? "pass" : "manual_review", severity: "low",
      expected: "Active Udyam", actual: ok ? (raw as any).nameOfEnterprise : "Udyam unavailable/cancelled",
    }));
  }

  // Banking/Finance/FinTech -> higher manual review threshold
  if (["Banking", "Financial (Finance)", "FinTech", "Healthcare Insurance"].includes(v)) {
    const stale = ctx.norm.cin && !/active compliant/i.test(ctx.norm.cin.activeCompliance);
    rules.push(mkRule({
      label: "Regulated vertical review", source: "Policy",
      description: "Regulated verticals carry a higher manual-review threshold.",
      status: stale ? "manual_review" : "pass", severity: "medium",
      expected: "Compliant & current", actual: stale ? "Compliance stale" : "Compliant",
    }));
  }

  // Government / Diplomatic verticals -> manual review
  if (["Government - federal, state, local", "Diplomatic Missions"].includes(v)) {
    rules.push(mkRule({ label: "Government/Diplomatic review", source: "Policy", description: "Government/diplomatic verticals are manual review by default.", status: "manual_review", severity: "high", expected: "Official verification", actual: "Requires manual compliance review" }));
  }

  // Large employer enrichment
  const emp = parseInt(ctx.input.numberOfEmployees || "0", 10);
  if (emp > 50 && (ctx.input.epfo || ctx.input.tan)) {
    rules.push(mkRule({ label: "Large employer enrichment", source: "EPFO / TAN", description: "Large employer EPFO/TAN used as enrichment.", status: "pass", severity: "low", expected: "EPFO/TAN present", actual: `${emp} employees` }));
  }

  return rules;
}

// helper kept for potential name checks in add-ons
export function nameAligned(a: string, b: string): boolean {
  return stringSimilarity(a, b) >= 0.75;
}

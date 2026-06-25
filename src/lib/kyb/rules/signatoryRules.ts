import { mkRule, type RuleContext } from "./context";
import type { RepresentativeVerification, RuleResult } from "../types";
import { stringSimilarity } from "../matching";
import { ACCEPTABLE_DIN_DESIGNATIONS, SIMILARITY_THRESHOLDS } from "../constants";
import { addDays, isPastDeadline } from "../dateUtils";

// Representative / authorised signatory verification. Runs after entity KYB.
export function runSignatoryRules(ctx: RuleContext, entityHasCriticalFail: boolean): RepresentativeVerification {
  const role = ctx.representative.role;
  const rules: RuleResult[] = [];
  let dinTally: RuleResult | undefined;

  if (!role) {
    return { role, rules: [mkRule({ label: "Signatory role", source: "Form", description: "Representative role not selected.", status: "pending", severity: "high", expected: "Role selected", actual: "Not provided" })], status: "pending" };
  }

  const signatory = ctx.representative.signatoryName || ctx.input.contactPerson;

  switch (role) {
    case "director_kmp": {
      const dinApplies = ["Private Limited", "Public Limited", "Company"].includes(ctx.effectiveType);
      if (!dinApplies) {
        rules.push(mkRule({ label: "DIN applicability", source: "Policy", description: "DIN not applicable for this entity type.", status: "manual_review", severity: "medium", expected: "N/A", actual: `${ctx.effectiveType} — request authorisation proof` }));
        break;
      }
      if (!ctx.representative.din || !ctx.representative.dinRemembered) {
        const deadline = addDays(ctx.formCreatedAt, ctx.policy.dinGraceDays);
        const expired = isPastDeadline(deadline, ctx.nowIso);
        rules.push(mkRule({
          label: "DIN submission", source: "DIN Detailed",
          description: `Director/KMP must submit DIN within ${ctx.policy.dinGraceDays} days.`,
          status: "pending", severity: "high",
          expected: "Valid DIN", actual: expired ? "DIN not submitted within grace window (expired)" : "DIN pending (grace active)",
          recommendation: expired ? "Expired — restart signatory verification" : `Submit DIN before ${new Date(deadline).toLocaleDateString("en-IN")}`,
        }));
        break;
      }
      // DIN provided -> tally
      dinTally = tallyDin(ctx, signatory);
      rules.push(dinTally);
      break;
    }
    case "proprietor": {
      rules.push(mkRule({ label: "Proprietor confirmation", source: "Form", description: "User must confirm they are the proprietor.", status: ctx.representative.confirmedProprietor ? "pass" : "pending", severity: "high", expected: "Confirmed", actual: ctx.representative.confirmedProprietor ? "Confirmed" : "Not confirmed" }));
      const p = ctx.norm.proprietor;
      if (p) {
        rules.push(mkRule({ label: "Proprietor PAN tally", source: "Proprietor Detailed", description: "Proprietor PAN must match submitted PAN.", status: p.proprietorPan && p.pan.toUpperCase() === ctx.input.pan.toUpperCase() ? "pass" : "manual_review", severity: "high", expected: ctx.input.pan, actual: p.pan }));
      }
      if (ctx.representative.confirmedProprietor === false) {
        rules.push(mkRule({ label: "Authorisation proof", source: "Docs", description: "Non-proprietor requires authorisation proof.", status: ctx.representative.authorisationDocProvided ? "manual_review" : "pending", severity: "high", expected: "Authorisation letter", actual: ctx.representative.authorisationDocProvided ? "Provided — review" : "Missing" }));
      }
      break;
    }
    case "designated_partner": {
      const hasDin = !!ctx.representative.din && ctx.representative.dinRemembered;
      if (hasDin && ctx.norm.din) {
        dinTally = tallyDin(ctx, signatory);
        rules.push(dinTally);
      } else {
        rules.push(mkRule({ label: "Partner authorisation", source: "LLP agreement / Partnership deed", description: "Partner authority requires LLP agreement/deed/authorisation.", status: ctx.representative.authorisationDocProvided ? "manual_review" : "pending", severity: "high", expected: "Authorisation proof", actual: ctx.representative.authorisationDocProvided ? "Provided — review" : "Pending" }));
      }
      break;
    }
    case "trustee_karta": {
      rules.push(mkRule({ label: "Constitution / authority proof", source: "Trust deed / Karta authorisation / constitution", description: "Trustee/Karta/office-bearer requires constitution/authority proof.", status: ctx.representative.authorisationDocProvided ? "manual_review" : "pending", severity: "high", expected: "Authority proof", actual: ctx.representative.authorisationDocProvided ? "Provided — manual review" : "Pending" }));
      break;
    }
    case "authorised_employee": {
      const autoPass = ctx.policy.allowEmployeeAuthorisationAutoPass && ctx.representative.authorisationDocProvided;
      rules.push(mkRule({
        label: "Employee authorisation", source: "Authorisation letter / Board resolution",
        description: "Authorised employee/admin requires authorisation; DIN not required.",
        status: autoPass ? "pass" : ctx.representative.authorisationDocProvided ? "manual_review" : "pending",
        severity: "high", expected: "Authorisation letter / board resolution",
        actual: ctx.representative.authorisationDocProvided ? (autoPass ? "Accepted (policy auto-pass)" : "Provided — manual review") : "Pending",
      }));
      break;
    }
    case "on_behalf": {
      rules.push(mkRule({ label: "Acting on behalf", source: "Policy", description: "Filing on behalf requires authorisation; never auto-approved.", status: ctx.representative.authorisationDocProvided ? "manual_review" : "pending", severity: "high", expected: "Authorisation proof", actual: ctx.representative.authorisationDocProvided ? "Provided — manual review" : "Authorisation pending" }));
      break;
    }
  }

  // derive overall representative status
  const status = deriveStatus(rules, entityHasCriticalFail);
  return { role, rules, status, dinTally };
}

function tallyDin(ctx: RuleContext, signatory: string): RuleResult {
  const din = ctx.norm.din;
  const cin = ctx.norm.cin;
  if (!din) {
    return mkRule({ label: "DIN tally", source: "DIN Detailed", description: "DIN must be valid and tied to the verified company.", status: "fail", severity: "critical", expected: "Valid DIN", actual: "DIN not found / invalid", recommendation: "Signatory verification failed" });
  }
  const valid = /approv|active|valid/i.test(din.status);
  const cinMatch = cin ? din.associatedCompanies.some((a) => a.cin === cin.cin) || cin.directors.some((d) => d.din === din.din) : false;
  const nameSim = stringSimilarity(din.name, signatory);
  const designationOk = din.associatedCompanies.some((a) => ACCEPTABLE_DIN_DESIGNATIONS.includes((a.designation || "").toUpperCase())) || (cin?.directors.find((d) => d.din === din.din) ? ACCEPTABLE_DIN_DESIGNATIONS.includes((cin!.directors.find((d) => d.din === din.din)!.designation || "").toUpperCase()) : false);

  let status: RuleResult["status"] = "pass";
  let reco: string | undefined;
  if (!valid) { status = "fail"; reco = "DIN invalid"; }
  else if (!cinMatch) { status = "manual_review"; reco = "DIN valid but not linked to verified company — review (or fail per policy)"; }
  else if (nameSim < SIMILARITY_THRESHOLDS.manualReviewLow) { status = "fail"; reco = "DIN name strongly mismatches signatory"; }
  else if (nameSim < SIMILARITY_THRESHOLDS.strongPass) { status = "manual_review"; reco = "Minor name mismatch — review"; }
  else if (!designationOk) { status = "manual_review"; reco = "Designation needs compliance review"; }

  return mkRule({
    label: "DIN tally", source: "DIN Detailed ↔ CIN directorDetails",
    description: "DIN active, linked to verified CIN, name & designation acceptable.",
    status, severity: status === "fail" ? "critical" : status === "manual_review" ? "high" : "medium",
    expected: `Active DIN linked to ${cin?.cin ?? "company"}, name ~${signatory}`,
    actual: `DIN ${din.din} (${din.status}); CIN match=${cinMatch}; name sim ${(nameSim * 100).toFixed(0)}%`,
    recommendation: reco,
  });
}

function deriveStatus(rules: RuleResult[], entityCriticalFail: boolean): RuleResult["status"] {
  if (rules.some((r) => r.status === "fail")) return "fail";
  if (rules.some((r) => r.status === "pending")) return "pending";
  if (rules.some((r) => r.status === "manual_review")) return "manual_review";
  if (entityCriticalFail) return "fail";
  return rules.length && rules.every((r) => r.status === "pass" || r.status === "skipped") ? "pass" : "manual_review";
}

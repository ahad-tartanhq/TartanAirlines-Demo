import type { MockApiClient } from "../mockApi";
import type {
  BusinessType,
  EntityKybInput,
  NormalizedCinDetails,
  NormalizedDinDetails,
  NormalizedGstDetails,
  NormalizedPanGstDetails,
  NormalizedProprietorDetails,
  RepresentativeClaim,
  RuleResult,
} from "../types";
import { KYB_POLICY } from "../constants";

export interface RuleContext {
  input: EntityKybInput;
  representative: RepresentativeClaim;
  effectiveType: BusinessType; // resolved (e.g. Partnership -> Partnership Firm)
  selectedType: BusinessType;
  policy: typeof KYB_POLICY;
  client: MockApiClient;
  nowIso: string;
  formCreatedAt: string;
  scenarioId: string;
  duplicateGstin?: boolean;
  norm: {
    gst?: NormalizedGstDetails;
    panGst?: NormalizedPanGstDetails;
    cin?: NormalizedCinDetails;
    din?: NormalizedDinDetails;
    proprietor?: NormalizedProprietorDetails;
  };
}

let ruleSeq = 0;
export function mkRule(r: Omit<RuleResult, "id"> & { id?: string }): RuleResult {
  ruleSeq += 1;
  return { id: r.id ?? `rule_${ruleSeq}`, ...r } as RuleResult;
}
export function resetRuleSeq() {
  ruleSeq = 0;
}

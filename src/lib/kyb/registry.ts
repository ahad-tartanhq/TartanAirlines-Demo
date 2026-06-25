// Mock backend "registry".
//
// Instead of asking the user to pick a demo scenario, every sample company in
// the system is registered here under its own unique identifiers (GSTIN / PAN /
// CIN / DIN). When a user types or prefills a GSTIN/PAN/DIN into the onboarding
// form, the mock API client resolves the matching response bundle automatically,
// so edge cases self-identify from whatever the user actually entered on screen.
//
// The data is derived from the curated SCENARIOS fixtures, but each scenario is
// rewritten to use a unique set of identifiers so they no longer collide.

import { SCENARIOS, TARTAN, DOC_OCR_OVERRIDES } from "./fixtures";
import { getRequiredDocLabels } from "./constants";
import type {
  BusinessType, DocumentUpload, EntityKybInput, RepresentativeClaim,
} from "./types";

export interface SampleCompany {
  id: string;
  name: string;
  expectedOutcome: string;
  description: string;
  input: EntityKybInput;
  representative: RepresentativeClaim;
  formCreatedAt: string;
  duplicateGstin: boolean;
  /** API response bundle keyed by endpoint, served by the mock client. */
  api: Record<string, unknown>;
}

const emptyInput: EntityKybInput = {
  businessName: "", vertical: "", businessType: "", registeredAddress: "", country: "India",
  state: "", city: "", pincode: "", numberOfEmployees: "", email: "", phone: "", contactPerson: "",
  gstin: "", pan: "", cin: "", documents: [],
};

function emptyDocs(type: BusinessType | ""): DocumentUpload[] {
  return getRequiredDocLabels(type).map((d, i) => ({
    id: `doc_${i}`, label: d.label, required: d.required, state: "Missing" as const,
  }));
}

// Generate a unique, valid-looking identifier set per scenario index.
function uniqueIds(i: number) {
  const n = String(1000 + i); // 4 digits
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ"[i % 24];
  const pan = `AAA${L}T${n}L`; // 5 letters + 4 digits + 1 letter = 10 chars
  const gstin = `27${pan}1Z5`; // 15 chars
  const cin = `U72900MH2018PTC${300000 + i}`;
  const din = `0812${3000 + i}`; // 8 digits
  return { pan, gstin, cin, din };
}

// Deep-clone a scenario while remapping the shared TARTAN identifiers to the
// unique ones. Order matters: GSTIN contains the PAN as a substring, so it must
// be replaced first.
function remap<T>(value: T, ids: ReturnType<typeof uniqueIds>): T {
  const json = JSON.stringify(value)
    .split(TARTAN.gstin).join(ids.gstin)
    .split(TARTAN.pan).join(ids.pan)
    .split(TARTAN.cin).join(ids.cin)
    .split(TARTAN.director1.din).join(ids.din);
  return JSON.parse(json) as T;
}

function buildDocs(id: string, type: BusinessType | "", input: Partial<EntityKybInput>): DocumentUpload[] {
  const docs = emptyDocs(type);
  const ocrKind = DOC_OCR_OVERRIDES[id];
  const noDocScenarios = ["partnership_pending", "society_no_reg", "branch_no_rbi"];
  docs.forEach((d, i) => {
    if (noDocScenarios.includes(id)) {
      d.state = d.required && i < 2 ? "Accepted" : "Missing";
    } else if (ocrKind === "tampered" && i === 1) {
      d.state = "Tampered";
      d.ocr = { extractedPAN: "ZZZZZ9999Z", extractedName: "UNKNOWN ENTITY", confidence: 0.88 };
    } else if (ocrKind === "unreadable" && i === 0) {
      d.state = "Unreadable";
      d.ocr = { confidence: 0.21 };
    } else {
      d.state = "Accepted";
      d.ocr = { extractedPAN: input.pan, extractedGSTIN: input.gstin, extractedName: input.businessName, confidence: 0.96 };
    }
  });
  return docs;
}

export const SAMPLE_COMPANIES: SampleCompany[] = SCENARIOS.map((sc, i) => {
  const ids = uniqueIds(i);
  const input = remap(sc.input, ids) as Partial<EntityKybInput>;
  const representative = remap(sc.representative, ids) as Partial<RepresentativeClaim>;
  const api = remap(sc.api, ids) as Record<string, unknown>;
  const type = (input.businessType as BusinessType) ?? "";
  return {
    id: sc.id,
    name: sc.name,
    expectedOutcome: sc.expectedOutcome,
    description: sc.description,
    input: { ...emptyInput, ...input, documents: buildDocs(sc.id, type, input) },
    representative: { role: "", dinRemembered: false, ...representative } as RepresentativeClaim,
    formCreatedAt: sc.formCreatedAt,
    duplicateGstin: !!sc.duplicateGstin,
    api,
  };
});

// --- Identifier indexes -----------------------------------------------------

const byGstin = new Map<string, Record<string, unknown>>();
const byPan = new Map<string, Record<string, unknown>>();
const byDin = new Map<string, Record<string, unknown>>();

for (const c of SAMPLE_COMPANIES) {
  if (c.input.gstin) byGstin.set(c.input.gstin.toUpperCase(), c.api);
  if (c.input.pan) byPan.set(c.input.pan.toUpperCase(), c.api);
  if (c.representative.din) byDin.set(c.representative.din, c.api);
}

/**
 * Resolve the mock API response bundle for the data currently entered in the
 * form. Looks up by GSTIN first, then PAN, then DIN. Returns an empty bundle
 * when nothing matches — which naturally drives the engine toward
 * manual-review / failed outcomes, exactly as a real unknown entity would.
 */
export function resolveApiBundle(
  input: Pick<EntityKybInput, "gstin" | "pan">,
  representative: Pick<RepresentativeClaim, "din">,
): Record<string, unknown> {
  const gstin = input.gstin?.trim().toUpperCase();
  const pan = input.pan?.trim().toUpperCase();
  if (gstin && byGstin.has(gstin)) return byGstin.get(gstin)!;
  if (pan && byPan.has(pan)) return byPan.get(pan)!;
  if (representative.din && byDin.has(representative.din)) return byDin.get(representative.din)!;
  return {};
}

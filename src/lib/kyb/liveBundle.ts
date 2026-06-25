// Live (manual) verification bundle synthesiser.
//
// The registry-driven flow only returns API data when the typed identifiers
// match a pre-seeded sample company. That makes it impossible to manually drive
// a fresh success or failure case from scratch.
//
// buildLiveBundle takes whatever the user actually typed (company name, GSTIN,
// PAN, CIN, DIN…) and fabricates a complete, self-consistent mock API response
// bundle for a chosen outcome — so a demo operator can produce a clean PASS, or
// any specific FAIL / MANUAL REVIEW, without relying on the sample list.

import type {
  BusinessType, EntityKybInput, RepresentativeClaim,
} from "./types";

export type LiveOutcome =
  | "pass"
  | "gst_cancelled"
  | "name_mismatch"
  | "pan_gst_mismatch"
  | "address_mismatch"
  | "din_mismatch";

export const LIVE_OUTCOMES: { value: LiveOutcome; label: string; expected: string }[] = [
  { value: "pass", label: "Success — all checks pass", expected: "KYB Passed" },
  { value: "gst_cancelled", label: "Failure — GST cancelled", expected: "KYB Failed" },
  { value: "name_mismatch", label: "Failure — company name mismatch", expected: "KYB Failed" },
  { value: "pan_gst_mismatch", label: "Failure — PAN & GST not linked", expected: "KYB Failed" },
  { value: "address_mismatch", label: "Manual review — address/state mismatch", expected: "Manual Review" },
  { value: "din_mismatch", label: "Manual review — director (DIN) mismatch", expected: "Manual Review" },
];

const COMPANY_TYPES = ["Private Limited", "Public Limited", "Company"];

function resolveType(t: BusinessType | ""): BusinessType | "" {
  if (t === "Partnership") return "Partnership Firm";
  return t;
}

function constitutionFor(type: BusinessType | ""): string {
  switch (resolveType(type)) {
    case "Private Limited": return "Private Limited Company";
    case "Public Limited": return "Public Limited Company";
    case "Company": return "Private Limited Company";
    case "Limited Liability Partnership": return "Limited Liability Partnership";
    case "Partnership Firm": return "Partnership";
    case "Sole Proprietorship": return "Proprietorship";
    case "HUF Business": return "HUF";
    case "Trust": return "Trust";
    case "Society": return "Society/Club/Trust/AOP";
    default: return "Private Limited Company";
  }
}

// A canonical address used for the synthetic match (also written back onto the
// form so the address rule has something to compare against).
const ADDR = {
  state: "Maharashtra",
  city: "Mumbai",
  pincode: "400030",
  line: "FLOOR-3, 264/265, VASWANI CHAMBERS, DR ANNIE BESANT ROAD, WORLI, Mumbai, Maharashtra, 400030",
};

// ---- raw response builders (mirror fixtures.ts shapes) ----

function gstRaw(o: {
  gstin: string; legalName: string; constitution: string; status?: string;
  state?: string; pincode?: string; address?: string; cancellationDate?: string;
}) {
  return {
    response: {
      code: "200",
      companyData: {
        gstin: o.gstin,
        sts: o.status ?? "Active",
        legalNameOfBusiness: o.legalName,
        tradeName: o.legalName,
        constitutionOfBusiness: o.constitution,
        principalPlaceOfBusiness: o.address ?? ADDR.line,
        state: o.state ?? ADDR.state,
        pincode: o.pincode ?? ADDR.pincode,
        taxPayerType: "Regular",
        currentFilingFrequency: "Monthly",
        effectiveDateOfRegistration: "2019-04-01",
        dateOfCancellation: o.cancellationDate,
        einvoiceStatus: "Yes",
        whetherAadhaarAuthenticated: true,
      },
      filingStatus: { GSTR1: [{ period: "2024-03", status: "Filed" }], GSTR3B: [{ period: "2024-03", status: "Filed" }], GSTR9: [{ period: "2023", status: "Filed" }] },
      goodService: { businessServiceDetails: [{ name: "Software development" }] },
      natureOfBusinessActivity: ["Supply of Services"],
    },
    status: { input: { gstinNumber: o.gstin }, statusCode: "1", statusMessage: "Success", timestamp: new Date().toISOString() },
  };
}

function panToGstRaw(pan: string, entries: { gstin: string; legalName: string; constitution: string; address?: string; state?: string }[]) {
  return {
    response: {
      code: "200",
      gstListAdvanced: entries.map((e) => ({
        gstin: e.gstin,
        sts: "Active",
        constitutionOfBusiness: e.constitution,
        legalNameOfBusiness: e.legalName,
        tradeName: e.legalName,
        principalPlaceOfBusiness: e.address ?? ADDR.line,
        filingStatus: "Filed",
        taxPayerType: "Regular",
        effectiveDateOfRegistration: "2019-04-01",
        currentFilingFrequency: "Monthly",
      })),
      message: "OK",
    },
    status: { input: { panNumber: pan }, statusCode: "1", statusMessage: "Success", timestamp: new Date().toISOString() },
  };
}

function panToCinRaw(pan: string, cin: string, entityName: string) {
  return { response: { cin_details: [{ cin, entity_name: entityName }] }, status: { input: { pan_number: pan } } };
}

function cinRaw(o: { cin: string; companyName: string; pan: string; klass?: string; directors: { din: string; name: string; designation?: string }[] }) {
  return {
    cin: o.cin,
    companyName: o.companyName,
    class: o.klass ?? "Private",
    subCategory: "Non-government company",
    companyType: "Company limited by Shares",
    status: "ACTIVE",
    activeCompliance: "Active Compliant",
    pan: o.pan,
    registeredAddress: ADDR.line,
    splitAddress: { state: ADDR.state, pincode: ADDR.pincode, city: ADDR.city, country: "India" },
    dateOfIncorporation: "2018-06-12",
    noOfDirectors: o.directors.length,
    emailId: "compliance@example.com",
    directorDetails: o.directors.map((d) => ({
      din: d.din, name: d.name, designation: d.designation ?? "DIRECTOR",
      dateOfAppointment: "2018-06-12", whetherDscRegistered: true, dscExpiryDate: "2027-01-01", pan: o.pan,
    })),
  };
}

function dinRaw(o: { din: string; name: string; companies: { cin: string; companyName: string }[] }) {
  return {
    din: o.din, name: o.name, status: "Approved", whetherDscRegistered: true, dscExpiryDate: "2027-01-01",
    associatedCompanies: o.companies.map((c) => ({ cin: c.cin, companyName: c.companyName, designation: "DIRECTOR", dateOfAppointment: "2018-06-12", active: true })),
  };
}

function proprietorRaw(pan: string, gstin: string, isProprietor: boolean) {
  return {
    response: {
      proprietorPan: isProprietor, pan, gstCount: 1,
      gstDetailList: [{ gstNo: gstin, gstStatus: "Active", filingStatus: "Filed", address: ADDR.line }],
    },
    status: { input: { panNumber: pan } },
  };
}

// Fill blank identifiers with valid-looking placeholders so a demo can run even
// when the operator does not type real numbers.
function withDefaults(input: EntityKybInput, rep: RepresentativeClaim) {
  const gstin = (input.gstin || "27ABCDE1234F1Z5").toUpperCase();
  const pan = (input.pan || gstin.slice(2, 12) || "ABCDE1234F").toUpperCase();
  const cin = (input.cin || "U72900MH2018PTC312345").toUpperCase();
  const din = rep.din || "08123456";
  const name = input.businessName || "Demo Company Private Limited";
  const signatory = rep.signatoryName || input.contactPerson || "Demo Director";
  return { gstin, pan, cin, din, name, signatory };
}

export interface LiveBundleResult {
  api: Record<string, unknown>;
  /** Address fields to write onto the form so address checks have a reference. */
  inputPatch: Partial<EntityKybInput>;
}

export function buildLiveBundle(
  input: EntityKybInput,
  rep: RepresentativeClaim,
  outcome: LiveOutcome,
): LiveBundleResult {
  const { gstin, pan, cin, din, name, signatory } = withDefaults(input, rep);
  const type = resolveType(input.businessType);
  const constitution = constitutionFor(input.businessType);
  const isCompany = COMPANY_TYPES.includes(type);
  const isProprietor = type === "Sole Proprietorship";

  // Outcome-specific knobs.
  const gstName = outcome === "name_mismatch" ? "UNRELATED HOLDINGS PRIVATE LIMITED" : name;
  const gstStatus = outcome === "gst_cancelled" ? "Cancelled" : "Active";
  const cancellationDate = outcome === "gst_cancelled" ? "2023-08-15" : undefined;
  const gstState = outcome === "address_mismatch" ? "Karnataka" : ADDR.state;
  const gstPincode = outcome === "address_mismatch" ? "560001" : ADDR.pincode;
  const gstAddress = outcome === "address_mismatch"
    ? "12 MG ROAD, Bengaluru, Karnataka, 560001"
    : ADDR.line;

  const api: Record<string, unknown> = {};

  api["GST Detailed III"] = gstRaw({
    gstin, legalName: gstName, constitution, status: gstStatus,
    state: gstState, pincode: gstPincode, address: gstAddress, cancellationDate,
  });

  // PAN → GST. For the linkage failure, the PAN resolves to a *different* GSTIN.
  const pgGstin = outcome === "pan_gst_mismatch" ? "29ZZZZZ9999Z1Z9" : gstin;
  api["PAN to GST Detailed"] = panToGstRaw(pan, [
    { gstin: pgGstin, legalName: gstName, constitution, address: gstAddress, state: gstState },
  ]);

  if (isCompany) {
    api["PAN to CIN"] = panToCinRaw(pan, cin, name);
    api["CIN Detailed"] = cinRaw({
      cin, companyName: name, pan,
      klass: type === "Public Limited" ? "Public" : "Private",
      directors: [{ din, name: signatory }],
    });

    // DIN. For din_mismatch the DIN belongs to a different, unrelated company.
    if (outcome === "din_mismatch") {
      api["DIN Detailed"] = dinRaw({ din, name: "SOME OTHER PERSON", companies: [{ cin: "U99999MH2010PTC000000", companyName: "OTHER VENTURES PRIVATE LIMITED" }] });
    } else {
      api["DIN Detailed"] = dinRaw({ din, name: signatory, companies: [{ cin, companyName: name }] });
    }
  }

  if (isProprietor) {
    api["Proprietor Detailed"] = proprietorRaw(pan, gstin, true);
  }

  return {
    api,
    inputPatch: {
      // Echo the synthetic address onto the form so the address rule can match
      // (these fields are not collected in the UI anymore).
      state: ADDR.state, city: ADDR.city, pincode: ADDR.pincode, registeredAddress: ADDR.line,
    },
  };
}

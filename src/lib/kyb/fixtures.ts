import type { ScenarioFixture } from "./types";
import { addDays } from "./dateUtils";

// ---- Raw response builders (Tartan-like shapes) ----

function gstDetailedIII(opts: {
  gstin: string;
  status?: string;
  legalName: string;
  tradeName?: string;
  constitution: string;
  address: string;
  state?: string;
  pincode?: string;
  taxPayerType?: string;
  filed?: boolean;
  registrationDate?: string;
  cancellationDate?: string;
  nature?: string[];
}) {
  return {
    response: {
      code: "200",
      companyData: {
        gstin: opts.gstin,
        sts: opts.status ?? "Active",
        legalNameOfBusiness: opts.legalName,
        tradeName: opts.tradeName ?? opts.legalName,
        constitutionOfBusiness: opts.constitution,
        principalPlaceOfBusiness: opts.address,
        state: opts.state,
        pincode: opts.pincode,
        taxPayerType: opts.taxPayerType ?? "Regular",
        currentFilingFrequency: "Monthly",
        effectiveDateOfRegistration: opts.registrationDate ?? "2019-04-01",
        dateOfCancellation: opts.cancellationDate,
        einvoiceStatus: "Yes",
        whetherAadhaarAuthenticated: true,
      },
      filingStatus: opts.filed === false
        ? { GSTR1: [], GSTR3B: [], GSTR9: [] }
        : { GSTR1: [{ period: "2024-03", status: "Filed" }], GSTR3B: [{ period: "2024-03", status: "Filed" }], GSTR9: [{ period: "2023", status: "Filed" }] },
      goodService: { businessServiceDetails: [{ name: "Software development" }] },
      natureOfBusinessActivity: opts.nature ?? ["Supply of Services"],
    },
    status: { input: { gstinNumber: opts.gstin }, statusCode: "1", statusMessage: "Success", timestamp: new Date().toISOString() },
  };
}

function panToGst(pan: string, entries: { gstin: string; status?: string; constitution: string; legalName: string; tradeName?: string; address: string; state?: string }[]) {
  return {
    response: {
      code: "200",
      gstListAdvanced: entries.map((e) => ({
        gstin: e.gstin,
        sts: e.status ?? "Active",
        constitutionOfBusiness: e.constitution,
        legalNameOfBusiness: e.legalName,
        tradeName: e.tradeName ?? e.legalName,
        principalPlaceOfBusiness: e.address,
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

function panToCin(pan: string, cin: string, entityName: string) {
  return { response: { cin_details: [{ cin, entity_name: entityName }] }, status: { input: { pan_number: pan } } };
}

function cinDetailed(opts: {
  cin: string;
  companyName: string;
  klass?: string;
  status?: string;
  pan: string;
  address: string;
  state?: string;
  pincode?: string;
  suspended?: string;
  activeCompliance?: string;
  directors: { din: string; name: string; designation?: string; dsc?: boolean; dscExpiry?: string; pan?: string }[];
}) {
  return {
    cin: opts.cin,
    companyName: opts.companyName,
    class: opts.klass ?? "Private",
    subCategory: "Non-government company",
    companyType: "Company limited by Shares",
    status: opts.status ?? "ACTIVE",
    activeCompliance: opts.activeCompliance ?? "Active Compliant",
    pan: opts.pan,
    registeredAddress: opts.address,
    splitAddress: { state: opts.state ?? "Maharashtra", pincode: opts.pincode ?? "400030", city: "Mumbai", country: "India" },
    suspendedAtStockExchange: opts.suspended,
    dateOfIncorporation: "2018-06-12",
    noOfDirectors: opts.directors.length,
    emailId: "compliance@example.com",
    directorDetails: opts.directors.map((d) => ({
      din: d.din,
      name: d.name,
      designation: d.designation ?? "DIRECTOR",
      dateOfAppointment: "2018-06-12",
      whetherDscRegistered: d.dsc ?? true,
      dscExpiryDate: d.dscExpiry ?? "2027-01-01",
      pan: d.pan,
    })),
  };
}

function dinDetailed(opts: { din: string; name: string; status?: string; companies: { cin: string; companyName: string; designation?: string; active?: boolean }[]; dscExpiry?: string }) {
  return {
    din: opts.din,
    name: opts.name,
    status: opts.status ?? "Approved",
    whetherDscRegistered: true,
    dscExpiryDate: opts.dscExpiry ?? "2027-01-01",
    associatedCompanies: opts.companies.map((c) => ({
      cin: c.cin,
      companyName: c.companyName,
      designation: c.designation ?? "DIRECTOR",
      dateOfAppointment: "2018-06-12",
      active: c.active ?? true,
    })),
  };
}

function proprietorDetailed(opts: { pan: string; isProprietor: boolean; gst?: { gstNo: string; gstStatus?: string; filingStatus?: string; address: string }[] }) {
  return {
    response: {
      proprietorPan: opts.isProprietor,
      pan: opts.pan,
      gstCount: opts.gst?.length ?? 0,
      gstDetailList: (opts.gst ?? []).map((g) => ({
        gstNo: g.gstNo,
        gstStatus: g.gstStatus ?? "Active",
        filingStatus: g.filingStatus ?? "Filed",
        address: g.address,
      })),
    },
    status: { input: { panNumber: opts.pan } },
  };
}

function fssai(opts: { num: string; status?: string; name: string; address: string }) {
  return { licenseNumber: opts.num, businessName: opts.name, status: opts.status ?? "Active", licenseCategory: "State License", address: opts.address, expiryDate: "2026-12-31", products: ["Packaged food"] };
}

function iec(opts: { iec: string; pan: string; name: string; status?: string; address: string }) {
  return { iec: opts.iec, entityName: opts.name, pan: opts.pan, status: opts.status ?? "Active", address: opts.address, dateOfIssue: "2020-01-15" };
}

// ---- Common constants for the Tartan sample ----
const TARTAN = {
  name: "TARTANHQ SOLUTIONS PRIVATE LIMITED",
  gstin: "27AAICT4244L1ZY",
  pan: "AAICT4244L",
  cin: "U72900MH2018PTC312345",
  address: "FLOOR-3, 264/265, VASWANI CHAMBERS, DR ANNIE BESANT ROAD, WORLI COLONY, Mumbai, Maharashtra, 400030",
  state: "Maharashtra",
  city: "Mumbai",
  pincode: "400030",
  director1: { din: "08123456", name: "PRAMEY JAIN" },
  director2: { din: "08123457", name: "MEET VINOD SEMLANI" },
};

const baseTartanInput = {
  businessName: TARTAN.name,
  vertical: "Technology" as const,
  businessType: "Private Limited" as const,
  registeredAddress: TARTAN.address,
  country: "India",
  state: TARTAN.state,
  city: TARTAN.city,
  pincode: TARTAN.pincode,
  numberOfEmployees: "85",
  email: "team-hs@tartanhq.com",
  phone: "9880942767",
  contactPerson: "PRAMEY JAIN",
  gstin: TARTAN.gstin,
  pan: TARTAN.pan,
  cin: TARTAN.cin,
};

function tartanEntityApis(overrides?: Partial<{ gstStatus: string; constitution: string; cinStatus: string; cinClass: string; multiGst: boolean }>) {
  const o = overrides ?? {};
  const pgEntries = [
    { gstin: TARTAN.gstin, status: o.gstStatus ?? "Active", constitution: o.constitution ?? "Private Limited Company", legalName: TARTAN.name, address: TARTAN.address, state: TARTAN.state },
  ];
  if (o.multiGst) {
    pgEntries.push({ gstin: "29AAICT4244L1Z3", status: "Active", constitution: "Private Limited Company", legalName: TARTAN.name, address: "Bengaluru, Karnataka, 560001", state: "Karnataka" });
  }
  return {
    "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, status: o.gstStatus ?? "Active", legalName: TARTAN.name, constitution: o.constitution ?? "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
    "PAN to GST Detailed": panToGst(TARTAN.pan, pgEntries),
    "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, TARTAN.name),
    "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: TARTAN.name, klass: o.cinClass ?? "Private", status: o.cinStatus ?? "ACTIVE", pan: TARTAN.pan, address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode, directors: [{ ...TARTAN.director1, pan: TARTAN.pan }, TARTAN.director2] }),
  };
}

function dinForPramey(cin = TARTAN.cin) {
  return dinDetailed({ din: TARTAN.director1.din, name: TARTAN.director1.name, companies: [{ cin, companyName: TARTAN.name }] });
}

const NOW = new Date().toISOString();

// ---- Scenario fixtures ----
export const SCENARIOS: ScenarioFixture[] = [
  {
    id: "happy_pvt_din",
    name: "1. Private Limited — happy path (DIN submitted)",
    description: "GST active, PAN-GST match, PAN-CIN match, CIN active, DIN found in directorDetails.",
    expectedOutcome: "KYB Passed",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "pvt_din_pending",
    name: "2. Private Limited — DIN pending",
    description: "Entity passes, user is Director/KMP but does not remember DIN.",
    expectedOutcome: "KYB Conditionally Passed – DIN Pending (deadline = formCreatedAt + 7 days)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", dinRemembered: false, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "pvt_din_expired",
    name: "3. Private Limited — DIN expired",
    description: "Entity passed 8 days ago, DIN never submitted. Use 'Simulate Day 8' control.",
    expectedOutcome: "Expired / Failed – DIN Not Submitted",
    formCreatedAt: addDays(NOW, -8),
    input: baseTartanInput,
    representative: { role: "director_kmp", dinRemembered: false, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "pvt_din_mismatch",
    name: "4. Private Limited — DIN mismatch",
    description: "DIN valid but associated with a different CIN.",
    expectedOutcome: "Manual Review / KYB Failed",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: "09999999", dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      ...tartanEntityApis(),
      "DIN Detailed": dinDetailed({ din: "09999999", name: "PRAMEY JAIN", companies: [{ cin: "U99999MH2010PTC000000", companyName: "OTHER VENTURES PRIVATE LIMITED" }] }),
    },
  },
  {
    id: "gst_cancelled",
    name: "5. GST cancelled",
    description: "GST status is Cancelled.",
    expectedOutcome: "KYB Failed",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis({ gstStatus: "Cancelled", cinStatus: "ACTIVE" }), "DIN Detailed": dinForPramey() },
  },
  {
    id: "pan_gst_mismatch",
    name: "6. PAN-GST mismatch",
    description: "Selected GSTIN not present under PAN to GST result.",
    expectedOutcome: "KYB Failed",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: TARTAN.name, constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: "07AAICT4244L1Z9", constitution: "Private Limited Company", legalName: TARTAN.name, address: "Delhi", state: "Delhi" }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, TARTAN.name),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: TARTAN.name, pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "pan_multi_gst",
    name: "7. PAN maps to multiple GSTINs",
    description: "Multiple GSTINs across states. Selected GSTIN active and matches form state → pass; else manual review.",
    expectedOutcome: "KYB Passed (selected GSTIN matches form state)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis({ multiGst: true }), "DIN Detailed": dinForPramey() },
  },
  {
    id: "name_mismatch_trade",
    name: "8. Name mismatch but trade name matches",
    description: "Legal name differs; trade name matches the form business name.",
    expectedOutcome: "Manual Review / pass with note",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessName: "TARTAN" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "THQ FINTECH HOLDINGS PRIVATE LIMITED", tradeName: "TARTAN", constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: "THQ FINTECH HOLDINGS PRIVATE LIMITED", tradeName: "TARTAN", address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, "THQ FINTECH HOLDINGS PRIVATE LIMITED"),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: "THQ FINTECH HOLDINGS PRIVATE LIMITED", pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "address_mismatch",
    name: "9. Address mismatch",
    description: "GST state/pincode differs from form.",
    expectedOutcome: "Manual Review / Fail (state mismatch is critical)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: TARTAN.name, constitution: "Private Limited Company", address: "Sector 5, Salt Lake, Kolkata, West Bengal, 700091", state: "West Bengal", pincode: "700091" }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: TARTAN.name, address: "Kolkata, West Bengal", state: "West Bengal" }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, TARTAN.name),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: TARTAN.name, pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "public_happy",
    name: "10. Public Limited — happy path",
    description: "class = PUBLIC, status ACTIVE, DIN matches.",
    expectedOutcome: "KYB Passed",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Public Limited", businessName: "TARTANHQ SOLUTIONS LIMITED" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "TARTANHQ SOLUTIONS LIMITED", constitution: "Public Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Public Limited Company", legalName: "TARTANHQ SOLUTIONS LIMITED", address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, "L72900MH2018PLC312345", "TARTANHQ SOLUTIONS LIMITED"),
      "CIN Detailed": cinDetailed({ cin: "L72900MH2018PLC312345", companyName: "TARTANHQ SOLUTIONS LIMITED", klass: "Public", pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinDetailed({ din: TARTAN.director1.din, name: TARTAN.director1.name, companies: [{ cin: "L72900MH2018PLC312345", companyName: "TARTANHQ SOLUTIONS LIMITED" }] }),
    },
  },
  {
    id: "company_reclassify",
    name: "11. Company selected → reclassifies to Private Limited",
    description: "Generic Company routing bucket; GST constitution resolves to Private Limited.",
    expectedOutcome: "KYB Passed (routed to Private Limited)",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Company" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "company_proprietorship_conflict",
    name: "12. Company selected but GST says Proprietorship",
    description: "Constitution conflict that cannot reconcile.",
    expectedOutcome: "KYB Failed / Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Company" },
    representative: { role: "director_kmp", dinRemembered: false, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "PRAMEY JAIN", constitution: "Proprietorship", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Proprietorship", legalName: "PRAMEY JAIN", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "proprietor_happy",
    name: "13. Sole Proprietorship — happy path",
    description: "proprietorPan true, active GST, user confirms proprietor.",
    expectedOutcome: "KYB Passed",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Sole Proprietorship", businessName: "PRAMEY JAIN TRADERS", cin: undefined },
    representative: { role: "proprietor", dinRemembered: false, confirmedProprietor: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "Proprietor Detailed": proprietorDetailed({ pan: TARTAN.pan, isProprietor: true, gst: [{ gstNo: TARTAN.gstin, address: TARTAN.address }] }),
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "PRAMEY JAIN", tradeName: "PRAMEY JAIN TRADERS", constitution: "Proprietorship", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Proprietorship", legalName: "PRAMEY JAIN", tradeName: "PRAMEY JAIN TRADERS", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "proprietor_false",
    name: "14. Sole Proprietorship — proprietorPan false",
    description: "PAN is not a proprietor PAN.",
    expectedOutcome: "KYB Failed",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Sole Proprietorship", businessName: "PRAMEY JAIN TRADERS", cin: undefined },
    representative: { role: "proprietor", dinRemembered: false, confirmedProprietor: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "Proprietor Detailed": proprietorDetailed({ pan: TARTAN.pan, isProprietor: false }),
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "PRAMEY JAIN", constitution: "Proprietorship", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Proprietorship", legalName: "PRAMEY JAIN", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "proprietor_tradename",
    name: "15. Sole Proprietorship — trade name ambiguity",
    description: "Proprietor PAN valid but trade name differs significantly.",
    expectedOutcome: "Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Sole Proprietorship", businessName: "ZENITH GLOBAL EXPORTS", cin: undefined },
    representative: { role: "proprietor", dinRemembered: false, confirmedProprietor: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "Proprietor Detailed": proprietorDetailed({ pan: TARTAN.pan, isProprietor: true, gst: [{ gstNo: TARTAN.gstin, address: TARTAN.address }] }),
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "PRAMEY JAIN", tradeName: "PJ STORE", constitution: "Proprietorship", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Proprietorship", legalName: "PRAMEY JAIN", tradeName: "PJ STORE", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "partnership_pending",
    name: "16. Partnership Firm — deed pending",
    description: "Entity passes; authority proof missing.",
    expectedOutcome: "KYB Conditionally Passed – Authorisation Pending",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Partnership Firm", businessName: "JAIN & SEMLANI ASSOCIATES", cin: undefined, documents: undefined as any },
    representative: { role: "designated_partner", dinRemembered: false, authorisationDocProvided: false, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "JAIN & SEMLANI ASSOCIATES", constitution: "Partnership", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Partnership", legalName: "JAIN & SEMLANI ASSOCIATES", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "llp_no_dp",
    name: "17. LLP — no designated partner data",
    description: "Entity passes but signatory proof needed.",
    expectedOutcome: "Manual Review / Authorisation Pending",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Limited Liability Partnership", businessName: "TARTANHQ TECH LLP", cin: undefined },
    representative: { role: "designated_partner", dinRemembered: false, authorisationDocProvided: false, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "TARTANHQ TECH LLP", constitution: "Limited Liability Partnership", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Limited Liability Partnership", legalName: "TARTANHQ TECH LLP", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "trust_no_gst",
    name: "18. Trust without GST",
    description: "PAN available but GST absent; trust deed uploaded.",
    expectedOutcome: "Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Trust", businessName: "TARTAN FOUNDATION", gstin: "", cin: undefined },
    representative: { role: "trustee_karta", dinRemembered: false, authorisationDocProvided: true, signatoryName: "PRAMEY JAIN" },
    api: {},
  },
  {
    id: "society_no_reg",
    name: "19. Society — GST active but registration proof missing",
    description: "Active GST, no society registration certificate.",
    expectedOutcome: "KYB Conditionally Passed – Authorisation Pending or Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Society", businessName: "WORLI WELFARE SOCIETY", cin: undefined, documents: undefined as any },
    representative: { role: "trustee_karta", dinRemembered: false, authorisationDocProvided: false, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "WORLI WELFARE SOCIETY", constitution: "Society/ Club/ Trust/ AOP", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Society/ Club/ Trust/ AOP", legalName: "WORLI WELFARE SOCIETY", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "college_operator",
    name: "20. College/University — GST belongs to operating trust",
    description: "Entity real but operator differs from institution brand.",
    expectedOutcome: "Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Colleges and Universities (set up through enactment of a statute)", businessName: "WORLI INSTITUTE OF TECHNOLOGY", vertical: "Education", cin: undefined },
    representative: { role: "authorised_employee", dinRemembered: false, authorisationDocProvided: true, signatoryName: "REGISTRAR" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "WORLI EDUCATION TRUST", constitution: "Trust", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Trust", legalName: "WORLI EDUCATION TRUST", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "branch_no_rbi",
    name: "21. Branch Office — GST active but no RBI approval",
    description: "Special entity, required RBI approval doc missing.",
    expectedOutcome: "Manual Review / Failed if missing after deadline",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Branch Office & Project Office", businessName: "GLOBALCORP INDIA BRANCH", cin: undefined, documents: undefined as any },
    representative: { role: "authorised_employee", dinRemembered: false, authorisationDocProvided: false, signatoryName: "BRANCH MANAGER" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "GLOBALCORP INDIA BRANCH", constitution: "Foreign Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Foreign Company", legalName: "GLOBALCORP INDIA BRANCH", address: TARTAN.address, state: TARTAN.state }]),
    },
  },
  {
    id: "diplomatic",
    name: "22. Diplomatic Mission — GST/UIN resolves",
    description: "Special entity — always manual review.",
    expectedOutcome: "Manual Review",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Diplomatic Missions", businessName: "EMBASSY OF EXAMPLE", vertical: "Diplomatic Missions", cin: undefined },
    representative: { role: "trustee_karta", dinRemembered: false, authorisationDocProvided: true, signatoryName: "CONSUL GENERAL" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: "07AAAGE0000A1Z5", legalName: "EMBASSY OF EXAMPLE", constitution: "Government Department", address: "Chanakyapuri, New Delhi, Delhi, 110021", state: "Delhi", pincode: "110021" }),
    },
  },
  {
    id: "food_no_fssai",
    name: "23. Food & beverage — missing FSSAI",
    description: "Base KYB passes; FSSAI add-on missing.",
    expectedOutcome: "Manual Review / Add-on Pending",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Private Limited", vertical: "Food and beverage", businessName: "TARTAN FOODS PRIVATE LIMITED" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "TARTAN FOODS PRIVATE LIMITED", constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: "TARTAN FOODS PRIVATE LIMITED", address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, "TARTAN FOODS PRIVATE LIMITED"),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: "TARTAN FOODS PRIVATE LIMITED", pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "food_with_fssai",
    name: "23b. Food & beverage — FSSAI active",
    description: "FSSAI supplied and active; add-on passes.",
    expectedOutcome: "KYB Passed",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Private Limited", vertical: "Food and beverage", businessName: "TARTAN FOODS PRIVATE LIMITED", fssai: "12345678901234" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "TARTAN FOODS PRIVATE LIMITED", constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: "TARTAN FOODS PRIVATE LIMITED", address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, "TARTAN FOODS PRIVATE LIMITED"),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: "TARTAN FOODS PRIVATE LIMITED", pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
      "FSSAI License Verification": fssai({ num: "12345678901234", name: "TARTAN FOODS PRIVATE LIMITED", address: TARTAN.address }),
    },
  },
  {
    id: "import_no_iec",
    name: "24. Import/export activity without IEC",
    description: "GST nature includes Import/Export; IEC absent.",
    expectedOutcome: "Manual Review / Add-on Pending",
    formCreatedAt: NOW,
    input: { ...baseTartanInput, businessType: "Private Limited", vertical: "Manufacturing", businessName: "TARTAN EXPORTS PRIVATE LIMITED" },
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: "TARTAN EXPORTS PRIVATE LIMITED", constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode, nature: ["Export", "Wholesale Business"] }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: "TARTAN EXPORTS PRIVATE LIMITED", address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, "TARTAN EXPORTS PRIVATE LIMITED"),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: "TARTAN EXPORTS PRIVATE LIMITED", pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "duplicate_gstin",
    name: "25. Duplicate GSTIN",
    description: "Same GSTIN already onboarded under a different account.",
    expectedOutcome: "KYB Failed / Manual Review (new admin request)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
    duplicateGstin: true,
  },
  {
    id: "doc_tampered",
    name: "26. Document tampering",
    description: "Uploaded doc OCR PAN/GST/name conflicts with API data.",
    expectedOutcome: "KYB Failed",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "doc_unreadable",
    name: "27. Document unreadable",
    description: "Document quality too low to OCR.",
    expectedOutcome: "Manual Review / Document Reupload Required",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
  {
    id: "sparse_filing",
    name: "28. Active GST but sparse filing",
    description: "GST active but no recent filings.",
    expectedOutcome: "Manual Review",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: TARTAN.name, constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode, filed: false, registrationDate: "2017-01-01" }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: TARTAN.name, address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, TARTAN.name),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: TARTAN.name, pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "newly_registered",
    name: "29. Newly registered GST",
    description: "Limited filing history acceptable because registration is recent.",
    expectedOutcome: "KYB Passed (recent registration grace)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "director_kmp", din: TARTAN.director1.din, dinRemembered: true, signatoryName: "PRAMEY JAIN" },
    api: {
      "GST Detailed III": gstDetailedIII({ gstin: TARTAN.gstin, legalName: TARTAN.name, constitution: "Private Limited Company", address: TARTAN.address, state: TARTAN.state, pincode: TARTAN.pincode, filed: false, registrationDate: addDays(NOW, -40).slice(0, 10) }),
      "PAN to GST Detailed": panToGst(TARTAN.pan, [{ gstin: TARTAN.gstin, constitution: "Private Limited Company", legalName: TARTAN.name, address: TARTAN.address, state: TARTAN.state }]),
      "PAN to CIN": panToCin(TARTAN.pan, TARTAN.cin, TARTAN.name),
      "CIN Detailed": cinDetailed({ cin: TARTAN.cin, companyName: TARTAN.name, pan: TARTAN.pan, address: TARTAN.address, directors: [TARTAN.director1] }),
      "DIN Detailed": dinForPramey(),
    },
  },
  {
    id: "employee_with_resolution",
    name: "30. Authorised employee with valid board resolution",
    description: "Entity passes; board resolution accepted (policy toggle controls auto-pass).",
    expectedOutcome: "Manual Review (auto-pass disabled by default policy)",
    formCreatedAt: NOW,
    input: baseTartanInput,
    representative: { role: "authorised_employee", dinRemembered: false, authorisationDocProvided: true, signatoryName: "ADMIN USER" },
    api: { ...tartanEntityApis(), "DIN Detailed": dinForPramey() },
  },
];

export function getScenario(id: string): ScenarioFixture | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

// OCR fixtures keyed by scenario for document checks (tamper/unreadable scenarios).
export const DOC_OCR_OVERRIDES: Record<string, "tampered" | "unreadable"> = {
  doc_tampered: "tampered",
  doc_unreadable: "unreadable",
};

export { TARTAN };

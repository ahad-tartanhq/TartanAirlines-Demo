import type {
  NormalizedCinDetails,
  NormalizedDinDetails,
  NormalizedGstDetails,
  NormalizedPanGstDetails,
  NormalizedProprietorDetails,
  NormalizedUdyamDetails,
} from "./types";

// These functions translate raw (Tartan-like) mock API responses into the
// normalized shapes consumed by the rule engine. Raw responses follow the
// documented field models in fixtures.

export function normalizeGst(raw: any): NormalizedGstDetails | undefined {
  if (!raw) return undefined;
  // Support both GST Detailed III (companyData) and GST Advanced (response.*) shapes.
  const c = raw?.response?.companyData;
  if (c) {
    return {
      gstin: c.gstin,
      status: c.sts,
      legalName: c.legalNameOfBusiness,
      tradeName: c.tradeName,
      constitution: c.constitutionOfBusiness,
      principalAddress: c.principalPlaceOfBusiness,
      state: c.state ?? extractStateFromAddress(c.principalPlaceOfBusiness),
      pincode: c.pincode ?? extractPincode(c.principalPlaceOfBusiness),
      taxpayerType: c.taxPayerType,
      filingStatus: deriveFilingStatus(raw?.response?.filingStatus),
      filingFrequency: c.currentFilingFrequency,
      registrationDate: c.effectiveDateOfRegistration,
      cancellationDate: c.dateOfCancellation,
      natureOfBusiness: raw?.response?.natureOfBusinessActivity ?? [],
      goodsServices: (raw?.response?.goodService?.businessServiceDetails ?? []).map((s: any) => s?.name ?? String(s)),
      aadhaarAuthenticated: !!c.whetherAadhaarAuthenticated,
      eInvoiceStatus: c.einvoiceStatus ?? "—",
    };
  }
  const r = raw?.response;
  if (r) {
    return {
      gstin: r["GSTIN/ UIN"] ?? r["GSTIN / UIN"] ?? r.gstin,
      status: r["GSTIN / UIN Status"] ?? r["GSTIN/ UIN Status"] ?? r.status,
      legalName: r["Legal Name of Business"],
      tradeName: r["Trade Name"],
      constitution: r["ConstitutionOfBusiness"] ?? r.ConstitutionOfBusiness,
      principalAddress: (r.placeOfBusinessData?.[0]?.address) ?? r.principalPlaceOfBusiness ?? "",
      state: r.state ?? extractStateFromAddress(r.placeOfBusinessData?.[0]?.address ?? ""),
      pincode: r.pincode ?? extractPincode(r.placeOfBusinessData?.[0]?.address ?? ""),
      taxpayerType: r["Taxpayer Type"],
      filingStatus: r.filingStatus ?? "Filed",
      filingFrequency: r.currentFilingFrequency ?? "Monthly",
      registrationDate: r["Date of registration"],
      cancellationDate: r["Date of Cancellation"],
      natureOfBusiness: r.NatureOfBusinessActivities ?? [],
      goodsServices: [...(r.goods_n_service?.goods ?? []), ...(r.goods_n_service?.services ?? [])],
      aadhaarAuthenticated: r.WhetherAadhaarAuthenticated === "Yes",
      eInvoiceStatus: r.einvoiceStatus ?? "—",
    };
  }
  return undefined;
}

function deriveFilingStatus(filingStatus: any): string {
  if (!filingStatus) return "Unknown";
  const arrs = [filingStatus.GSTR1, filingStatus.GSTR3B, filingStatus.GSTR9].filter(Boolean);
  if (arrs.length === 0) return "Sparse";
  const recent = arrs.some((a: any[]) => a.length > 0);
  return recent ? "Filed" : "Sparse";
}

function extractStateFromAddress(addr = ""): string {
  const states = ["Maharashtra", "Karnataka", "Delhi", "Gujarat", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal", "Rajasthan", "Kerala", "Haryana"];
  return states.find((s) => addr.toLowerCase().includes(s.toLowerCase())) ?? "";
}

function extractPincode(addr = ""): string {
  const m = addr.match(/\b(\d{6})\b/);
  return m ? m[1] : "";
}

export function normalizePanGst(raw: any): NormalizedPanGstDetails | undefined {
  if (!raw || raw.error) return undefined;
  const list = raw?.response?.gstListAdvanced;
  if (!Array.isArray(list)) return undefined; // no PAN→GST data available
  return {
    pan: raw?.status?.input?.panNumber ?? raw?.pan ?? "",
    gstList: list.map((g: any) => ({
      gstin: g.gstin,
      status: g.sts,
      constitution: g.constitutionOfBusiness,
      legalName: g.legalNameOfBusiness,
      tradeName: g.tradeName,
      principalAddress: g.principalPlaceOfBusiness,
      filingStatus: g.filingStatus,
      taxPayerType: g.taxPayerType,
    })),
  };
}

export function normalizeCin(raw: any): NormalizedCinDetails | undefined {
  if (!raw) return undefined;
  return {
    cin: raw.cin,
    companyName: raw.companyName,
    class: raw.class,
    subCategory: raw.subCategory,
    companyType: raw.companyType,
    status: raw.status,
    activeCompliance: raw.activeCompliance,
    pan: raw.pan,
    registeredAddress: raw.registeredAddress,
    pincode: raw.splitAddress?.pincode ?? "",
    state: raw.splitAddress?.state ?? "",
    email: raw.emailId ?? raw.emailID,
    suspendedAtStockExchange: raw.suspendedAtStockExchange,
    directors: (raw.directorDetails ?? []).map((d: any) => ({
      din: d.din,
      name: d.name,
      designation: d.designation,
      dateOfAppointment: d.dateOfAppointment,
      whetherDscRegistered: !!d.whetherDscRegistered,
      dscExpiryDate: d.dscExpiryDate,
      pan: d.pan,
    })),
  };
}

export function normalizeDin(raw: any): NormalizedDinDetails | undefined {
  if (!raw) return undefined;
  return {
    din: raw.din,
    name: raw.name,
    status: raw.status,
    whetherDscRegistered: !!raw.whetherDscRegistered,
    dscExpiryDate: raw.dscExpiryDate,
    associatedCompanies: (raw.associatedCompanies ?? []).map((a: any) => ({
      cin: a.cin,
      companyName: a.companyName,
      designation: a.designation,
      dateOfAppointment: a.dateOfAppointment,
      active: a.active !== false,
    })),
  };
}

export function normalizeProprietor(raw: any): NormalizedProprietorDetails | undefined {
  if (!raw) return undefined;
  const r = raw.response ?? raw;
  return {
    proprietorPan: !!r.proprietorPan,
    pan: r.proprietorPan === true ? (r.pan ?? raw?.status?.input?.panNumber ?? "") : (r.pan ?? ""),
    gstCount: r.gstCount ?? (r.gstDetailList?.length ?? 0),
    gstList: (r.gstDetailList ?? []).map((g: any) => ({
      gstNo: g.gstNo,
      filingStatus: g.filingStatus,
      gstStatus: g.gstStatus,
      address: g.address,
    })),
  };
}

export function normalizeUdyam(raw: any): NormalizedUdyamDetails | undefined {
  if (!raw) return undefined;
  return {
    udyamRegistrationNumber: raw.udyamRegistrationNumber,
    nameOfEnterprise: raw.nameOfEnterprise,
    organisationType: raw.organisationType,
    majorActivity: raw.majorActivity,
    isCancelled: !!raw.isCancelled,
  };
}

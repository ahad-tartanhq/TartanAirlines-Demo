// Core type definitions for the KYB onboarding & decisioning prototype.

export type BusinessVertical =
  | "Association"
  | "Automotive"
  | "Banking"
  | "Consumer"
  | "Diplomatic Missions"
  | "Education"
  | "Electronics"
  | "Energy"
  | "Engineering"
  | "Fast-moving consumer goods (FMCG)"
  | "Financial (Finance)"
  | "FinTech"
  | "Food and beverage"
  | "Government - federal, state, local"
  | "Healthcare Insurance"
  | "Jewelry"
  | "Legal"
  | "Manufacturing"
  | "Media"
  | "Not-for-profit"
  | "Oil and gas"
  | "Online (Start-Ups)"
  | "Others"
  | "Raw materials"
  | "Real estate"
  | "Religion"
  | "Retail"
  | "Technology"
  | "Telecommunications"
  | "Transportation (Travel)";

export type BusinessType =
  | "Branch Office & Project Office"
  | "Colleges and Universities (set up through enactment of a statute)"
  | "Company"
  | "Diplomatic Missions"
  | "HUF Business"
  | "Liaison Office"
  | "Limited Liability Partnership"
  | "Others"
  | "Partnership"
  | "Partnership Firm"
  | "Private Limited"
  | "Public Limited"
  | "Society"
  | "Sole Proprietorship"
  | "Trust";

export type KybStatus =
  | "KYB Passed"
  | "KYB Conditionally Passed – DIN Pending"
  | "KYB Conditionally Passed – Authorisation Pending"
  | "Manual Review"
  | "KYB Failed"
  | "Expired / Failed – DIN Not Submitted"
  | "Not Started";

export type VerificationSeverity = "low" | "medium" | "high" | "critical";

export type RuleStatus = "pass" | "fail" | "manual_review" | "pending" | "skipped";

export interface RuleResult {
  id: string;
  label: string;
  description: string;
  source: string;
  status: RuleStatus;
  severity: VerificationSeverity;
  expected?: string;
  actual?: string;
  evidence?: string;
  recommendation?: string;
}

export interface RuleTrace {
  ruleId: string;
  steps: string[];
}

export interface ApiCallLog {
  id: string;
  endpoint: string;
  request: Record<string, unknown>;
  response: unknown;
  normalized?: unknown;
  relatedRules: string[];
  timestamp: string;
}

export type DocumentState =
  | "Uploaded"
  | "Missing"
  | "Unreadable"
  | "Tampered"
  | "Mismatch"
  | "Accepted";

export interface DocumentOcr {
  extractedPAN?: string;
  extractedGSTIN?: string;
  extractedName?: string;
  extractedAddress?: string;
  confidence: number;
}

export interface DocumentUpload {
  id: string;
  label: string;
  required: boolean;
  state: DocumentState;
  ocr?: DocumentOcr;
}

export interface DocumentCheck {
  documentId: string;
  label: string;
  status: RuleStatus;
  note: string;
}

export interface EntityKybInput {
  businessName: string;
  vertical: BusinessVertical | "";
  businessType: BusinessType | "";
  registeredAddress: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  numberOfEmployees: string;
  email: string;
  phone: string;
  contactPerson: string;
  gstin: string;
  pan: string;
  cin?: string;
  udyam?: string;
  fssai?: string;
  iec?: string;
  tan?: string;
  epfo?: string;
  documents: DocumentUpload[];
}

export interface NormalizedGstDetails {
  gstin: string;
  status: string;
  legalName: string;
  tradeName: string;
  constitution: string;
  principalAddress: string;
  state: string;
  pincode: string;
  taxpayerType: string;
  filingStatus: string;
  filingFrequency: string;
  registrationDate: string;
  cancellationDate?: string;
  natureOfBusiness: string[];
  goodsServices: string[];
  aadhaarAuthenticated: boolean;
  eInvoiceStatus: string;
}

export interface NormalizedPanGstEntry {
  gstin: string;
  status: string;
  constitution: string;
  legalName: string;
  tradeName: string;
  principalAddress: string;
  filingStatus: string;
  taxPayerType: string;
}

export interface NormalizedPanGstDetails {
  pan: string;
  gstList: NormalizedPanGstEntry[];
}

export interface NormalizedDirector {
  din: string;
  name: string;
  designation: string;
  dateOfAppointment: string;
  whetherDscRegistered: boolean;
  dscExpiryDate?: string;
  pan?: string;
}

export interface NormalizedCinDetails {
  cin: string;
  companyName: string;
  class: string;
  subCategory: string;
  companyType: string;
  status: string;
  activeCompliance: string;
  pan?: string;
  registeredAddress: string;
  pincode: string;
  state: string;
  email?: string;
  suspendedAtStockExchange?: string;
  directors: NormalizedDirector[];
}

export interface NormalizedDinAssociation {
  cin: string;
  companyName: string;
  designation: string;
  dateOfAppointment: string;
  active: boolean;
}

export interface NormalizedDinDetails {
  din: string;
  name: string;
  status: string;
  whetherDscRegistered: boolean;
  dscExpiryDate?: string;
  associatedCompanies: NormalizedDinAssociation[];
}

export interface NormalizedProprietorDetails {
  proprietorPan: boolean;
  pan: string;
  gstCount: number;
  gstList: { gstNo: string; filingStatus: string; gstStatus: string; address: string }[];
}

export interface NormalizedUdyamDetails {
  udyamRegistrationNumber: string;
  nameOfEnterprise: string;
  organisationType: string;
  majorActivity: string;
  isCancelled: boolean;
}

export type RepresentativeRole =
  | "director_kmp"
  | "designated_partner"
  | "proprietor"
  | "trustee_karta"
  | "authorised_employee"
  | "on_behalf";

export interface RepresentativeClaim {
  role: RepresentativeRole | "";
  din?: string;
  dinRemembered: boolean;
  confirmedProprietor?: boolean;
  authorisationDocProvided?: boolean;
  signatoryName?: string;
}

export interface RepresentativeVerification {
  role: RepresentativeRole | "";
  rules: RuleResult[];
  status: RuleStatus;
  dinTally?: RuleResult;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface KybDecision {
  entityStatus: RuleStatus;
  representativeStatus: RuleStatus;
  finalStatus: KybStatus;
  reasons: string[];
  rules: RuleResult[];
  failedRules: RuleResult[];
  manualReviewRules: RuleResult[];
  pendingRequirements: string[];
  deadline?: string;
  daysRemaining?: number;
  nextAction: string;
  apiCalls: ApiCallLog[];
  auditTrail: AuditEvent[];
  documentChecks: DocumentCheck[];
  normalized: {
    gst?: NormalizedGstDetails;
    panGst?: NormalizedPanGstDetails;
    cin?: NormalizedCinDetails;
    din?: NormalizedDinDetails;
    proprietor?: NormalizedProprietorDetails;
    udyam?: NormalizedUdyamDetails;
  };
}

export interface ScenarioFixture {
  id: string;
  name: string;
  description: string;
  expectedOutcome: string;
  formCreatedAt: string; // ISO
  input: Partial<EntityKybInput>;
  representative?: Partial<RepresentativeClaim>;
  // raw mock api responses keyed by endpoint
  api: Record<string, unknown>;
  duplicateGstin?: boolean;
}

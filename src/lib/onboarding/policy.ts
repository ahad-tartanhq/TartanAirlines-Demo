// Prototype onboarding policy + shared status models for the email-first flow.

export const ONBOARDING_POLICY = {
  allowWorkspaceWithoutKyb: true,
  requireOtpBeforeDomainMatch: true,
  allowDomainMatchedInstantOnboarding: true,
  allowFreeEmailLimitedWorkspace: true,
  deferKybUntilTrigger: true,
  // When true, a booking can be confirmed while DIN is still pending (within grace window).
  allowBookingWithDinPending: true,
  mockOtp: "123456",
  kybTriggers: [
    "BOOKING_ATTEMPT",
    "ACTIVATE_CORPORATE_BENEFITS",
    "ENABLE_GST_INVOICING",
    "CLAIM_ADMIN_ACCESS",
    "REQUEST_CREDIT",
    "ENABLE_EXPENSE_CONTROLS",
    "ADMIN_INITIATED",
  ] as const,
  dinGraceDays: 7,
  freeEmailDomains: [
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "rediffmail.com",
    "aol.com",
  ],
  disposableDomains: ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"],
};

export type KybTrigger = (typeof ONBOARDING_POLICY.kybTriggers)[number];

export type WorkspaceStatus =
  | "Workspace Created"
  | "Company Identified"
  | "Company Identification Pending"
  | "Limited Access"
  | "Active";

export type CompanyIdentificationStatus =
  | "Domain Matched"
  | "Domain Unknown"
  | "Free Email"
  | "Company Name Match"
  | "Company Name Unresolved";

export type KybStatusModel =
  | "KYB Not Required Yet"
  | "KYB Required"
  | "KYB In Progress"
  | "KYB Passed"
  | "KYB Conditionally Passed – DIN Pending"
  | "KYB Conditionally Passed – Authorisation Pending"
  | "KYB Failed"
  | "Assisted Onboarding Required";

// Map the deep engine's internal status to a friendly user-facing label.
export function friendlyKybStatus(internal: string): KybStatusModel {
  if (internal.includes("Conditionally") && internal.includes("DIN")) return "KYB Conditionally Passed – DIN Pending";
  if (internal.includes("Conditionally") && internal.includes("Authorisation")) return "KYB Conditionally Passed – Authorisation Pending";
  if (internal.includes("Expired")) return "KYB Failed";
  if (internal.includes("Passed")) return "KYB Passed";
  if (internal.includes("Manual")) return "Assisted Onboarding Required";
  if (internal.includes("Failed")) return "KYB Failed";
  return "KYB In Progress";
}

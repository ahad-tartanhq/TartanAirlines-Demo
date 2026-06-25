// Mock domain → company enrichment registry. Prototype stand-in for a real
// domain/company enrichment provider. Legal KYB is deferred until triggered.

export interface DomainRegistryEntry {
  companyName: string;
  displayName: string;
  domain: string;
  businessType: string;
  legalEntityConfidence: "high" | "medium" | "low";
  country: string;
  knownIdentifiers: {
    gstin?: string;
    pan?: string;
    cin?: string;
  };
  source: string;
  kybStatus: "not_required_yet";
}

export const DOMAIN_REGISTRY: Record<string, DomainRegistryEntry> = {
  "tartanhq.com": {
    companyName: "TARTANHQ SOLUTIONS PRIVATE LIMITED",
    displayName: "TartanHQ",
    domain: "tartanhq.com",
    businessType: "Private Limited",
    legalEntityConfidence: "high",
    country: "India",
    knownIdentifiers: {
      gstin: "27AAICT4244L1ZY",
      pan: "AAICT4244L",
      cin: "U72900MH2021PTC000000",
    },
    source: "internal_domain_registry",
    kybStatus: "not_required_yet",
  },
  "payu.in": {
    companyName: "PAYU PAYMENTS PRIVATE LIMITED",
    displayName: "PayU",
    domain: "payu.in",
    businessType: "Private Limited",
    legalEntityConfidence: "high",
    country: "India",
    knownIdentifiers: { pan: "AAXCP6091D", gstin: "27AAXCP6091D1Z5" },
    source: "internal_domain_registry",
    kybStatus: "not_required_yet",
  },
  "icicibank.com": {
    companyName: "ICICI BANK LIMITED",
    displayName: "ICICI Bank",
    domain: "icicibank.com",
    businessType: "Public Limited",
    legalEntityConfidence: "high",
    country: "India",
    knownIdentifiers: { pan: "AAACI1195H", cin: "L65190GJ1994PLC021012", gstin: "24AAACI1195H1ZW" },
    source: "internal_domain_registry",
    kybStatus: "not_required_yet",
  },
};

export function lookupDomain(domain: string): DomainRegistryEntry | undefined {
  return DOMAIN_REGISTRY[domain.toLowerCase()];
}

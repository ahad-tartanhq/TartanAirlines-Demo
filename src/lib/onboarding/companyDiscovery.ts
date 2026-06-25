// Mock "Company Name to GST Number" discovery API. Used only when domain match
// fails or the user is on a free email. Returns plausible GST registrations.

export interface CompanyMatch {
  companyName: string;
  gstin: string;
  state: string;
  constitution: string;
  pan: string;
  cin?: string;
  businessType: string;
  confidence: number; // 0..1
}

interface SeedCompany {
  companyName: string;
  gstin: string;
  state: string;
  constitution: string;
  pan: string;
  cin?: string;
  businessType: string;
  aliases: string[];
}

const SEED: SeedCompany[] = [
  {
    companyName: "TARTANHQ SOLUTIONS PRIVATE LIMITED",
    gstin: "27AAICT4244L1ZY",
    state: "Maharashtra",
    constitution: "Private Limited Company",
    pan: "AAICT4244L",
    cin: "U72900MH2021PTC000000",
    businessType: "Private Limited",
    aliases: ["tartan", "tartanhq", "tartan hq", "tartan solutions"],
  },
  {
    companyName: "NIMBUS TECH LABS PRIVATE LIMITED",
    gstin: "29AAGCN1234M1Z3",
    state: "Karnataka",
    constitution: "Private Limited Company",
    pan: "AAGCN1234M",
    cin: "U72900KA2020PTC134567",
    businessType: "Private Limited",
    aliases: ["nimbus", "nimbus tech", "nimbus labs"],
  },
  {
    companyName: "GREENLEAF FOODS LLP",
    gstin: "07AAEFG7788K1Z1",
    state: "Delhi",
    constitution: "Limited Liability Partnership",
    pan: "AAEFG7788K",
    businessType: "Limited Liability Partnership",
    aliases: ["greenleaf", "green leaf", "greenleaf foods"],
  },
];

function score(query: string, seed: SeedCompany): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (seed.companyName.toLowerCase() === q) return 0.99;
  if (seed.aliases.some((a) => a === q)) return 0.95;
  if (seed.companyName.toLowerCase().includes(q) || seed.aliases.some((a) => a.includes(q) || q.includes(a)))
    return 0.82;
  // weak token overlap
  const tokens = q.split(/\s+/);
  const hit = tokens.some((t) => t.length > 2 && seed.companyName.toLowerCase().includes(t));
  return hit ? 0.55 : 0;
}

export function companyNameToGst(query: string): CompanyMatch[] {
  return SEED.map((s) => ({ seed: s, c: score(query, s) }))
    .filter((x) => x.c >= 0.5)
    .sort((a, b) => b.c - a.c)
    .map(({ seed, c }) => ({
      companyName: seed.companyName,
      gstin: seed.gstin,
      state: seed.state,
      constitution: seed.constitution,
      pan: seed.pan,
      cin: seed.cin,
      businessType: seed.businessType,
      confidence: c,
    }));
}

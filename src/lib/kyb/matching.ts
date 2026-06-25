// Fuzzy name & address matching utilities.

const NAME_SUFFIXES = [
  "PRIVATE LIMITED", "PVT LTD", "PVT. LTD.", "PRIVATE LTD", "LIMITED", "LTD",
  "LLP", "LIMITED LIABILITY PARTNERSHIP", "M/S", "AND", "&", "CO", "COMPANY",
  "INDIA", "ENTERPRISES", "SOLUTIONS",
];

export function normalizeName(input: string): string {
  if (!input) return "";
  let s = input.toUpperCase();
  s = s.replace(/[.,\-_/()]/g, " ");
  // remove suffix tokens
  let tokens = s.split(/\s+/).filter(Boolean);
  tokens = tokens.filter((t) => !NAME_SUFFIXES.includes(t));
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

// Returns 0..1 similarity combining token overlap and Levenshtein.
export function stringSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // token overlap (Jaccard)
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union ? inter / union : 0;

  // levenshtein-based
  const dist = levenshtein(na, nb);
  const lev = 1 - dist / Math.max(na.length, nb.length);

  return Math.max(0, Math.min(1, jaccard * 0.6 + lev * 0.4));
}

export interface AddressScore {
  score: number;
  stateMatch: boolean;
  pincodeMatch: boolean;
  cityMatch: boolean;
}

export function scoreAddress(
  form: { state: string; city: string; pincode: string; address: string },
  api: { state: string; pincode: string; address: string; city?: string },
): AddressScore {
  const stateMatch = normalizeName(form.state) === normalizeName(api.state) && !!form.state;
  const pincodeMatch = form.pincode.trim() === api.pincode.trim() && !!form.pincode;
  const cityMatch = api.city
    ? normalizeName(form.city) === normalizeName(api.city)
    : api.address.toUpperCase().includes(form.city.toUpperCase()) && !!form.city;
  const lineOverlap = stringSimilarity(form.address, api.address);

  let score = 0;
  score += stateMatch ? 0.4 : 0;
  score += pincodeMatch ? 0.3 : 0;
  score += cityMatch ? 0.15 : 0;
  score += lineOverlap * 0.15;
  return { score, stateMatch, pincodeMatch, cityMatch };
}

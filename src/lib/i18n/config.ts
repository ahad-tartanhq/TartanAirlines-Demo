// Language configuration for the multilingual app.
// Country selection sets a default (English); a toggle switches to the
// country's native language. Arabic renders right-to-left.

export type Lang = "en" | "hi" | "ar" | "ne" | "bn" | "si";

// Which languages each country offers (English first = default).
export const COUNTRY_LANGUAGES: Record<string, Lang[]> = {
  India: ["en", "hi"],
  USA: ["en"],
  UK: ["en"],
  Singapore: ["en"],
  UAE: ["en", "ar"],
  Nepal: ["en", "ne"],
  Bangladesh: ["en", "bn"],
  "Sri Lanka": ["en", "si"],
};

// Native display label for each language (shown in the toggle).
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  ar: "العربية",
  ne: "नेपाली",
  bn: "বাংলা",
  si: "සිංහල",
};

// Right-to-left languages.
export const RTL_LANGS: Lang[] = ["ar"];

// Font stack per language. Native scripts need dedicated webfonts
// (loaded via <link> in src/routes/__root.tsx).
export const LANG_FONT: Record<Lang, string> = {
  en: "",
  hi: '"Noto Sans Devanagari", system-ui, sans-serif',
  ne: '"Noto Sans Devanagari", system-ui, sans-serif',
  ar: '"Noto Sans Arabic", system-ui, sans-serif',
  bn: '"Noto Sans Bengali", system-ui, sans-serif',
  si: '"Noto Sans Sinhala", system-ui, sans-serif',
};

// ---------------------------------------------------------------------------
// Currency per country. We relabel + reformat only — the same numeric amounts
// render with the country's symbol and locale grouping (no FX conversion).
// ---------------------------------------------------------------------------
export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
}

export const COUNTRY_CURRENCY: Record<string, CurrencyConfig> = {
  India: { code: "INR", symbol: "₹", locale: "en-IN" },
  USA: { code: "USD", symbol: "$", locale: "en-US" },
  UK: { code: "GBP", symbol: "£", locale: "en-GB" },
  Singapore: { code: "SGD", symbol: "S$", locale: "en-SG" },
  UAE: { code: "AED", symbol: "AED ", locale: "en-AE" },
  Nepal: { code: "NPR", symbol: "रू ", locale: "ne-NP" },
  Bangladesh: { code: "BDT", symbol: "৳", locale: "bn-BD" },
  "Sri Lanka": { code: "LKR", symbol: "Rs ", locale: "si-LK" },
};

export function currencyFor(country: string): CurrencyConfig {
  return COUNTRY_CURRENCY[country] ?? COUNTRY_CURRENCY.India;
}

/** The bare currency symbol for a country (e.g. "₹", "$", "AED "). */
export function currencySymbol(country: string): string {
  return currencyFor(country).symbol;
}

/** Format an integer amount with the country's symbol + locale grouping. */
export function formatMoney(amount: number, country: string): string {
  const c = currencyFor(country);
  return `${c.symbol}${Math.round(amount).toLocaleString(c.locale, { maximumFractionDigits: 0 })}`;
}

export function languagesForCountry(country: string): Lang[] {
  return COUNTRY_LANGUAGES[country] ?? ["en"];
}

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.includes(lang);
}

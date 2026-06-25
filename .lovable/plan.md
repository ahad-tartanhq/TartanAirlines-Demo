# Multilingual Support — 8 Countries, Native Languages

## Goal
Add native-language support across the whole app. Selecting a country keeps the UI in **English by default**, with a **language toggle** that flips to that country's native language. Arabic renders **right-to-left**.

## Languages per country
| Country | Toggle offers |
|---|---|
| India | English · हिन्दी (Hindi) |
| UAE | English · العربية (Arabic, RTL) |
| Nepal | English · नेपाली (Nepali) |
| Bangladesh | English · বাংলা (Bengali) |
| Sri Lanka | English · සිංහල (Sinhala) |
| USA / UK / Singapore | English only (no native alternative shown) |

So six dictionaries total: `en`, `hi`, `ar`, `ne`, `bn`, `si`.

## Approach
All visible text currently lives as hardcoded English strings inside `src/routes/index.tsx` (~2000 lines). The work is: build a small i18n layer, extract every string into keyed dictionaries, translate the five native languages, and wire a toggle + RTL + script fonts.

### 1. i18n infrastructure (new `src/lib/i18n/`)
- `config.ts` — language codes, `COUNTRY_LANGUAGES` map (country → `[en, native?]`), RTL set (`ar`), and native language display labels.
- `dictionaries/en.ts` … `si.ts` — one file per language, identical key structure, organized by section (`landing.*`, `email.*`, `onboarding.*`, `dashboard.*`, `employees.*`, `policies.*`, `booking.*`, `kyb.*`, `console.*`, `common.*`).
- `context.tsx` — `I18nProvider` holding `lang` state + `dir`, and a `useT()` hook returning `t(key, vars?)` with `{var}` interpolation and English fallback for any missing key.

### 2. String extraction
Replace literal strings throughout `src/routes/index.tsx` with `t("section.key")` calls. This touches every component: `Landing`, `EmailScreen`, company discovery screens, `Dashboard`, `Overview`, `Employees`, travel `Policies`, `BookFlow`, `KybUpgradeModal`, and `ConsoleDock`. Dynamic/interpolated text (e.g. "confirmed for {company}", deadlines, counts) uses `t` with variables. Country-specific identifier labels added earlier (GSTIN, CRN, UEN, RJSC, etc.) stay as proper nouns and are **not** translated, but their surrounding helper text is.

### 3. Language toggle UX
- Add `lang` to the existing top-level state in the Index component alongside `country`. Wrap the app in `I18nProvider` so nested components read `t`/`dir` without prop drilling.
- When `country` changes, default `lang` back to `en`.
- A compact toggle (e.g. `EN | हिन्दी`) appears beside the country selector on the Landing header and Email screen, and in the Dashboard header. It only renders the native option when the selected country has one; English-only countries show no toggle (or a disabled English label).
- Persist the choice in `localStorage` so a refresh keeps the language.

### 4. RTL for Arabic
- `I18nProvider` sets `dir="rtl"` on the app's root wrapper when `lang === "ar"` (and `dir="ltr"` otherwise).
- Add targeted `rtl:` Tailwind variant overrides on the components with directional layout (headers, rows, modal close buttons, arrows/chevrons, padding/margins that use physical sides) so the Arabic layout mirrors cleanly. Directional glyphs like "→" become "←" via conditional rendering keyed on `dir`.

### 5. Fonts for native scripts
Devanagari (Hindi/Nepali), Arabic, Bengali, and Sinhala need proper webfonts. Add Noto Sans family links — `Noto Sans Devanagari`, `Noto Sans Arabic`, `Noto Sans Bengali`, `Noto Sans Sinhala` — via `<link>` tags in `src/routes/__root.tsx` head (the TanStack-correct way; not CSS @import). Apply the matching font-family through a class on the root wrapper driven by the active `lang`.

## Out of scope (kept as-is)
- Currency stays INR (₹) with `en-IN` number formatting — only text labels are translated, not amounts/numerals.
- The mock verification engine, business logic, and data remain unchanged.

## Technical notes
- `t()` returns the English string if a key is missing in a native dictionary, so partial translations never show blank UI.
- Translations are curated by me and are best-effort; a native speaker should review wording before production use (flagged in code comments).
- No backend needed — everything is static and bundled (matches the "curated static dictionaries" choice).

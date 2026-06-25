# TartanHQ — Corporate Onboarding, KYB & Travel Platform
### End-to-End Product, Technical, User & Architecture Guide

> **Document type:** Master product reference (PRD + technical spec + user guide + architecture guide + changelog)
> **Product:** TartanHQ Company Dashboard — corporate travel onboarding with deferred, trigger-based KYB (Know Your Business) verification
> **Status:** Working prototype (deterministic mock data; no live external API calls)
> **Last updated:** 24 June 2026

---

## 0. Document Map

| Section | What it covers |
|---|---|
| 1. Executive Summary | What the product is and why it exists |
| 2. Product Vision & Goals | Problem, principles, success criteria |
| 3. Personas & User Roles | Who uses it |
| 4. Capabilities Overview | Full feature inventory |
| 5. Product Requirements (PRD) | Detailed functional requirements per module |
| 6. User Journeys | Step-by-step flows |
| 7. KYB Decision Engine | The verification brain — layers, rules, statuses |
| 8. Internationalization (i18n) | 8 countries, 6 languages, RTL |
| 9. Country-Specific Identifiers | Per-country KYB fields |
| 10. Architecture & Tech Stack | How it's built |
| 11. Data Models | Core type definitions |
| 12. Mock API Suite | The simulated HyperVerify endpoints |
| 13. Decisions & Rationale | Why things are the way they are |
| 14. Assumptions & Constraints | What we took for granted |
| 15. Out of Scope / Known Limitations | What it deliberately does not do |
| 16. Changelog | Version history |
| 17. Glossary | Terminology |

---

## 1. Executive Summary

TartanHQ is a **corporate travel onboarding and decisioning platform**. A business
user signs up with a work email, the system **identifies their company automatically**
(domain enrichment / company-name lookup), provisions a workspace immediately, and
**defers heavyweight legal verification (KYB)** until the moment it is actually needed
— for example, when an admin tries to confirm a corporate booking or unlock corporate
benefits.

When KYB is triggered, a layered, fully-explainable decision engine runs entity and
representative checks against a mock **Tartan HyperVerify-style** API suite, produces
a final decision (Pass / Conditional / Manual Review / Fail), and exposes every step
in a developer-facing process log.

The experience is **multilingual across 8 countries and 6 languages** (with full
right-to-left support for Arabic) and adapts its legal-identifier fields to the
selected country (GSTIN for India, CRN for the UK, UEN for Singapore, etc.).

> **Design philosophy:** *Onboard first, verify later, explain everything.*

---

## 2. Product Vision & Goals

### 2.1 The Problem
Traditional corporate onboarding forces full legal verification (KYB) up front. This
creates friction, abandons users at the door, and verifies businesses that may never
transact. Most corporate platforms also assume a single country's identifier scheme
and a single language.

### 2.2 The Solution Principles
1. **Frictionless entry** — a user reaches a working workspace with just an email + OTP.
2. **Deferred KYB** — legal verification is triggered only by meaningful actions, not at signup.
3. **Progressive trust** — workspace access levels scale with how confidently the company is identified.
4. **Explainability** — every API call, rule, and decision is auditable.
5. **Global by default** — country-aware identifiers and native-language UI.
6. **Policy-driven** — strictness is centrally tunable, not hard-coded into rules.

### 2.3 Success Criteria (prototype)
- A user can go email → OTP → identified workspace in under a minute.
- KYB only fires on a defined trigger (e.g. booking confirmation).
- The decision engine deterministically reproduces all curated edge-case scenarios.
- The full UI renders correctly in all 6 languages, including RTL Arabic.

---

## 3. Personas & User Roles

| Persona | Description | Key actions |
|---|---|---|
| **Admin** | Company administrator / authorised signatory | Completes KYB, manages employees, sets travel policies, confirms bookings |
| **Member** | Regular employee | Searches/reviews travel, but cannot complete KYB or confirm gated bookings |
| **Operator / Reviewer** (internal) | Compliance / demo operator | Reads the verification console, drives demo scenarios |

In-app, the dashboard supports a **"View as" switch** (Admin ↔ Member) to demonstrate
role-gated behaviour. Member view hides the Employees tab and KYB completion.

---

## 4. Capabilities Overview

### 4.1 Onboarding & Identity
- Email-first signup with domain classification (corporate / free / disposable / invalid).
- Mock OTP verification (`123456`).
- Automatic company identification via **domain registry** enrichment.
- Fallback **company-name → GST** discovery when the domain is unknown or free-email.
- Progressive workspace status (Workspace Created → Company Identified → Active / Limited Access).

### 4.2 Workspace / Dashboard
- **Overview** — company profile, verification status, identification source, calls to action.
- **Employees / Org** — people directory, travel policies, approval workflows, groups; bulk add via CSV / SFTP / HRMS connectors; manager assignment.
- **Book (travel)** — search → results → review → confirm flight booking flow with verification gating.

### 4.3 Verification (KYB)
- **Trigger-based KYB** — fires on defined events (booking attempt, benefit activation, etc.).
- **KYB upgrade modal** — collects country-specific identifiers, representative/authority claim, and documents.
- **Document upload flow** — supports both uploaded documents and portal-completed authority (board resolution / DIN).
- **Layered decision engine** — base + business-type + vertical + signatory rules.
- **7-day DIN grace window** for Indian directors.

### 4.4 Explainability
- **Process / Verification console dock** — running event log of every onboarding/verification action with tone-coded entries.
- Decision engine emits API call logs, rule traces, an audit trail, and document checks.

### 4.5 Internationalization
- 8 countries, 6 languages, native-script webfonts, full RTL for Arabic, language toggle, `localStorage` persistence.

### 4.6 Theming & Layout
- Fully token-based theming (semantic CSS variables) ready for light/dark and density variants. `ThemeToggle` and `LayoutToggle` components exist in the codebase but are not currently mounted in the main app route (`index.tsx`); layout direction is driven by the i18n `dir` attribute.

---

## 5. Product Requirements (PRD)

### 5.1 Module: Email-First Onboarding

**Goal:** Get a user from an email address to an identified workspace with minimal friction.

| ID | Requirement |
|---|---|
| ON-1 | Accept an email and validate format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). |
| ON-2 | Classify the domain as `corporate`, `free`, `disposable`, or `invalid`. |
| ON-3 | Reject disposable domains with an explanatory error. |
| ON-4 | Require OTP verification before proceeding (mock OTP `123456`). |
| ON-5 | On corporate domain match, identify the company from the domain registry and provision a workspace at the appropriate access level. |
| ON-6 | On unknown corporate domain, route to **company-name entry** → discovery. |
| ON-7 | On free email, capture company details, then run discovery. |
| ON-8 | If discovery returns matches, present a selectable list (ranked by confidence). |
| ON-9 | If discovery returns nothing, create a **Limited Workspace**. |
| ON-10 | A confirmed workspace must **not** require KYB at this stage (`KYB Not Required Yet`). |

**Workspace status model** (`WorkspaceStatus`): `Workspace Created`, `Company Identified`,
`Company Identification Pending`, `Limited Access`, `Active`.

**Company identification status** (`CompanyIdentificationStatus`): `Domain Matched`,
`Domain Unknown`, `Free Email`, `Company Name Match`, `Company Name Unresolved`.

### 5.2 Module: Dashboard / Workspace

| ID | Requirement |
|---|---|
| DB-1 | Provide three primary tabs: **Overview**, **Employees**, **Book**. |
| DB-2 | Employees tab is **Admin-only**; Member view falls back to Overview. |
| DB-3 | Overview surfaces company name, identification source, current verification status, and a primary CTA (start/continue verification). |
| DB-4 | Provide a "View as" role switch (Admin / Member) across known accounts. |
| DB-5 | Persist employees and bookings in component state during the session. |

**Employees / Org sub-tabs:** `people`, `policies`, `approvals`, `groups`.
- **People** — directory with name, email, role, group, status (Invited/Joined), added-by.
- **Policies** — travel policy management (the policy module supports both uploaded policy documents and policies authored in-portal).
- **Approvals** — multi-stage approval chain (e.g. Manager → Finance).
- **Groups** — organisational grouping.
- **Add employee** — two-step flow: details → assign managers.
- **Bulk data import** — method picker → CSV / SFTP / HRMS (select platform → config → API key).

### 5.3 Module: Travel Booking (BookFlow)

| ID | Requirement |
|---|---|
| BK-1 | Steps: `search` → `results` → `review` → `result` (with a `verify-needed` interrupt). |
| BK-2 | Allow search and review **before** verification (`allowSearchBeforeVerification`, `allowReviewBeforeVerification`). |
| BK-3 | **Block confirmation** before verification is complete (`allowConfirmBeforeVerification = false`). |
| BK-4 | When confirmation is attempted and verification is incomplete, show a `verify-needed` screen. Admins can launch the KYB modal; members are told to ask an admin. |
| BK-5 | Booking outcome is derived from KYB status (see below). |
| BK-6 | Each booking records an outcome note (translatable via `noteKey`). |

**Booking outcomes (`bookingOutcomeFor`):**

| KYB status | Outcome | Meaning |
|---|---|---|
| KYB Passed | `confirmed` | Company verified — booking confirmed |
| DIN/Authorisation Pending | `confirmed` or `hold` | Depends on `allowBookingWithAuthorityPending` |
| Assisted Onboarding Required | `hold` | Team will assist with verification |
| KYB Failed | `blocked` | Booking blocked; workspace stays active |

### 5.4 Module: KYB Upgrade Modal

**Trigger:** one of `ONBOARDING_POLICY.kybTriggers` — `BOOKING_ATTEMPT`,
`ACTIVATE_CORPORATE_BENEFITS`, `ENABLE_GST_INVOICING`, `CLAIM_ADMIN_ACCESS`,
`REQUEST_CREDIT`, `ENABLE_EXPENSE_CONTROLS`, `ADMIN_INITIATED`.

**Stages:** identifier entry → (`gst-verified` for company-like types) → representative
declaration → authority confirmation (DIN or board resolution / document) → result.

| ID | Requirement |
|---|---|
| KY-1 | Show country-appropriate identifier fields (see §9), with an optional fallback identifier (e.g. India GSTIN → UDYAM). |
| KY-2 | Collect the user's **registering role** (Director/KMP, Authorised Signatory, Admin, Member). |
| KY-3 | Require a declaration acknowledgement where applicable. |
| KY-4 | Offer two authority paths: **DIN-style director identity** *or* **document upload** (board resolution / authorisation letter). |
| KY-5 | Allow "provide later" → produces a conditional/pending outcome within the grace window. |
| KY-6 | Director identity field is shown **only** for countries that have one (India DIN, UK Companies House ID, Singapore NRIC/FIN). Others omit it. |
| KY-7 | Invoke `runKybDecision` with the assembled entity input, representative claim, and a synthesised/looked-up API bundle. |
| KY-8 | Map the engine's internal status to a friendly user-facing verification label. |

### 5.5 Module: Verification Console / Process Log (ConsoleDock)

| ID | Requirement |
|---|---|
| CO-1 | A floating dock toggled from any screen. |
| CO-2 | Show a chronological list of process events, each with a label, value, and tone (`ok`/`warn`/`info`/`bad`). |
| CO-3 | Display the running event count. |

> The deeper engine (`KybDecision`) additionally produces a full **API call log**,
> **rule trace**, **decision**, **audit timeline**, and **tally matrix** — the data
> backbone for an expanded internal console.

---

## 6. User Journeys

### 6.1 Happy path — known corporate domain
```text
Landing → Enter work email (corp domain) → OTP (123456)
       → Company auto-identified from domain registry
       → "Company Found" confirmation → Active workspace
       → Browse / search travel freely
       → Attempt to CONFIRM booking → KYB triggered
       → Identifier (GSTIN) verified → Declare as Director/KMP
       → Provide DIN (or upload board resolution)
       → KYB Passed → Booking confirmed ✅
```

### 6.2 Unknown domain / free email
```text
Email (unknown/free) → OTP → Company name entry
   → Discovery (companyNameToGst)
       ├── matches → pick company → workspace
       └── no match → Limited Workspace
```

### 6.3 Deferred verification with DIN pending
```text
KYB triggered → Identifier verified → "Provide DIN later"
   → KYB Conditionally Passed – DIN Pending (7-day window)
   → Booking may proceed depending on policy
   → If window elapses without DIN → Expired / Failed
```

---

## 7. KYB Decision Engine

The engine (`src/lib/kyb/`) is a self-contained, typed, deterministic library. Its
entry point is `runKybDecision(input, representative, options)`.

### 7.1 Decision layering
```text
Base entity KYB
  + Business-type-specific rules
  + Vertical / risk add-on rules
  + Representative (signatory) authority verification
  + 7-day DIN / authorisation grace workflow
  = Final KYB decision
```

### 7.2 Rule layers

**Base rules (`baseRules.ts`)** — 10 entity tallies:
1. GST status (active/cancelled)
2. PAN–GST linkage
3. Constitution match (GST constitution ↔ selected business type)
4. Legal/trade name match (fuzzy similarity)
5. Address match (state/pincode/line scoring)
6. Filing health (recent filings; new registrations exempt)
7. Taxpayer type
8. Business activity sanity
9. Document consistency (OCR vs API; tampered/unreadable/missing)
10. Duplicate check (PAN/GSTIN already onboarded)

**Business-type rules (`businessTypeRules.ts`)** — constitution-specific:
- Company (Pvt/Public): PAN→CIN resolution, CIN status, class check, name match, PAN match.
- Sole proprietorship: proprietor PAN, GST count, trade name.
- LLP / Partnership: constitution mapping + routing note.
- Special entities (Trust/Society/HUF/College/Branch/Liaison/Diplomatic): manual-review-by-default.
- Others: reclassification attempt.

**Vertical add-ons (`verticalAddonRules.ts`)** — risk modifiers:
- Food & beverage → FSSAI licence.
- Import/Export → IEC.
- Udyam (MSME) enrichment.
- Banking/Finance/FinTech/Insurance → higher manual-review threshold.
- Government/Diplomatic → manual review.
- Large employer (>50) → EPFO/TAN enrichment.

**Signatory rules (`signatoryRules.ts`)** — representative authority:
- Director/KMP → DIN tally (DIN active + linked to verified CIN + name + designation).
- Designated partner → DIN or partnership/LLP authorisation.
- Proprietor → confirmation + PAN tally.
- Trustee/Karta → constitution/authority proof.
- Authorised employee → authorisation letter / board resolution.
- On-behalf → never auto-approved.

### 7.3 Status precedence (`KybStatus`)
1. Entity critical fail → **KYB Failed**
2. DIN required, grace elapsed → **Expired / Failed – DIN Not Submitted**
3. Any failed rule → **KYB Failed**
4. High/critical manual-review rule → **Manual Review**
5. DIN pending within window → **KYB Conditionally Passed – DIN Pending**
6. Authorisation/doc pending → **KYB Conditionally Passed – Authorisation Pending**
7. Representative needs review → **Manual Review**
8. Entity + representative both pass → **KYB Passed**

> **Prototype note:** The current `decisionEngine.ts` short-circuits to `KYB Passed`
> for demo flows while still computing and logging all rules, API calls, and the audit
> trail. The full precedence logic above is implemented and exercised by the scenario
> regression harness via the rule layers. The friendly user-facing layer
> (`onboarding/policy.ts → friendlyKybStatus`) maps internal statuses to the labels
> users actually see.

### 7.4 Policy configuration (`KYB_POLICY`)
Centralised, tunable knobs so reviewers can change strictness without touching rules:
`dinGraceDays` (7), `allowConditionalEntityApproval`, `allowEmployeeAuthorisationAutoPass`,
`requireRecentGstFilings`, `allowTradeNameMatch`, `requireFssaiForFood`,
`requireIecForImportExport`, `strictAddressMatch`, `manualReviewForSpecialEntities`.
Similarity thresholds: `strongPass = 0.90`, `manualReviewLow = 0.75`.

### 7.5 Scenario regression harness
`bun run test:scenarios` runs all 31 curated fixtures (`happy_pvt_din`, `pvt_din_pending`,
`pvt_din_expired`, `gst_cancelled`, `pan_gst_mismatch`, `proprietor_*`, `trust_no_gst`,
`diplomatic`, `food_no_fssai`, `doc_tampered`, `duplicate_gstin`, …) through the engine
and asserts each produces an accepted outcome. Two ways to drive data:
- **Registry mode** (`registry.ts`) — each sample company has unique identifiers; typing a
  matching GSTIN/PAN/DIN self-resolves the response bundle.
- **Live bundle mode** (`liveBundle.ts`) — synthesises a self-consistent API bundle for a
  chosen outcome (`pass`, `gst_cancelled`, `name_mismatch`, `pan_gst_mismatch`,
  `address_mismatch`, `din_mismatch`) from whatever the operator typed.

---

## 8. Internationalization (i18n)

**Coverage:** entire app UI. **Toggle model:** country selection defaults to English,
with a toggle to the country's native language. **Source:** curated static dictionaries.
**Arabic:** full RTL.

### 8.1 Languages per country (`COUNTRY_LANGUAGES`)
| Country | Toggle offers |
|---|---|
| India | English · हिन्दी (Hindi) |
| UAE | English · العربية (Arabic, RTL) |
| Nepal | English · नेपाली (Nepali) |
| Bangladesh | English · বাংলা (Bengali) |
| Sri Lanka | English · සිංහල (Sinhala) |
| USA / UK / Singapore | English only |

Six dictionaries: `en`, `hi`, `ar`, `ne`, `bn`, `si`.

### 8.2 Mechanics
- `I18nProvider` (`context.tsx`) holds `lang` + `country` state and `dir`; persists language to `localStorage` (`tartan.lang`).
- `useT()` returns `t(key, vars?)` with `{var}` interpolation and **English fallback** for any missing key (partial translations never show blank UI).
- Changing country resets to English unless the active language is offered there.
- `dir="rtl"` is applied for Arabic; directional glyphs (→/←) flip accordingly.
- Native-script webfonts (Noto Sans Devanagari / Arabic / Bengali / Sinhala) are loaded via `<link>` in `__root.tsx` and applied via `LANG_FONT`.

### 8.3 Translation caveat
Translations are curated and best-effort. A native speaker should review wording before
production. Currency stays INR (₹, `en-IN` formatting) — only text labels are translated.

---

## 9. Country-Specific Identifiers (`COUNTRY_KYB`)

| Country | Primary identifier(s) | Fallback | Director identity field |
|---|---|---|---|
| **India** | Company GSTIN (e.g. `27AAICT4244L1ZY`) | UDYAM number | **DIN** |
| **USA** | State of incorporation (+ EIN, optional) | — | *(none)* |
| **UK** | Company Registration Number (CRN, 8 chars, e.g. `00445790`) | — | **Verified Director Identity (Companies House)** e.g. `CHID-9K4P-72XF` |
| **Singapore** | UEN (e.g. `197200078R`) | — | **NRIC / FIN** (e.g. `S1234567D` / `F1234567N`) |
| **UAE** | Trade License No. + issuing authority/emirate | — | *(none)* |
| **Bangladesh** | RJSC Registration Number (e.g. `C-31531 (652)/96`) | — | *(none)* |
| **Sri Lanka** | Company Registration Number (PV/PQ/PB xxxxx) | — | *(none)* |
| **Nepal** | OCR Registration Number + PAN/VAT | — | *(none)* |

**Rule:** the director/authorised-person identity field appears **only** for India, UK,
and Singapore. For all other countries it is omitted; authority is established via
document upload (board resolution / authorisation letter).

---

## 10. Architecture & Tech Stack

### 10.1 Stack
- **Framework:** TanStack Start v1 (React 19, SSR-capable), file-based routing.
- **Build:** Vite 7, Lightning CSS.
- **Styling:** Tailwind CSS v4 (via `src/styles.css`), shadcn/ui component library, semantic design tokens.
- **State:** React local state (no backend for the prototype).
- **Icons:** lucide-react. **Charts:** recharts. **Toasts:** sonner.
- **Language/typing:** TypeScript (strict).

### 10.2 Route structure
- `src/routes/__root.tsx` — root shell; mounts `I18nProvider`, injects fonts, sets head.
- `src/routes/index.tsx` — the entire app (`OnboardingApp`): landing, onboarding screens, dashboard, booking, KYB modal, console dock (~2,120 lines).

### 10.3 Library structure
```text
src/lib/
├── i18n/
│   ├── config.ts            # COUNTRY_LANGUAGES, LANG_LABELS, RTL_LANGS, LANG_FONT
│   ├── context.tsx          # I18nProvider, useI18n, useT
│   └── dictionaries/        # en, hi, ar, ne, bn, si + index
├── onboarding/
│   ├── policy.ts            # ONBOARDING_POLICY, status models, friendlyKybStatus
│   ├── domainClassifier.ts  # email → corporate/free/disposable/invalid
│   ├── domainRegistry.ts    # domain → company enrichment (mock)
│   └── companyDiscovery.ts  # company name → GST matches (mock)
└── kyb/
    ├── types.ts             # all domain types
    ├── constants.ts         # verticals, business types, KYB_POLICY, templates
    ├── decisionEngine.ts    # runKybDecision orchestrator
    ├── mockApi.ts           # MockApiClient + call logging
    ├── normalize.ts         # raw → normalized API shapes
    ├── matching.ts          # fuzzy string/address matching
    ├── dateUtils.ts         # grace-window math + date simulation
    ├── fixtures.ts          # raw builders + 31 scenarios
    ├── registry.ts          # unique-identifier sample-company resolver
    ├── liveBundle.ts        # synthesise outcome-specific API bundles
    ├── audit.ts             # audit event helper
    └── rules/
        ├── baseRules.ts
        ├── businessTypeRules.ts
        ├── verticalAddonRules.ts
        ├── signatoryRules.ts
        └── context.ts       # RuleContext + mkRule
```

### 10.4 Key design property: separation of concerns
The decision engine is **UI-independent**. It is a pure function of (input, representative,
api-bundle, dates). The UI assembles inputs and renders results; the engine has no React
dependency and is independently testable.

---

## 11. Data Models (selected)

```ts
// Entity being verified
interface EntityKybInput {
  businessName; vertical; businessType; registeredAddress;
  country; state; city; pincode; numberOfEmployees;
  email; phone; contactPerson;
  gstin; pan; cin?; udyam?; fssai?; iec?; tan?; epfo?;
  documents: DocumentUpload[];
}

// Who is acting on behalf of the entity
interface RepresentativeClaim {
  role: "director_kmp" | "designated_partner" | "proprietor"
      | "trustee_karta" | "authorised_employee" | "on_behalf" | "";
  din?; dinRemembered; confirmedProprietor?;
  authorisationDocProvided?; signatoryName?;
}

// Engine output
interface KybDecision {
  entityStatus; representativeStatus; finalStatus;
  reasons; rules; failedRules; manualReviewRules; pendingRequirements;
  deadline?; daysRemaining?; nextAction;
  apiCalls; auditTrail; documentChecks; normalized;
}
```

**Document states:** `Uploaded`, `Missing`, `Unreadable`, `Tampered`, `Mismatch`, `Accepted`
(with optional OCR extraction + confidence).

---

## 12. Mock API Suite (HyperVerify-style)

All calls are **deterministic mocks** — no network egress. Only these endpoints are modelled:
CIN Basic/Detailed, Company Name to GST, DIN Detailed, Employer EPFO Basic/Detailed,
FSSAI License Verification, GST Details, GST Details Advanced, GST Detailed III,
Import-Export Code Verification, Mobile to GST, Mobile to Udyam, PAN to GST Detailed,
PAN to GST Status, Proprietor Detailed, TAN Detail, MCA Financial Summary, PAN to CIN,
Udyam Verification with Certificate.

`MockApiClient` records an `ApiCallLog` (endpoint, request, response, normalized output,
related rules, timestamp) for every call, powering the console/audit views. Response shapes
mirror real Tartan JSON samples where provided; the rest are clearly synthetic.

---

## 13. Decisions & Rationale

| # | Decision | Rationale |
|---|---|---|
| D-1 | Defer KYB until a trigger | Reduce signup friction; only verify businesses that transact. |
| D-2 | Email + domain enrichment for identity | Most corporates have a resolvable domain; instant value. |
| D-3 | Centralised `KYB_POLICY` toggles | Reviewers tune strictness without editing rule code. |
| D-4 | Layered rule architecture | Each layer (base/type/vertical/signatory) is independently reasoned and testable. |
| D-5 | Engine decoupled from UI | Deterministic, harness-testable, reusable. |
| D-6 | User-facing "Verification" vocabulary, internal "KYB" | Friendlier UX while preserving engine semantics. |
| D-7 | 7-day DIN grace window | Lets entities onboard while directors retrieve DIN. |
| D-8 | Country-aware identifiers, director field only for IN/UK/SG | Match real legal regimes; avoid asking for fields that don't exist. |
| D-9 | Curated static dictionaries (not machine translation) | Predictable, reviewable, no backend, offline-safe. |
| D-10 | English fallback in `t()` | Partial translations never break the UI. |
| D-11 | Auto-from-country language model | One toggle; sensible default (English) with native opt-in. |
| D-12 | Full RTL for Arabic | Correct, not cosmetic, for UAE users. |
| D-13 | Two doc paths (upload **and** portal-authored) | Policies and authority can be supplied either way. |
| D-14 | Unique-identifier registry + live bundle | Demo any outcome from real typed input without a scenario picker. |
| D-15 | Prototype short-circuits to KYB Passed in the live UI | Smooth demos while the full rule machinery still runs and logs. |

---

## 14. Assumptions & Constraints

- **No real external APIs** — everything is mock/deterministic; no PII leaves the app.
- **No persistent backend** — workspace, employees, and bookings live in session state; a refresh resets transactional data (language persists in `localStorage`).
- **Mock OTP** is always `123456`.
- **Currency** is INR with `en-IN` formatting regardless of country/language.
- **KYB rule depth is India-centric** (GST/PAN/CIN/DIN). Other countries collect identifiers but the deep rule engine is modelled on Indian schemes.
- **Translations are best-effort** and need native review before production.
- **Identity matching** uses fuzzy similarity thresholds (0.75 / 0.90), not authoritative registries.
- **Document OCR** is simulated (states + confidence), not real OCR.
- **Date simulation** (Today / Day 3 / Day 7 / Day 8) exists in the standalone KYB demo/console harness to exercise the grace window deterministically; the main app route uses real wall-clock time. The scenario picker and multi-tab inspector (Payload / API / Rules / Decision / Timeline / Matrix) likewise live in that separate KYB demo surface, not in the main onboarding route whose `ConsoleDock` is a simplified sequential event log.

---

## 15. Out of Scope / Known Limitations

- Real authentication, sessions, and authorization.
- Real payments / actual flight inventory.
- Live KYB provider integrations and webhooks.
- Server-side persistence, multi-tenant data isolation, audit storage.
- Non-Indian deep KYB rule sets (UK/SG/UAE/etc. identifiers are collected but not rule-verified to the depth of India).
- Production-grade translation QA.
- Accessibility audit beyond semantic HTML / RTL basics.

---

## 16. Changelog

> Reverse-chronological. Dates approximate to development milestones.

### v0.6 — Multilingual support (current)
- Added full i18n layer (`src/lib/i18n/`): config, provider, `useT` hook, 6 dictionaries.
- Entire UI string-extracted into keyed dictionaries with `{var}` interpolation.
- Language toggle (auto-from-country; English default + native opt-in) on Landing, Email, Dashboard headers.
- Full RTL support for Arabic; directional glyph flipping.
- Native-script webfonts (Noto Sans Devanagari/Arabic/Bengali/Sinhala) via root `<link>` tags.
- Language persisted in `localStorage`; English fallback for missing keys.

### v0.5 — Country-aware identifiers & director identity
- Replaced India-only GSTIN/UDYAM/DIN with per-country identifier configuration (`COUNTRY_KYB`).
- Added US (State + EIN), UK (CRN + Companies House identity), Singapore (UEN + NRIC/FIN), UAE (Trade License + authority), Bangladesh (RJSC), Sri Lanka (CRN), Nepal (OCR + PAN/VAT).
- Director identity field restricted to India / UK / Singapore; omitted elsewhere.

### v0.4 — Document upload + portal-authored policies
- Added a document upload flow alongside in-portal policy creation.
- Travel policies can be uploaded **or** authored in the portal.

### v0.3 — Deferred, trigger-based KYB
- KYB upgrade modal wired to defined triggers (booking attempt, benefit activation, etc.).
- Booking gating: search/review allowed pre-verification; confirmation gated.
- Friendly user-facing "Verification" vocabulary over internal KYB statuses.

### v0.2 — Decision engine + scenarios
- Layered rule engine (base / business-type / vertical / signatory).
- 31 curated scenario fixtures + regression harness (`test:scenarios`).
- Unique-identifier registry and live-bundle synthesiser.
- 7-day DIN grace window and date simulation.

### v0.1 — Email-first onboarding foundation
- Email classification, mock OTP, domain registry enrichment, company-name discovery.
- Workspace provisioning with progressive access levels.
- Dashboard (Overview / Employees / Book) and process-log console dock.

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **KYB** | Know Your Business — corporate identity & authority verification. |
| **GSTIN** | Indian Goods & Services Tax Identification Number. |
| **PAN** | Indian Permanent Account Number. |
| **CIN** | Corporate Identification Number (Indian companies). |
| **DIN** | Director Identification Number (India). |
| **UDYAM** | Indian MSME registration. |
| **CRN** | UK Company Registration Number. |
| **UEN** | Singapore Unique Entity Number. |
| **NRIC / FIN** | Singapore national / foreigner identification numbers. |
| **RJSC** | Bangladesh Registrar of Joint Stock Companies number. |
| **OCR (Nepal)** | Nepal Office of Company Registrar number. |
| **OCR (docs)** | Optical Character Recognition (document extraction). |
| **Grace window** | 7-day period to submit DIN before conditional pass expires. |
| **Trigger** | A user action that initiates KYB. |
| **Manual Review** | Outcome requiring human compliance review. |
| **RTL** | Right-to-left text direction (Arabic). |

---

*End of document.*

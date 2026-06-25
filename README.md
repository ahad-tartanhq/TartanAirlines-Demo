# KYB Onboarding & Decisioning Prototype

An end-to-end prototype of a corporate **KYB (Know Your Business)** onboarding and
decisioning flow, inspired by an Air India AI Biz-style corporate onboarding journey
and built on top of **Tartan HyperVerify-style APIs** using fully mocked data.

It demonstrates how a business user fills a corporate onboarding form, how the
backend runs layered KYB checks, how each field tallies against API responses, and
how a final decision (Pass / Conditional / Manual Review / Fail) is produced — all
explained in a developer console.

> No real external APIs are called. Everything is deterministic mock data driven by
> scenario fixtures. The prototype uses **only** the HyperVerify suite listed below.

---

## Running

```bash
bun install
bun run dev        # start the app (Vite + TanStack Start)
```

Open the app. The UI is a two-panel layout:

- **Left** — the 8-step onboarding portal (Business → Address → Communication → Tax →
  Documents → Entity KYB → Signatory → Decision).
- **Right** — an *Internal Verification Console* with tabs for the raw **Payload**,
  **API** call log, **Rules** trace, final **Decision**, **Timeline** (audit trail),
  and the tally **Matrix**.

Use the **Demo scenario** dropdown (top) to prefill the form with any of the 31
edge-case scenarios, and **Simulate date** (Today / Day 3 / Day 7 / Day 8) to exercise
the 7-day DIN grace window.

### Running the scenario regression harness

```bash
bun run test:scenarios
```

This runs every fixture scenario through the decision engine and asserts the final
status matches the outcome allowed by each scenario. Expected: `31/31 scenarios
produced an accepted outcome.`

---

## Architecture

The decision logic is a self-contained, typed library under `src/lib/kyb/`:

| File | Responsibility |
|------|----------------|
| `types.ts` | All domain types (inputs, normalized API shapes, `KybDecision`, `RuleResult`, `ScenarioFixture`). |
| `constants.ts` | Business types, verticals, `KYB_POLICY` toggles, similarity thresholds, document templates. |
| `mockApi.ts` | `MockApiClient` — looks up deterministic responses from the active scenario and records an `ApiCallLog` per call. |
| `normalize.ts` | Translates raw HyperVerify-style responses into normalized shapes for the rules. |
| `matching.ts` | Fuzzy string + address matching helpers. |
| `dateUtils.ts` | 7-day DIN grace window math and date simulation. |
| `decisionEngine.ts` | `runKybDecision` — the orchestrator that triggers APIs, runs rule layers, and derives the final status. |
| `rules/baseRules.ts` | 10 base entity tallies (GST status, PAN-GST linkage, constitution, name, address, filing, documents, duplicates…). |
| `rules/businessTypeRules.ts` | Constitution-specific rules (company CIN/DIN chain, proprietor, partnership/LLP, special entities, "Others" routing). |
| `rules/verticalAddonRules.ts` | Vertical add-ons (FSSAI for food, IEC for import/export, Udyam enrichment, regulated/government verticals, large-employer EPFO/TAN). |
| `rules/signatoryRules.ts` | Representative authority verification (DIN tally, proprietor, partner, trustee/Karta, employee, on-behalf). |
| `fixtures.ts` | Raw response builders + the 31 scenario fixtures. |
| `audit.ts` | Audit-trail event helper. |

### Decision layering

```text
Base entity KYB
  + Business-type-specific rules
  + Vertical / risk add-ons
  + Representative authority verification
  + 7-day DIN / authorisation grace workflow
  = Final KYB decision
```

Final status precedence (see `decisionEngine.ts`):

1. Entity critical fail → **KYB Failed**
2. DIN required, grace window elapsed → **Expired / Failed – DIN Not Submitted**
3. Any failed rule → **KYB Failed**
4. High/critical manual-review rule → **Manual Review**
5. DIN pending within window → **KYB Conditionally Passed – DIN Pending**
6. Authorisation/document pending → **KYB Conditionally Passed – Authorisation Pending**
7. Representative needs review → **Manual Review**
8. Entity + representative both pass → **KYB Passed**

---

## API suite (mocked)

Only these HyperVerify APIs are modelled: CIN Basic/Detailed, Company Name to GST,
DIN Detailed, Employer EPFO Basic/Detailed, FSSAI License Verification, GST Details,
GST Details Advanced, GST Detailed III, Import-Export Code Verification, Mobile to GST,
Mobile to Udyam, PAN to GST Detailed, PAN to GST Status, Proprietor Detailed, TAN
Detail, MCA Financial Summary, PAN to CIN, Udyam Verification with Certificate.

The raw response shapes in `fixtures.ts` mirror the provided JSON samples (GST Advanced,
GST Detailed III, PAN→GST multi-GST, PAN→CIN, CIN Detailed, Proprietor Detailed, Udyam).
APIs without provided samples use minimal mock shapes (clearly synthetic), most notably
**DIN Detailed**, which is derived from the CIN Detailed `directorDetails` concept.

---

## Policy configuration

`KYB_POLICY` in `constants.ts` centralises behaviour so reviewers can tune strictness
without touching rule code, e.g.:

- `dinGraceDays` (default 7)
- `allowTradeNameMatch` (default false → trade-name-only match → Manual Review)
- `strictAddressMatch` (state mismatch → fail vs review)
- `requireRecentGstFilings`, `requireFssaiForFood`, `requireIecForImportExport`
- `manualReviewForSpecialEntities`, `allowEmployeeAuthorisationAutoPass`

---

## Extending

- **Add a scenario:** append a `ScenarioFixture` to `SCENARIOS` in `fixtures.ts`; it
  automatically appears in the demo dropdown and the regression harness.
- **Add a rule:** push a `RuleResult` from the relevant `rules/*.ts` layer. Severity
  drives the final status (critical/high carry weight).
- **Add an API:** add a normalizer in `normalize.ts` and call it via
  `client.call(endpoint, payload, relatedRules)` so it shows in the console log.
- **Tune outcomes:** adjust `KYB_POLICY` / `SIMILARITY_THRESHOLDS` rather than
  hard-coding thresholds in rules.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n, useT } from "@/lib/i18n/context";
import { languagesForCountry, LANG_LABELS, formatMoney, currencySymbol, currencyFor, type Lang } from "@/lib/i18n/config";
import { ONBOARDING_POLICY, friendlyKybStatus, type CompanyIdentificationStatus, type KybStatusModel, type KybTrigger, type WorkspaceStatus } from "@/lib/onboarding/policy";
import { classifyDomain } from "@/lib/onboarding/domainClassifier";
import { lookupDomain } from "@/lib/onboarding/domainRegistry";
import { companyNameToGst, type CompanyMatch } from "@/lib/onboarding/companyDiscovery";
import { buildLiveBundle, type LiveOutcome } from "@/lib/kyb/liveBundle";
import { runKybDecision } from "@/lib/kyb/decisionEngine";
import { getRequiredDocLabels } from "@/lib/kyb/constants";
import { formatDate } from "@/lib/kyb/dateUtils";
import type { EntityKybInput, RepresentativeClaim, RepresentativeRole, DocumentUpload, BusinessType } from "@/lib/kyb/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TartanHQ — Company Dashboard" },
      { name: "description", content: "Corporate travel dashboard for TartanHQ. Manage company profile, verification status, and unlock corporate benefits." },
    ],
  }),
  component: OnboardingApp,
});

// ---------- shared types ----------
type Step = "landing" | "email" | "otp" | "companyMismatch" | "companyName" | "companySelect" | "freeEmail" | "workspace";
interface LogEvent { label: string; value: string; tone?: "ok" | "warn" | "info" | "bad" }
interface Workspace {
  userEmail: string;
  domain: string;
  displayName: string;
  companyName: string;
  businessType: string;
  country: string;
  knownIdentifiers: { gstin?: string; pan?: string; cin?: string };
  companyIdentificationStatus: CompanyIdentificationStatus;
  workspaceStatus: WorkspaceStatus;
  kybStatus: KybStatusModel;
  accessLevel: string;
  source: string;
  confidence: string;
  kybInternal?: string;
  dinDeadline?: string;
  legalNameAtOnboarding?: string;
}

// ---------- country-specific business identifiers & director identity ----------
type IdField = { key: string; label: string; placeholder: string; optional?: boolean };
interface CountryKybConfig {
  // primary identifier fields the user must provide for this country
  identifiers: IdField[];
  // optional alternate identifier (e.g. India GST → UDYAM fallback)
  fallback?: IdField;
  // director / authorised-person identity field; omitted => no such field for this country
  director?: { label: string; placeholder: string; help: string };
}

const COUNTRY_KYB: Record<string, CountryKybConfig> = {
  India: {
    identifiers: [{ key: "gstin", label: "Company GSTIN", placeholder: "06AAICT4244L1Z2" }],
    fallback: { key: "udyam", label: "UDYAM registration number", placeholder: "UDYAM-MH-00-0000000" },
    director: { label: "DIN (Director Identification Number)", placeholder: "08123456", help: "For Directors / KMP with a Director Identification Number." },
  },
  USA: {
    identifiers: [
      { key: "state_inc", label: "State of incorporation", placeholder: "Delaware" },
      { key: "ein", label: "EIN", placeholder: "12-3456789", optional: true },
    ],
  },
  UK: {
    identifiers: [{ key: "crn", label: "Company Registration Number (CRN)", placeholder: "00445790" }],
    director: { label: "Verified Director Identity (Companies House)", placeholder: "CHID-9K4P-72XF", help: "Companies House identity verification reference." },
  },
  Singapore: {
    identifiers: [{ key: "uen", label: "UEN (Unique Entity Number)", placeholder: "197200078R" }],
    director: { label: "NRIC / FIN", placeholder: "S1234567D", help: "Director NRIC (e.g. S1234567D) or FIN (e.g. F1234567N)." },
  },
  UAE: {
    identifiers: [
      { key: "trade_license", label: "Trade License No.", placeholder: "CN-1234567" },
      { key: "authority", label: "Issuing authority / emirate", placeholder: "DED Dubai / free zone" },
    ],
  },
  Bangladesh: {
    identifiers: [{ key: "rjsc", label: "RJSC Registration Number", placeholder: "C-31531 (652)/96" }],
  },
  "Sri Lanka": {
    identifiers: [{ key: "crn_lk", label: "Company Registration Number", placeholder: "PV 12345" }],
  },
  Nepal: {
    identifiers: [
      { key: "ocr", label: "OCR Registration Number", placeholder: "123456" },
      { key: "pan_vat", label: "PAN / VAT", placeholder: "9-digit PAN" },
    ],
  },
};

function countryKyb(country: string): CountryKybConfig {
  return COUNTRY_KYB[country] ?? COUNTRY_KYB.India;
}



const DEMO_WORKSPACE: Workspace = {
  userEmail: "ahad@tartanhq.com",
  domain: "tartanhq.com",
  displayName: "TartanHQ",
  companyName: "TARTANHQ SOLUTIONS PRIVATE LIMITED",
  businessType: "Private Limited",
  country: "India",
  knownIdentifiers: { gstin: "06AAICT4244L1Z2", pan: "AAICT4244L", cin: "U72900MH2021PTC000000" },
  companyIdentificationStatus: "Domain Matched",
  workspaceStatus: "Active",
  kybStatus: "KYB Not Required Yet",
  accessLevel: "Standard Workspace",
  source: "internal_domain_registry",
  confidence: "high",
};

// ---------- verification (user-facing) policy + labels ----------
// Internal logic may still use KYB-style state; UI always shows "Verification".
const BOOKING_POLICY = {
  allowSearchBeforeVerification: true,
  allowReviewBeforeVerification: true,
  allowConfirmBeforeVerification: false,
  allowEmployeeAdditionBeforeVerification: true,
  allowBookingWithAuthorityPending: false,
};

// Map internal KYB status model -> user-facing verification label.
function verificationLabel(s: KybStatusModel): string {
  if (s === "KYB Passed") return "Verification Complete";
  if (s.includes("DIN Pending") || s.includes("Authorisation")) return "Authority Confirmation Pending";
  if (s === "KYB In Progress") return "Verification In Progress";
  if (s === "Assisted Onboarding Required") return "Assisted Onboarding Required";
  if (s === "KYB Failed") return "Verification Failed";
  return "Verification Pending";
}

function isVerificationComplete(s: KybStatusModel): boolean {
  return s === "KYB Passed";
}

function verifTone(s: KybStatusModel): "ok" | "warn" | "bad" | "info" {
  const label = verificationLabel(s);
  if (label === "Verification Complete") return "ok";
  if (label === "Verification Failed") return "bad";
  if (label === "Verification Pending" || label.includes("Pending") || label.includes("Progress") || label.includes("Assisted")) return "warn";
  return "info";
}


// ---------- tiny UI atoms ----------
function Pill({ children, tone = "info" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "info" }) {
  const map = {
    ok: "bg-foreground text-background border-foreground",
    warn: "bg-background text-foreground border-foreground",
    bad: "bg-background text-muted-foreground border-border line-through-0",
    info: "bg-secondary text-secondary-foreground border-border",
  } as const;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const btnGhost = `${btn} border border-input bg-background hover:bg-accent`;

// ---------- Air India "Vista" window motif ----------
// The brand's signature device: the peak of a gold window frame ("Window of
// Possibilities"). Used at small scale as the wordmark glyph and, scaled up,
// as the hero / CTA framing arch. Strokes resolve to the active theme's gold
// tokens, falling back to currentColor outside the Air India palette.
function VistaMark({ className = "h-6 w-[1.15rem]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 47 V21 C4 11.5 11 3.5 20 2 C29 3.5 36 11.5 36 21 V47"
        stroke="var(--gold-deep, currentColor)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 3 V47" stroke="var(--gold, currentColor)" strokeWidth="1.4" opacity="0.7" />
      <path d="M7 25 H33" stroke="var(--gold, currentColor)" strokeWidth="1.4" opacity="0.7" />
    </svg>
  );
}

// Wordmark: Vista glyph + name. Replaces the old "◆" diamond everywhere.
function Wordmark({ label = "TartanHQ", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <VistaMark className="h-6 w-5" />
      {label}
    </span>
  );
}

// Language toggle — shown only for countries with a native language option.
// Lets the user switch between English and the country's native language.
function LanguageToggle() {
  const { lang, setLang, country } = useI18n();
  const options = languagesForCountry(country);
  if (options.length < 2) return null;
  return (
    <div className="inline-flex items-center rounded-lg border border-input bg-background p-0.5 text-xs font-medium">
      {options.map((l: Lang) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-md px-2.5 py-1 transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "en" ? "EN" : LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}



function autoDocs(type: BusinessType | ""): DocumentUpload[] {
  return getRequiredDocLabels(type).map((d, i) => ({ id: `doc_${i}`, label: d.label, required: d.required, state: "Accepted" as const, ocr: { confidence: 0.96 } }));
}

function companyIdentityKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(private|limited|pvt|ltd|llp|solutions|solution|technologies|technology|payments|bank|company|co|inc|india)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

interface TriangulationResult {
  domainGstinMatch: boolean | null;
  domainNameMatch: boolean | null;
  gstinPanMatch: boolean | null;
  allPass: boolean;
}

function checkTriangulation(workspace: Workspace, enteredGstin: string): TriangulationResult {
  const knownGstin = workspace.knownIdentifiers.gstin ?? "";
  const knownPan = workspace.knownIdentifiers.pan ?? "";

  // Signal 1: domain ↔ GSTIN
  const domainGstinMatch = knownGstin
    ? enteredGstin.toUpperCase() === knownGstin.toUpperCase()
    : null;

  // Signal 2: domain ↔ user-typed legal name
  const typed = workspace.legalNameAtOnboarding ?? "";
  const typedKey = companyIdentityKey(typed);
  const registryKey = companyIdentityKey(workspace.companyName);
  const domainNameMatch = typedKey.length > 0
    ? registryKey.includes(typedKey) || typedKey.includes(registryKey)
    : null;

  // Signal 3: GSTIN ↔ PAN (PAN is embedded at chars 3–12 of GSTIN)
  const gstinPan = enteredGstin.length >= 12 ? enteredGstin.slice(2, 12).toUpperCase() : "";
  const gstinPanMatch = knownPan && gstinPan
    ? gstinPan === knownPan.toUpperCase()
    : null;

  const signals = [domainGstinMatch, domainNameMatch, gstinPanMatch].filter((s) => s !== null);
  const allPass = signals.length > 0 && signals.every(Boolean);

  return { domainGstinMatch, domainNameMatch, gstinPanMatch, allPass };
}

function legalNameMatchesDomainCompany(legalName: string, entry: NonNullable<ReturnType<typeof lookupDomain>>): boolean {
  const legalKey = companyIdentityKey(legalName);
  if (!legalKey) return true;
  const domainRoot = entry.domain.split(".")[0] ?? "";
  return [entry.companyName, entry.displayName, domainRoot]
    .map(companyIdentityKey)
    .filter(Boolean)
    .some((candidate) => legalKey.includes(candidate) || candidate.includes(legalKey));
}

// ---------- main app ----------
function OnboardingApp() {
  const t = useT();
  const [step, setStep] = useState<Step>("landing");
  const [email, setEmail] = useState("ahad@tartanhq.com");
  const [emailErr, setEmailErr] = useState("");
  const [otp, setOtp] = useState(ONBOARDING_POLICY.mockOtp);
  const [otpErr, setOtpErr] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyLegalName, setCompanyLegalName] = useState("");
  const { country, setCountry } = useI18n();
  const [matches, setMatches] = useState<CompanyMatch[]>([]);
  const [freeDetails, setFreeDetails] = useState({ company: "", website: "" });

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const pushLog = (e: LogEvent | LogEvent[]) => setLog((l) => [...l, ...(Array.isArray(e) ? e : [e])]);

  function resetAll() {
    setWorkspace(null);
    setLog([]);
    setEmail("ahad@tartanhq.com");
    setOtp(ONBOARDING_POLICY.mockOtp);
    setEmailErr("");
    setOtpErr("");
    setCompanyName("");
    setCompanyLegalName("");
    setMatches([]);
    setStep("landing");
  }

  // ---- step 1: email ----
  function submitEmail() {
    const c = classifyDomain(email);
    if (!c.valid) { setEmailErr(t("email.err.invalid")); return; }
    if (c.type === "disposable") { setEmailErr(t("email.err.disposable")); return; }
    setEmailErr("");
    pushLog([
      { label: "Input email", value: c.email },
      { label: "Extracted domain", value: c.domain },
      { label: "Domain type", value: c.type, tone: c.type === "corporate" ? "ok" : "warn" },
      { label: "OTP sent", value: `code dispatched to ${c.email} (demo: ${ONBOARDING_POLICY.mockOtp})`, tone: "info" },
    ]);
    setStep("otp");
  }

  // ---- step 2: otp ----
  function verifyOtp() {
    if (otp !== ONBOARDING_POLICY.mockOtp) { setOtpErr(t("otp.err.invalid")); pushLog({ label: "OTP status", value: "failed", tone: "bad" }); return; }
    setOtpErr("");
    pushLog({ label: "OTP status", value: "verified", tone: "ok" });
    routeAfterOtp();
  }

  function routeAfterOtp() {
    const c = classifyDomain(email);
    if (c.type === "free") {
      pushLog({ label: "Domain classification", value: "free / generic email", tone: "warn" });
      setStep("freeEmail");
      return;
    }
    const entry = lookupDomain(c.domain);
    if (entry) {
      if (!legalNameMatchesDomainCompany(companyLegalName, entry)) {
        pushLog([
          { label: "Domain registry lookup", value: "match found", tone: "ok" },
          { label: "Entered legal name", value: companyLegalName || "Not provided", tone: "warn" },
          { label: "Company-domain alignment", value: "mismatch", tone: "warn" },
        ]);
        setStep("companyMismatch");
        return;
      }
      pushLog([
        { label: "Domain registry lookup", value: "match found", tone: "ok" },
        { label: "Matched company", value: entry.companyName },
        { label: "Confidence", value: entry.legalEntityConfidence, tone: "ok" },
      ]);
      createWorkspaceFromDomain(entry);
    } else {
      pushLog({ label: "Domain registry lookup", value: "no match — company discovery required", tone: "warn" });
      setStep("companyName");
    }
  }

  // ---- create workspace helpers ----
  function createWorkspaceFromDomain(entry: NonNullable<ReturnType<typeof lookupDomain>>) {
    const c = classifyDomain(email);
    const ws: Workspace = {
      userEmail: c.email, domain: c.domain,
      displayName: entry.displayName, companyName: entry.companyName,
      businessType: entry.businessType, country, knownIdentifiers: entry.knownIdentifiers,
      companyIdentificationStatus: "Domain Matched", workspaceStatus: "Active",
      kybStatus: "KYB Not Required Yet", accessLevel: "Standard Workspace",
      source: "internal_domain_registry", confidence: "high",
      legalNameAtOnboarding: companyLegalName || undefined,
    };
    setWorkspace(ws);
    pushLog([
      { label: "Workspace created", value: "yes", tone: "ok" },
      { label: "Verification status", value: "Pending" },
      { label: "Reason", value: "No high-risk feature activated" },
    ]);
    setStep("workspace");
  }

  function runDiscovery(name: string) {
    const res = companyNameToGst(name);
    setMatches(res);
    pushLog([
      { label: "Company Name to GST Number", value: `query "${name}"` },
      { label: "Matches returned", value: String(res.length), tone: res.length ? "ok" : "warn" },
    ]);
    return res;
  }

  function createWorkspaceFromMatch(m: CompanyMatch, identification: CompanyIdentificationStatus, conf: string) {
    const c = classifyDomain(email);
    setWorkspace({
      userEmail: c.email, domain: c.domain || "(free email)",
      displayName: m.companyName.split(" ").slice(0, 2).join(" "), companyName: m.companyName,
      businessType: m.businessType, country, knownIdentifiers: { gstin: m.gstin, pan: m.pan, cin: m.cin },
      companyIdentificationStatus: identification, workspaceStatus: "Active",
      kybStatus: "KYB Not Required Yet", accessLevel: conf === "low" ? "Limited Workspace" : "Standard Workspace",
      source: "company_name_to_gst", confidence: conf,
    });
    pushLog([
      { label: "Company match selected", value: m.companyName, tone: "ok" },
      { label: "Workspace created", value: "yes", tone: "ok" },
      { label: "Verification status", value: "Pending" },
    ]);
    setStep("workspace");
  }

  function createLimitedWorkspace(name: string) {
    const c = classifyDomain(email);
    setWorkspace({
      userEmail: c.email, domain: c.domain || "(free email)",
      displayName: name || "Your company", companyName: name || "Unverified company",
      businessType: "", country, knownIdentifiers: {},
      companyIdentificationStatus: c.type === "free" ? "Free Email" : "Company Name Unresolved",
      workspaceStatus: "Limited Access", kybStatus: "KYB Not Required Yet",
      accessLevel: "Limited Workspace", source: "manual", confidence: "low",
    });
    pushLog([
      { label: "Company match", value: "none — identification pending", tone: "warn" },
      { label: "Workspace created", value: "limited access", tone: "warn" },
    ]);
    setStep("workspace");
  }

  if (step === "workspace" && workspace) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Dashboard workspace={workspace} setWorkspace={setWorkspace} pushLog={pushLog} onRestart={resetAll} />
      </div>
    );
  }


  if (step === "landing") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Landing onStart={() => setStep("email")} country={country} setCountry={setCountry} />
        <ConsoleDock open={consoleOpen} setOpen={setConsoleOpen} log={log} />
      </div>
    );
  }

  const backTargets: Partial<Record<Step, Step>> = {
    email: "landing",
    otp: "email",
    companyMismatch: "email",
    companyName: "otp",
    companySelect: "companyName",
    freeEmail: "otp",
  };
  const backTarget = backTargets[step];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <button onClick={resetAll}><Wordmark className="text-base" /></button>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          {backTarget && (
            <button onClick={() => setStep(backTarget)} className="text-xs font-medium text-muted-foreground hover:text-foreground">{t("common.backArrow")}</button>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {step === "email" && (
            <EmailScreen email={email} setEmail={setEmail} emailErr={emailErr} submitEmail={submitEmail} companyLegalName={companyLegalName} setCompanyLegalName={setCompanyLegalName} country={country} setCountry={setCountry} />
          )}
          {step === "otp" && (
            <OtpScreen email={email} otp={otp} setOtp={setOtp} otpErr={otpErr} verifyOtp={verifyOtp} resend={() => submitEmail()} />
          )}
          {step === "companyMismatch" && (
            <CompanyMismatchScreen onUseDifferentEmail={() => setStep("email")} />
          )}
          {step === "companyName" && (
            <CompanyNameScreen value={companyName} setValue={setCompanyName}
              onSubmit={() => { const res = runDiscovery(companyName); setStep(res.length ? "companySelect" : "companyName"); if (!res.length) createLimitedWorkspace(companyName); }} />
          )}
          {step === "companySelect" && (
            <CompanySelectScreen matches={matches}
              onPick={(m: CompanyMatch) => createWorkspaceFromMatch(m, "Company Name Match", m.confidence >= 0.9 ? "high" : "medium")}
              onNone={() => createLimitedWorkspace(companyName)} />
          )}
          {step === "freeEmail" && (
            <FreeEmailScreen details={freeDetails} setDetails={setFreeDetails}
              onUseWork={() => setStep("email")}
              onContinue={() => { const res = runDiscovery(freeDetails.company); if (res.length) setStep("companySelect"); else createLimitedWorkspace(freeDetails.company); }} />
          )}
        </div>
      </main>
      <ConsoleDock open={consoleOpen} setOpen={setConsoleOpen} log={log} />
    </div>
  );
}

// ---------- landing page ----------
function Landing({ onStart, country, setCountry }: { onStart: () => void; country: string; setCountry: (v: string) => void }) {
  const t = useT();
  const features = [
    { icon: "✈️", title: t("feature.book.title"), desc: t("feature.book.desc") },
    { icon: "🧾", title: t("feature.expense.title"), desc: t("feature.expense.desc") },
    { icon: "🛡️", title: t("feature.policy.title"), desc: t("feature.policy.desc") },
    { icon: "🌍", title: t("feature.care.title"), desc: t("feature.care.desc") },
  ];
  const stats = [
    { v: "30%", l: t("stats.saved") },
    { v: "60s", l: t("stats.onboard") },
    { v: "190+", l: t("stats.countries") },
    { v: "4.9★", l: t("stats.satisfaction") },
  ];
  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark label="TartanHQ Travel" className="text-lg" />
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{t("nav.platform")}</a>
            <a href="#how" className="hover:text-foreground">{t("nav.how")}</a>
            <a href="#stats" className="hover:text-foreground">{t("nav.why")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <select
              aria-label={t("email.country")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {["India", "USA", "UK", "Singapore", "UAE", "Nepal", "Bangladesh", "Sri Lanka"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={onStart} className={btnPrimary}>{t("common.getStarted")}</button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-background" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {t("hero.badge")}
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={onStart} className={`${btnPrimary} text-base`}>{t("hero.ctaPrimary")}</button>
              <a href="#how" className={btnGhost}>{t("hero.ctaSecondary")}</a>
            </div>
            <p className="text-xs text-muted-foreground">{t("hero.noCard")}</p>
          </div>
          <div className="relative">
            {/* The Vista — Air India's window frame, used as the hero device. */}
            <div className="mx-auto max-w-sm rounded-[2rem] rounded-t-[160px] border border-[color:var(--gold-deep,var(--border))] bg-gradient-to-b from-[color:var(--gold,var(--accent))]/25 via-card to-card p-3 shadow-xl">
              <div className="rounded-[1.6rem] rounded-t-[150px] border border-[color:var(--gold-deep,var(--border))]/40 bg-card px-6 pb-6 pt-9">
                <div className="mb-5 flex flex-col items-center gap-2 text-center">
                  <VistaMark className="h-9 w-8" />
                  <div className="text-sm font-semibold">{t("hero.card.upcoming")}</div>
                  <span className="rounded-full border border-foreground bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">{t("hero.card.confirmed")}</span>
                </div>
                <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                  <span className="font-medium">BLR → BOM</span>
                  <span className="text-muted-foreground">Tue · 08:10</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                  <span className="font-medium">{t("hero.card.hotel")}</span>
                  <span className="text-muted-foreground">{t("hero.card.withinPolicy")}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                  <span className="font-medium">{t("hero.card.estSpend")}</span>
                  <span className="text-muted-foreground">{formatMoney(24800, country)}</span>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section id="stats" className="border-y border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-3xl font-bold text-primary">{s.v}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t("features.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("features.subtitle")}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl rounded-t-[28px] border border-[color:var(--gold-deep,var(--border))]/40 bg-[color:var(--gold,var(--accent))]/15 text-2xl">{f.icon}</div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("how.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("how.subtitle")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: "1", t: t("how.step1.t"), d: t("how.step1.d") },
              { n: "2", t: t("how.step2.t"), d: t("how.step2.d") },
              { n: "3", t: t("how.step3.t"), d: t("how.step3.d") },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{s.n}</div>
                <h3 className="mt-4 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-[2rem] rounded-t-[120px] bg-[color:var(--aubergine,var(--primary))] px-8 py-16 text-center text-[color:var(--aubergine-foreground,var(--primary-foreground))]">
          <VistaMark className="mx-auto mb-5 h-11 w-9" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-lg text-[color:var(--aubergine-foreground,var(--primary-foreground))]/75">{t("cta.subtitle")}</p>
          <button onClick={onStart} className={`${btn} mt-8 bg-[color:var(--gold,var(--background))] text-[color:var(--aubergine,var(--primary))] hover:opacity-90`}>{t("cta.button")}</button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div>{t("footer.proto")}</div>
          <div>{t("footer.rights", { year: new Date().getFullYear() })}</div>
        </div>
      </footer>
    </div>
  );
}

// ---------- screens ----------
function ScreenHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-7">
      <Wordmark className="mb-6 text-lg lg:hidden" />
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EmailScreen({ email, setEmail, emailErr, submitEmail, companyLegalName, setCompanyLegalName, country, setCountry }: any) {
  const t = useT();
  return (
    <div>
      <ScreenHead title={t("email.title")} sub={t("email.sub")} />
      <label className="mb-1.5 block text-sm font-medium">{t("email.workEmail")}</label>
      <input className={inputCls} placeholder="you@company.com" value={email} autoFocus
        onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEmail()} />
      {emailErr && <p className="mt-2 text-xs text-destructive">{emailErr}</p>}
      <label className="mb-1.5 mt-4 block text-sm font-medium">{t("email.companyLegal")}</label>
      <input className={inputCls} placeholder="Acme Technologies Pvt. Ltd." value={companyLegalName}
        onChange={(e) => setCompanyLegalName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEmail()} />
      <label className="mb-1.5 mt-4 block text-sm font-medium">{t("email.country")}</label>
      <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
        {["India", "USA", "UK", "Singapore", "UAE", "Nepal", "Bangladesh", "Sri Lanka"].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button className={`${btnPrimary} mt-5 w-full`} onClick={submitEmail}>{t("common.continue")}</button>
    </div>
  );
}

function OtpScreen({ email, otp, setOtp, otpErr, verifyOtp, resend }: any) {
  const t = useT();
  return (
    <div>
      <ScreenHead title={t("otp.title")} sub={t("otp.sub", { email })} />
      <input className={`${inputCls} tracking-[0.5em] text-center text-lg`} placeholder="······" maxLength={6} value={otp} autoFocus
        inputMode="numeric" onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && verifyOtp()} />
      {otpErr && <p className="mt-2 text-xs text-destructive">{otpErr}</p>}
      <button className={`${btnPrimary} mt-5 w-full`} onClick={verifyOtp}>{t("otp.verify")}</button>
      <button className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground" onClick={resend}>{t("otp.resend")}</button>
    </div>
  );
}

function CompanyMismatchScreen({ onUseDifferentEmail }: { onUseDifferentEmail: () => void }) {
  const t = useT();
  return (
    <div>
      <ScreenHead title={t("mismatch.title")} sub={t("mismatch.sub")} />
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("mismatch.body")}
      </div>
      <a className={`${btnPrimary} mt-5 flex w-full justify-center`} href="mailto:support@tartanhq.com">
        {t("mismatch.email")}
      </a>
      <button className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground" onClick={onUseDifferentEmail}>
        {t("mismatch.tryAgain")}
      </button>
    </div>
  );
}

function CompanyNameScreen({ value, setValue, onSubmit }: any) {
  const t = useT();
  return (
    <div>
      <ScreenHead title={t("cname.title")} sub={t("cname.sub")} />
      <input className={inputCls} placeholder="e.g. TartanHQ Solutions" value={value} autoFocus
        onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && value.trim().length >= 2 && onSubmit()} />
      <button className={`${btnPrimary} mt-5 w-full`} disabled={value.trim().length < 2} onClick={onSubmit}>{t("cname.find")}</button>
    </div>
  );
}

function CompanySelectScreen({ matches, onPick, onNone }: any) {
  const t = useT();
  return (
    <div>
      <ScreenHead title={t("cselect.title")} sub={t("cselect.sub")} />
      <div className="space-y-3">
        {matches.map((m: CompanyMatch) => (
          <button key={m.gstin} onClick={() => onPick(m)}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{m.companyName}</span>
              <Pill tone={m.confidence >= 0.9 ? "ok" : "info"}>{Math.round(m.confidence * 100)}%</Pill>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{m.gstin} · {m.state} · {m.constitution}</div>
          </button>
        ))}
      </div>
      <button className={`${btnGhost} mt-4 w-full`} onClick={onNone}>{t("cselect.none")}</button>
    </div>
  );
}

function FreeEmailScreen({ details, setDetails, onUseWork, onContinue }: any) {
  const t = useT();
  const set = (k: string, v: string) => setDetails((d: any) => ({ ...d, [k]: v }));
  return (
    <div>
      <ScreenHead title={t("free.title")} sub={t("free.sub")} />
      <button className={`${btnGhost} mb-5 w-full`} onClick={onUseWork}>{t("free.useWork")}</button>
      <div className="space-y-3">
        <input className={inputCls} placeholder={t("free.company")} value={details.company} onChange={(e) => set("company", e.target.value)} />
        <input className={inputCls} placeholder={t("free.website")} value={details.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      <button className={`${btnPrimary} mt-5 w-full`} onClick={onContinue}>{t("free.continue")}</button>
    </div>
  );
}



// ---------- employee + booking models ----------
type EmpRole = "Admin" | "Member";
// Structured seniority band — drives approval rules (amount + seniority, MMT-style).
type SeniorityBand = "IC" | "Manager" | "Director" | "VP+";
const SENIORITY_BANDS: readonly SeniorityBand[] = ["IC", "Manager", "Director", "VP+"] as const;
const SENIORITY_RANK: Record<SeniorityBand, number> = { IC: 1, Manager: 2, Director: 3, "VP+": 4 };
// Best-effort map from a free-text CSV designation to a band (default IC).
function bandFromDesignation(text: string): SeniorityBand {
  const s = text.toLowerCase();
  if (/\b(vp|vice president|chief|c[etfo]o|founder|head)\b/.test(s)) return "VP+";
  if (/\b(director|principal|sr\.? manager|senior manager)\b/.test(s)) return "Director";
  if (/\b(manager|lead|team lead)\b/.test(s)) return "Manager";
  return "IC";
}
interface Employee {
  id: string; name: string; email: string; role: EmpRole;
  status: "Pending" | "Joined" | "Suspended"; addedBy: string; date: string;
  domainMatches: boolean; external: boolean;
  seniority: SeniorityBand;
  empId?: string; group?: string; gender?: string; mobile?: string; managers?: string[];
}
interface Flight { id: string; route: string; depart: string; price: number }
type BookingResult = "confirmed" | "hold" | "blocked";
interface BookingRecord { id: string; route: string; date: string; traveller: string; fare: number; result: BookingResult; note: string; noteKey: string; cabin?: string; pax?: number; tripType?: string }

const MOCK_FLIGHTS: Flight[] = [
  { id: "f1", route: "Mumbai → Delhi", depart: "09:30", price: 8500 },
  { id: "f2", route: "Mumbai → Delhi", depart: "13:15", price: 9200 },
  { id: "f3", route: "Mumbai → Delhi", depart: "19:45", price: 7900 },
];

// Map workspace verification status → what happens to a booking attempt.
// noteKey drives the translated message; note keeps an English copy for the backend log.
function bookingOutcomeFor(kybStatus: KybStatusModel): { result: BookingResult; note: string; noteKey: string } {
  if (kybStatus === "KYB Passed") return { result: "confirmed", note: "Company verified — booking confirmed.", noteKey: "note.confirmed" };
  if (kybStatus.includes("DIN Pending") || kybStatus.includes("Authorisation"))
    return BOOKING_POLICY.allowBookingWithAuthorityPending
      ? { result: "confirmed", note: "Booking confirmed. Authority confirmation still pending.", noteKey: "note.confirmedAuthPending" }
      : { result: "hold", note: "Booking on hold until authority is confirmed.", noteKey: "note.holdAuth" };
  if (kybStatus.includes("Document")) return { result: "hold", note: "Booking on hold — a required document is pending.", noteKey: "note.holdDoc" };
  if (kybStatus === "Assisted Onboarding Required") return { result: "hold", note: "Booking can’t be auto-confirmed. Our team will assist with verification.", noteKey: "note.assisted" };
  if (kybStatus === "KYB Failed") return { result: "blocked", note: "Booking blocked — company verification failed. Workspace stays active.", noteKey: "note.blocked" };
  return { result: "hold", note: "Complete company verification before this booking can be confirmed.", noteKey: "note.holdDefault" };
}


// ---------- dashboard ----------
function statusTone(s: string): "ok" | "warn" | "bad" | "info" {
  if (s.includes("Passed") && !s.includes("Conditionally")) return "ok";
  if (s.includes("Conditionally") || s.includes("Pending") || s.includes("Required") || s.includes("Limited")) return "warn";
  if (s.includes("Failed")) return "bad";
  return "info";
}

type Tab = "overview" | "employees" | "book" | "admin";

function Dashboard({ workspace, setWorkspace, pushLog, onRestart }: { workspace: Workspace; setWorkspace: (w: Workspace) => void; pushLog: (e: LogEvent | LogEvent[]) => void; onRestart: () => void }) {
  const t = useT();
  const accounts: ReadonlyArray<{ email: string; role: EmpRole }> = [
    { email: workspace.userEmail, role: "Admin" },
    { email: "riya@tartanhq.com", role: "Member" },
  ];
  const [tab, setTab] = useState<Tab>("overview");
  const [activeEmail, setActiveEmail] = useState<string>(workspace.userEmail);
  const viewAs: EmpRole = accounts.find((a) => a.email === activeEmail)?.role ?? "Admin";
  const firstName = activeEmail.split("@")[0].replace(/[._-].*/, "").replace(/^\w/, (c) => c.toUpperCase());
  const [employees, setEmployees] = useState<Employee[]>([
    { id: "u0", name: firstName, email: workspace.userEmail, role: "Admin", status: "Joined", addedBy: "—", date: formatDate(new Date().toISOString()), domainMatches: true, external: false, seniority: "Director" },
  ]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  // Show the verification prompt automatically on first overview load when still pending.
  const [overviewKybOpen, setOverviewKybOpen] = useState(() => !isVerificationComplete(workspace.kybStatus));

  const isAdmin = viewAs === "Admin";
  const tabs: ReadonlyArray<readonly [Tab, string]> = isAdmin
    ? [["overview", t("tab.overview")], ["employees", t("tab.employees")], ["admin", t("tab.admin")], ["book", t("tab.book")]]
    : [["overview", t("tab.overview")], ["book", t("tab.book")]];

  function switchAccount(emailV: string) {
    setActiveEmail(emailV);
    const role = accounts.find((a) => a.email === emailV)?.role ?? "Admin";
    if (role === "Member" && (tab === "employees" || tab === "admin")) setTab("overview");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Wordmark className="text-lg" />
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <select
            value={activeEmail}
            onChange={(e) => switchAccount(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t("dash.selectAccount")}
          >
            {accounts.map((a) => (
              <option key={a.email} value={a.email}>{a.email} · {t(a.role === "Admin" ? "role.admin" : "role.member")}</option>
            ))}
          </select>
          <Pill tone={isAdmin ? "ok" : "info"}>{t(isAdmin ? "role.admin" : "role.member")}</Pill>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onRestart}>{t("dash.restart")}</button>
        </div>
      </header>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("dash.welcome", { name: firstName })}</h1>
        <p className="text-sm text-muted-foreground">{t("dash.ready", { company: workspace.displayName, role: isAdmin ? t("dash.roleAdmin") : t("dash.roleMember") })}</p>
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card p-1 text-sm">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview workspace={workspace} employees={employees} bookings={bookings} onGoto={setTab} isAdmin={isAdmin} onStartKyb={() => setOverviewKybOpen(true)} />}
      {tab === "employees" && isAdmin && <Employees workspace={workspace} employees={employees} setEmployees={setEmployees} pushLog={pushLog} onContinue={() => setTab("book")} view="people" />}
      {tab === "admin" && isAdmin && <Employees workspace={workspace} employees={employees} setEmployees={setEmployees} pushLog={pushLog} view="admin" />}
      {tab === "book" && <BookFlow workspace={workspace} setWorkspace={setWorkspace} employees={employees} bookings={bookings} setBookings={setBookings} pushLog={pushLog} isAdmin={isAdmin} />}

      {overviewKybOpen && (
        <KybUpgradeModal workspace={workspace} trigger="ADMIN_INITIATED" pushLog={pushLog}
          onClose={() => setOverviewKybOpen(false)}
          onMemberContinue={() => { setOverviewKybOpen(false); setTab("book"); }}
          onResult={(w) => {
            setWorkspace(w);
            setOverviewKybOpen(false);
            // Verification-first flow: once verified, take admins straight to employee addition.
            if (isVerificationComplete(w.kybStatus) && isAdmin) setTab("employees");
          }} />
      )}
    </div>
  );
}

// ---------- overview tab ----------
function Overview({ workspace, employees, bookings, onGoto, isAdmin, onStartKyb }: { workspace: Workspace; employees: Employee[]; bookings: BookingRecord[]; onGoto: (t: Tab) => void; isAdmin: boolean; onStartKyb?: () => void }) {
  const t = useT();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
        <div className="text-sm font-semibold">{workspace.companyName}</div>
        <div className="text-xs text-muted-foreground">{t("ov.identifiedVia", { via: workspace.companyIdentificationStatus === "Domain Matched" ? workspace.domain : t("ov.via.lookup") })}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <Row k={t("ov.role")} v={t(isAdmin ? "role.admin" : "role.member")} />
          <Row k={t("ov.companyId")} v={t("ci." + workspace.companyIdentificationStatus)} />
          <Row k={t("ov.workspace")} v={t("ws." + workspace.workspaceStatus)} />
          <Row k={t("ov.verification")} v={t("vl." + verificationLabel(workspace.kybStatus))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone={statusTone(workspace.workspaceStatus)}>{t("ov.workspaceBadge", { status: t("ws." + workspace.workspaceStatus) })}</Pill>
          <Pill tone={verifTone(workspace.kybStatus)}>{t("vl." + verificationLabel(workspace.kybStatus))}</Pill>
        </div>
        {!isVerificationComplete(workspace.kybStatus) && isAdmin && onStartKyb && (
          <div className="mt-4 rounded-xl border border-foreground bg-secondary p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">🔒</div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{t("ov.completeVerification")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("ov.verifyDesc", { idLabel: countryKyb(workspace.country).identifiers[0].label })}
                </p>
                <p className="mt-2 text-xs font-medium">
                  {(() => { const c = countryKyb(workspace.country); return c.fallback ? t("ov.verifyWithFallback", { primary: c.identifiers[0].label, fallback: c.fallback.label }) : t("ov.verifyWith", { primary: c.identifiers.map((f) => f.label).join(" + ") }); })()}
                </p>
                <button onClick={onStartKyb} className={`${btnPrimary} mt-3 text-xs`}>{t("ov.continueVerification")}</button>
              </div>
            </div>
          </div>
        )}
        {!isVerificationComplete(workspace.kybStatus) && !isAdmin && (
          <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            {t("ov.memberPending")}
          </p>
        )}

      </section>

      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("ov.quickActions")}</h2>
          <div className="space-y-2">
            <button className={`${btnPrimary} w-full text-sm`} onClick={() => onGoto("book")}>{t("ov.searchTravel")}</button>
            {isAdmin && <button className={`${btnGhost} w-full text-sm`} onClick={() => onGoto("employees")}>{t("ov.addEmployees")}</button>}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("ov.glance")}</h2>
          <div className="space-y-1.5 text-sm">
            <Row k={t("ov.teamMembers")} v={String(employees.length)} />
            <Row k={t("ov.bookings")} v={String(bookings.length)} />
          </div>
        </section>
      </aside>
    </div>
  );
}

// ---------- employees tab ----------
const SAMPLE_CSV = `Employee Name,Employee ID,Designation,Email ID,Manager Name,Manager Email ID
Riya Sharma,EMP001,Sales Executive,riya@tartanhq.com,Priya Singh,priya@tartanhq.com
Arjun Mehta,EMP002,Engineer,arjun@tartanhq.com,Priya Singh,priya@tartanhq.com
Neha Gupta,EMP003,Finance Lead,neha@tartanhq.com,Rahul Verma,rahul@tartanhq.com`;

const HRMS_SAMPLE_CSV = `Employee Name,Employee ID,Designation,Email ID,Manager Name,Manager Email ID
Riya Sharma,EMP001,Sales Executive,riya@tartanhq.com,Priya Singh,priya@tartanhq.com
Arjun Mehta,EMP002,Software Engineer,arjun@tartanhq.com,Priya Singh,priya@tartanhq.com
Neha Gupta,EMP003,Finance Lead,neha@tartanhq.com,Rahul Verma,rahul@tartanhq.com
Kabir Malhotra,EMP004,Product Manager,kabir@tartanhq.com,Priya Singh,priya@tartanhq.com
Ananya Rao,EMP005,Senior Designer,ananya@tartanhq.com,Kabir Malhotra,kabir@tartanhq.com
Dev Patel,EMP006,Engineering Manager,dev@tartanhq.com,Rahul Verma,rahul@tartanhq.com
Meera Iyer,EMP007,People Operations Manager,meera@tartanhq.com,Rahul Verma,rahul@tartanhq.com
Vikram Sethi,EMP008,Director Sales,vikram@tartanhq.com,Rahul Verma,rahul@tartanhq.com
Sara Khan,EMP009,Customer Success Lead,sara@tartanhq.com,Vikram Sethi,vikram@tartanhq.com
Nikhil Bansal,EMP010,Finance Analyst,nikhil@tartanhq.com,Neha Gupta,neha@tartanhq.com
Tara Menon,EMP011,Travel Coordinator,tara@tartanhq.com,Meera Iyer,meera@tartanhq.com
Omar Qureshi,EMP012,VP Operations,omar@tartanhq.com,Rahul Verma,rahul@tartanhq.com`;

const HRMS_PLATFORMS = [
  "GreyTHR", "Uknowva", "Keka", "Successfactors", "Zoho", "Beehive", "DarwinBox",
  "ZingHR", "FreshTeam", "BambooHR", "Paycor", "Workline", "Paychex", "PeopleStrong",
  "PeopleHR", "Pocket", "SumHR", "Peopleworks", "Paybooks", "Odoo", "RazorPay",
] as const;

// ---------- logo.dev brand logos for the HRMS / payroll catalog ----------
// Only the *publishable* token is used here — it's designed to ship in the
// client (it appears in the image URL). The secret key is server-only and must
// never be embedded in frontend code.
const LOGO_DEV_TOKEN = "pk_BIqCrCusT-WtHnsjaTEesA";

// Map each HRMS/payroll product to its brand domain so logo.dev can resolve it.
const HRMS_DOMAINS: Record<string, string> = {
  GreyTHR: "greythr.com",
  Uknowva: "uknowva.com",
  Keka: "keka.com",
  Successfactors: "successfactors.com",
  Zoho: "zoho.com",
  Beehive: "beehivehrms.com",
  DarwinBox: "darwinbox.com",
  ZingHR: "zinghr.com",
  FreshTeam: "freshworks.com",
  BambooHR: "bamboohr.com",
  Paycor: "paycor.com",
  Workline: "workline.com",
  Paychex: "paychex.com",
  PeopleStrong: "peoplestrong.com",
  PeopleHR: "peoplehr.com",
  Pocket: "pockethrms.com",
  SumHR: "sumhr.com",
  Peopleworks: "peopleworks.in",
  Paybooks: "paybooks.in",
  Odoo: "odoo.com",
  RazorPay: "razorpay.com",
};

function platformLogoUrl(name: string, px: number): string | null {
  const domain = HRMS_DOMAINS[name];
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&format=png&size=${px}&retina=true`;
}

// Square brand logo for a platform. Falls back to a two-letter monogram tile
// when the logo can't be resolved (unknown domain, blocked request, etc.).
function PlatformLogo({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = platformLogoUrl(name, size * 2);
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded bg-secondary text-[9px] font-bold text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={`${name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded bg-white object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function SourceLogo({ label, size = 20 }: { label: "CSV" | "SFTP"; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-background text-[9px] font-bold text-foreground ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {label === "CSV" ? "CSV" : "S"}
    </span>
  );
}

const DATA_FIELDS = [
  "Employee Name", "Employee ID", "Designation",
  "Email ID", "Manager Name", "Manager Email ID",
] as const;

const DATA_FIELD_KEYS: Record<string, string> = {
  "Employee Name": "field.employeeName",
  "Employee ID": "field.employeeId",
  "Designation": "field.designation",
  "Email ID": "field.emailId",
  "Manager Name": "field.managerName",
  "Manager Email ID": "field.managerEmailId",
};

const SFTP_DEFAULTS = { host: "sftp.tartanhq.com", port: "22", username: "tartan_payroll", password: "demo-key-prefilled", path: "/uploads/employees" };

// ---------- organisation setup (flight policies, approvals, groups) ----------
interface TravelPolicy { id: string; name: string; groupId: string; domesticCap: number; domesticCabin: string; intlCap: number; intlCabin: string; advanceDays: number; cheaperFare: boolean; threshold: number; docName?: string }
interface ApprovalStage { id: string; label: string; approver: string; enabled: boolean }
interface ApprovalFlow { threshold: number; stages: ApprovalStage[] }
interface OrgGroup { id: string; name: string; isDefault: boolean; members: number }

const CABIN_OPTIONS = ["Economy", "Premium Economy", "Business", "First"] as const;

const DEMO_GROUPS: OrgGroup[] = [
  { id: "g_org", name: "Organization Group", isDefault: true, members: 4 },
  { id: "g_default", name: "Default Group", isDefault: false, members: 1 },
  { id: "g_admin", name: "Admin Group", isDefault: false, members: 3 },
];

const DEMO_POLICIES: TravelPolicy[] = [
  { id: "p_standard", name: "Standard Flight Policy", groupId: "g_org", domesticCap: 12000, domesticCabin: "Economy", intlCap: 60000, intlCabin: "Premium Economy", advanceDays: 7, cheaperFare: true, threshold: 15000 },
  { id: "p_exec", name: "Executive Flight Policy", groupId: "g_admin", domesticCap: 25000, domesticCabin: "Business", intlCap: 150000, intlCabin: "Business", advanceDays: 3, cheaperFare: false, threshold: 50000 },
];

const DEMO_APPROVAL: ApprovalFlow = {
  threshold: 15000,
  stages: [
    { id: "mgr", label: "Manager", approver: "priya@tartanhq.com", enabled: true },
    { id: "fin", label: "Finance", approver: "neha@tartanhq.com", enabled: true },
  ],
};

// ---------- custom approval rules (MMT-style: amount + cabin + region + seniority) ----------
type ApprovalRegion = "any" | "domestic" | "intl";
type ApprovalCabin = "any" | (typeof CABIN_OPTIONS)[number];
type ApprovalSeniority = "any" | SeniorityBand;
type ApprovalOutcome = "auto" | "require";
interface ApprovalRule {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null; // null = no upper cap
  cabin: ApprovalCabin;
  region: ApprovalRegion;
  minSeniority: ApprovalSeniority; // traveller must be at least this band
  outcome: ApprovalOutcome;
  approver: string; // used when outcome = "require"
}

const DEMO_RULES: ApprovalRule[] = [
  { id: "r_exec", name: "Executives fly free", minAmount: 0, maxAmount: null, cabin: "any", region: "any", minSeniority: "VP+", outcome: "auto", approver: "" },
  { id: "r_dom", name: "Cheap domestic economy", minAmount: 0, maxAmount: 15000, cabin: "Economy", region: "domestic", minSeniority: "any", outcome: "auto", approver: "" },
  { id: "r_biz", name: "Business class needs sign-off", minAmount: 0, maxAmount: null, cabin: "Business", region: "any", minSeniority: "any", outcome: "require", approver: "priya@tartanhq.com" },
];

function seniorityRank(b: ApprovalSeniority): number {
  return b === "any" ? 0 : SENIORITY_RANK[b];
}

// Two amount ranges overlap (treating null max as +∞).
function amountsOverlap(aMin: number, aMax: number | null, bMin: number, bMax: number | null): boolean {
  const aHi = aMax ?? Infinity;
  const bHi = bMax ?? Infinity;
  return aMin <= bHi && bMin <= aHi;
}

// Do two rules' *conditions* overlap (i.e. some trip could match both)?
function rulesOverlap(a: ApprovalRule, b: ApprovalRule): boolean {
  if (!amountsOverlap(a.minAmount, a.maxAmount, b.minAmount, b.maxAmount)) return false;
  if (a.cabin !== "any" && b.cabin !== "any" && a.cabin !== b.cabin) return false;
  if (a.region !== "any" && b.region !== "any" && a.region !== b.region) return false;
  // Seniority is a "at least" floor; floors are always mutually satisfiable
  // by a sufficiently senior traveller, so they never make rules disjoint.
  return true;
}

// First existing rule that overlaps `rule` but resolves to a different outcome.
function findConflict(rule: ApprovalRule, others: ApprovalRule[]): ApprovalRule | null {
  return others.find((o) => o.id !== rule.id && rulesOverlap(rule, o) && o.outcome !== rule.outcome) ?? null;
}

interface TripApprovalCtx { amount: number; cabin: string; region: "domestic" | "intl"; seniority: SeniorityBand }
function ruleMatches(r: ApprovalRule, c: TripApprovalCtx): boolean {
  if (c.amount < r.minAmount) return false;
  if (r.maxAmount !== null && c.amount > r.maxAmount) return false;
  if (r.cabin !== "any" && r.cabin !== c.cabin) return false;
  if (r.region !== "any" && r.region !== c.region) return false;
  if (SENIORITY_RANK[c.seniority] < seniorityRank(r.minSeniority)) return false;
  return true;
}
// First matching rule wins; falls back to the legacy amount threshold.
function evaluateApproval(rules: ApprovalRule[], threshold: number, c: TripApprovalCtx): { outcome: ApprovalOutcome; rule: ApprovalRule | null; approver: string } {
  const hit = rules.find((r) => ruleMatches(r, c));
  if (hit) return { outcome: hit.outcome, rule: hit, approver: hit.approver };
  return { outcome: c.amount <= threshold ? "auto" : "require", rule: null, approver: "priya@tartanhq.com" };
}

// Human-readable one-line condition summary for a rule.
function ruleSummary(r: ApprovalRule, money: (n: number) => string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  parts.push(t(r.region === "any" ? "appr.anyRegion" : r.region === "domestic" ? "appr.domestic" : "appr.intl"));
  parts.push(r.cabin === "any" ? t("appr.anyCabin") : t("cabin." + r.cabin));
  if (r.maxAmount === null && r.minAmount === 0) parts.push(t("appr.anyAmount"));
  else if (r.maxAmount === null) parts.push(t("appr.over", { min: money(r.minAmount) }));
  else if (r.minAmount === 0) parts.push(t("appr.upTo", { max: money(r.maxAmount) }));
  else parts.push(t("appr.between", { min: money(r.minAmount), max: money(r.maxAmount) }));
  if (r.minSeniority !== "any") parts.push(t("appr.atLeast", { band: r.minSeniority }));
  return parts.join(" · ");
}


interface ParsedRow { name: string; email: string; role: EmpRole; department: string; seniority: SeniorityBand; valid: boolean; issue?: string; external: boolean }

function parseCsv(text: string, domain: string, existing: Employee[]): ParsedRow[] {
  const t = useT();
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("email") || header.includes("name");
  const cols = header.split(",").map((c) => c.trim());
  const findCol = (...keys: string[]) => cols.findIndex((c) => keys.some((k) => c.includes(k)));
  const nameIdx = hasHeader ? Math.max(findCol("employee name", "full name", "name"), 0) : 0;
  const emailIdx = hasHeader ? (findCol("email id", "email") >= 0 ? findCol("email id", "email") : 3) : 1;
  const roleIdx = hasHeader ? findCol("role") : 2;
  const deptIdx = hasHeader ? findCol("designation", "department", "dept") : 3;
  const seen = new Set(existing.map((e) => e.email.toLowerCase()));
  const rows: ParsedRow[] = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = line.split(",").map((c) => c.trim());
    const name = cells[nameIdx] || "";
    const email = cells[emailIdx] || "";
    const role = roleIdx >= 0 ? (cells[roleIdx] || "Member") : "Member";
    const department = deptIdx >= 0 ? (cells[deptIdx] || "") : "";
    const e = email.toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const external = emailOk && e.split("@")[1] !== domain;
    let valid = true; let issue: string | undefined;
    if (!name) { valid = false; issue = "Missing name"; }
    else if (!emailOk) { valid = false; issue = "Invalid email"; }
    else if (seen.has(e)) { valid = false; issue = "Duplicate"; }
    if (emailOk) seen.add(e);
    rows.push({ name: name || "(unknown)", email: e, role: role.toLowerCase() === "admin" ? "Admin" : "Member", department, seniority: bandFromDesignation(department), valid, issue, external });
  }
  return rows;
}

function Employees({ workspace, employees, setEmployees, pushLog, onContinue, view = "people" }: { workspace: Workspace; employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>; pushLog: (e: LogEvent | LogEvent[]) => void; onContinue?: () => void; view?: "people" | "admin" }) {
  const t = useT();
  const money = (n: number) => formatMoney(n, workspace.country);
  const isAdminView = view === "admin";
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [dataStep, setDataStep] = useState<"method" | "hrms-select" | "hrms-config" | "hrms-apikey" | "sftp">("method");
  const [hrmsApiKey, setHrmsApiKey] = useState("");
  const [empStep, setEmpStep] = useState<"details" | "managers">("details");
  const [form, setForm] = useState({ email: "", name: "", role: "Member" as EmpRole, seniority: "IC" as SeniorityBand, group: "Organization Group", empId: "", gender: "", mobile: "" });
  const [managers, setManagers] = useState<string[]>([""]);
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [hrmsPlatform, setHrmsPlatform] = useState<string>("GreyTHR");
  const [hrmsSearch, setHrmsSearch] = useState("");
  const [sftp, setSftp] = useState(SFTP_DEFAULTS);
  const [orgTab, setOrgTab] = useState<"connections" | "regions" | "policies" | "approvals" | "groups">("connections");
  const [policies, setPolicies] = useState<TravelPolicy[]>(DEMO_POLICIES);
  const [approval, setApproval] = useState<ApprovalFlow>(DEMO_APPROVAL);
  const [rules, setRules] = useState<ApprovalRule[]>(DEMO_RULES);
  const [editRule, setEditRule] = useState<ApprovalRule | null>(null);
  const [ruleConflict, setRuleConflict] = useState<ApprovalRule | null>(null);
  const [groups, setGroups] = useState<OrgGroup[]>(DEMO_GROUPS);
  const [editPolicy, setEditPolicy] = useState<TravelPolicy | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "" });
  const [uploadPolicy, setUploadPolicy] = useState<{ name: string; groupId: string; docName: string } | null>(null);

  const parsed = parseCsv(csvText, workspace.domain, employees);

  function detailsValid() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  }

  function add() {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const domainMatches = email.split("@")[1] === workspace.domain;
    const cleanManagers = managers.map((m) => m.trim()).filter(Boolean);
    const emp: Employee = {
      id: `u_${Date.now()}`, name: form.name.trim() || email.split("@")[0], email,
      role: form.role, status: "Joined", addedBy: workspace.userEmail,
      date: formatDate(new Date().toISOString()), domainMatches, external: !domainMatches,
      seniority: form.seniority,
      empId: form.empId.trim(), group: form.group, gender: form.gender, mobile: form.mobile.trim(),
      managers: cleanManagers,
    };
    setEmployees((l) => [...l, emp]);
    pushLog([
      { label: "Employee added", value: email, tone: "ok" },
      { label: "Role assigned", value: form.role },
      ...(cleanManagers.length ? [{ label: "Managers assigned", value: String(cleanManagers.length) }] : []),
    ]);
    setForm({ email: "", name: "", role: "Member", seniority: "IC", group: "Organization Group", empId: "", gender: "", mobile: "" });
    setManagers([""]);
    setEmpStep("details");
    setOpen(false);
  }

  function importRows(rows: ParsedRow[], source: string) {
    const valid = rows.filter((r) => r.valid);
    const emps: Employee[] = valid.map((r, i) => ({
      id: `u_${Date.now()}_${i}`, name: r.name, email: r.email, role: r.role,
      status: "Joined", addedBy: workspace.userEmail, date: formatDate(new Date().toISOString()),
      domainMatches: !r.external, external: r.external, seniority: r.seniority,
    }));
    setEmployees((l) => [...l, ...emps]);
    pushLog([
      { label: `${source} imported`, value: `${rows.length} rows parsed`, tone: "info" },
      { label: "Employees added", value: String(emps.length), tone: "ok" },
    ]);
  }

  function importSample(source: string) {
    const sample = source === "SFTP" ? SAMPLE_CSV : HRMS_SAMPLE_CSV;
    importRows(parseCsv(sample, workspace.domain, employees), source);
    setDataOpen(false);
    setDataStep("method");
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  }



  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{isAdminView ? t("admin.title") : t("emp.setupTitle")}</h2>
        <p className="text-xs text-muted-foreground">{isAdminView ? t("admin.sub", { company: workspace.displayName }) : t("emp.setupDesc")}</p>
      </div>

      {isAdminView && (
        <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {([
            ["connections", t("admin.tab.connections")],
            ["regions", t("admin.tab.regions")],
            ["policies", t("emp.tab.policies")],
            ["approvals", t("emp.tab.approvals")],
            ["groups", t("emp.tab.groups")],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${orgTab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setOrgTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "people" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("emp.people.desc")}</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${btnPrimary} px-4 py-2 text-xs`} onClick={() => setOpen(true)}>{t("emp.addEmployee")}</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t("table.name")}</th>
                  <th className="py-2 pr-3 font-medium">{t("table.email")}</th>
                  <th className="py-2 pr-3 font-medium">{t("ov.role")}</th>
                  <th className="py-2 pr-3 font-medium">{t("empm.seniority")}</th>
                  <th className="py-2 pr-3 font-medium">{t("table.group")}</th>
                  <th className="py-2 pr-3 font-medium">{t("table.status")}</th>
                  <th className="py-2 pr-3 font-medium">{t("table.addedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-medium">{e.name}{e.external && <span className="ml-1"><Pill tone="warn">{t("emp.externalDomain")}</Pill></span>}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{e.email}</td>
                    <td className="py-2.5 pr-3">{t(e.role === "Admin" ? "role.admin" : "role.member")}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{e.seniority}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{t(e.role === "Admin" ? "grp.adminGroup" : "grp.orgGroup")}</td>
                    <td className="py-2.5 pr-3"><Pill tone={e.status === "Joined" ? "ok" : "info"}>{t("es." + e.status)}</Pill></td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{e.addedBy === "—" ? "—" : e.addedBy.split("@")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdminView && orgTab === "connections" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("admin.connectionsDesc")}</p>
          <div className="flex flex-wrap gap-2">
            <button className={`${btnPrimary} px-4 py-2 text-xs`} onClick={() => setOpen(true)}>{t("emp.addEmployee")}</button>
            <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => setCsvOpen(true)}>{t("emp.uploadCsv")}</button>
            <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => { setDataStep("method"); setDataOpen(true); }}>{t("emp.importData")}</button>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs font-semibold">{t("admin.supported")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 py-1 pl-1.5 pr-2.5 text-sm text-muted-foreground"><SourceLogo label="CSV" />CSV</span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 py-1 pl-1.5 pr-2.5 text-sm text-muted-foreground"><SourceLogo label="SFTP" />SFTP</span>
              {HRMS_PLATFORMS.map((p) => <span key={p} className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 py-1 pl-1.5 pr-2.5 text-sm text-muted-foreground"><PlatformLogo name={p} size={20} />{p}</span>)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("admin.connectHint")}</p>
          </div>
        </div>
      )}

      {isAdminView && orgTab === "regions" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("admin.regionNote")}</p>
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("admin.regionCountry")}</label>
              <input className={`${inputCls} opacity-70`} value={workspace.country} readOnly />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("admin.regionCurrency")}</label>
              <input className={`${inputCls} opacity-70`} value={`${currencyFor(workspace.country).code} · ${currencySymbol(workspace.country).trim()}`} readOnly />
            </div>
          </div>
          <div className="max-w-md rounded-xl border border-border p-4 text-sm">
            <div className="mb-2 text-xs font-semibold">{t("admin.preview")}</div>
            <Row k={t("pol.domestic")} v={money(12000)} />
            <Row k={t("appr.autoApprove")} v={money(15000)} />
            <Row k={t("bk.total")} v={money(24800)} />
          </div>
        </div>
      )}

      {isAdminView && orgTab === "policies" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t("pol.desc")}</p>
            <div className="flex gap-2">
              <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => setUploadPolicy({ name: "", groupId: groups[0]?.id ?? "g_org", docName: "" })}>{t("pol.upload")}</button>
              <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => setEditPolicy({ id: `p_${Date.now()}`, name: "", groupId: groups[0]?.id ?? "g_org", domesticCap: 12000, domesticCabin: "Economy", intlCap: 60000, intlCabin: "Premium Economy", advanceDays: 7, cheaperFare: true, threshold: 15000 })}>{t("pol.new")}</button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {policies.map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.docName ? "📄" : "✈️"}</span>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </div>
                  {p.docName
                    ? <button className={`${btnGhost} px-3 py-1 text-xs`} onClick={() => setUploadPolicy({ name: p.name, groupId: p.groupId, docName: p.docName ?? "" })}>{t("pol.replace")}</button>
                    : <button className={`${btnGhost} px-3 py-1 text-xs`} onClick={() => setEditPolicy(p)}>{t("pol.edit")}</button>}
                </div>
                <div className="mb-2"><Pill tone="info">{groups.find((g) => g.id === p.groupId)?.name ?? t("pol.noGroup")}</Pill></div>
                {p.docName ? (
                  <div className="space-y-1.5 text-xs">
                    <Row k={t("pol.type")} v={t("pol.uploadedDoc")} />
                    <Row k={t("pol.file")} v={p.docName} />
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <Row k={t("pol.domestic")} v={`${money(p.domesticCap)} · ${t("cabin." + p.domesticCabin)}`} />
                    <Row k={t("pol.international")} v={`${money(p.intlCap)} · ${t("cabin." + p.intlCabin)}`} />
                    <Row k={t("pol.advanceBooking")} v={t("pol.days", { n: p.advanceDays })} />
                    <Row k={t("pol.cheaperNudge")} v={t(p.cheaperFare ? "common.on" : "common.off")} />
                    <Row k={t("pol.approvalOver")} v={money(p.threshold)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>


      )}

      {isAdminView && orgTab === "approvals" && (
        <div className="space-y-6">
          {/* Custom approval rules — first match wins. */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{t("appr.rulesTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("appr.rulesDesc")}</p>
              </div>
              <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => { setRuleConflict(null); setEditRule({ id: `r_${Date.now()}`, name: "", minAmount: 0, maxAmount: null, cabin: "any", region: "any", minSeniority: "any", outcome: "auto", approver: "" }); }}>{t("appr.addRule")}</button>
            </div>
            {rules.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">{t("appr.noRules")}</p>
            ) : (
              <ol className="space-y-2">
                {rules.map((r, i) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {r.name || t("appr.untitled")}
                          <Pill tone={r.outcome === "auto" ? "ok" : "warn"}>{t(r.outcome === "auto" ? "appr.outcome.auto" : "appr.outcome.require")}</Pill>
                          {findConflict(r, rules) && <Pill tone="warn">{t("appr.conflictTag")}</Pill>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{ruleSummary(r, money, t)}{r.outcome === "require" && r.approver ? ` → ${r.approver}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-3 text-xs">
                      <button className="text-muted-foreground underline hover:text-foreground" onClick={() => { setRuleConflict(null); setEditRule(r); }}>{t("common.edit")}</button>
                      <button className="text-muted-foreground underline hover:text-foreground" onClick={() => setRules((l) => l.filter((x) => x.id !== r.id))}>{t("appr.delete")}</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Default fallback chain — applies when no custom rule matches. */}
          <div className="space-y-4 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">{t("appr.defaultTitle")}</h3>
            <div className="flex flex-wrap items-baseline gap-2 text-sm text-muted-foreground">
              <span>{t("appr.autoUnder")}</span>
              <span className="inline-flex items-center gap-1">
                <span>{currencySymbol(workspace.country)}</span>
                <input
                  className="w-24 border-0 border-b border-input bg-transparent px-1 py-0.5 text-center text-sm font-medium text-foreground focus:border-foreground focus:outline-none"
                  value={approval.threshold}
                  onChange={(e) => setApproval((a) => ({ ...a, threshold: Number(e.target.value.replace(/\D/g, "")) || 0 }))}
                />
              </span>
              <span>{t("appr.higherRoutes")}</span>
            </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">{t("appr.autoApprove")}</span>
            </div>
            {approval.stages.map((s) => (
              <div key={s.id} className="flex items-baseline gap-3">
                <span className="text-muted-foreground">→</span>
                <div className={`flex items-baseline gap-3 ${s.enabled ? "" : "opacity-40"}`}>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{t(s.label === "Manager" ? "appr.stage.manager" : s.label === "Finance" ? "appr.stage.finance" : "common.none")}</span>
                    <input
                      className="w-44 border-0 border-b border-input bg-transparent px-0 py-1 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                      value={s.approver}
                      onChange={(e) => setApproval((a) => ({ ...a, stages: a.stages.map((x) => x.id === s.id ? { ...x, approver: e.target.value } : x) }))}
                    />
                  </div>
                  <button
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                    onClick={() => setApproval((a) => ({ ...a, stages: a.stages.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x) }))}
                  >
                    {t(s.enabled ? "appr.disable" : "appr.enable")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {isAdminView && orgTab === "groups" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className={`${btnGhost} px-4 py-2 text-xs`} onClick={() => { setNewGroup({ name: "" }); setGroupOpen(true); }}>{t("grp.create")}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t("table.group")}</th>
                  <th className="py-2 pr-3 font-medium">{t("grp.colMembers")}</th>
                  <th className="py-2 pr-3 font-medium">{t("grp.colPolicy")}</th>
                  <th className="py-2 pr-3 font-medium">{t("grp.colApproval")}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-medium">{g.name}{g.isDefault && <span className="ml-1"><Pill tone="info">{t("grp.default")}</Pill></span>}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{g.members}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{policies.find((p) => p.groupId === g.id)?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{t("grp.mgrFinance")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onContinue && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4">
          <div>
            <div className="text-sm font-semibold">{t("org.ready")}</div>
            <p className="text-xs text-muted-foreground">{t("org.readyDesc", { count: employees.length, ppl: employees.length === 1 ? t("org.person") : t("org.people"), pol: policies.length, grp: groups.length })}</p>
          </div>
          <button className={`${btnPrimary} text-sm`} onClick={onContinue}>{t("org.continueBooking")}</button>
        </div>
      )}


      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t(empStep === "details" ? "empm.add" : "empm.modifyMgr")}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>✕</button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{t("empm.stepOf", { n: empStep === "details" ? 1 : 2, label: empStep === "details" ? t("empm.empDetails") : t("empm.assignMgrs") })}</p>

            {empStep === "details" && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">{t("empm.mailId")}</label>
                    <input className={inputCls} placeholder="teammate@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    {form.email && form.email.includes("@") && form.email.split("@")[1] !== workspace.domain && (
                      <p className="mt-1 text-xs text-muted-foreground">{t("empm.diffDomain")}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("empm.empId")}</label>
                    <input className={inputCls} placeholder="EMP-0001" value={form.empId} onChange={(e) => setForm((f) => ({ ...f, empId: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("empm.mobile")}</label>
                    <input className={inputCls} placeholder="+91 90000 00000" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("table.group")}</label>
                    <select className={inputCls} value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}>
                      {groups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("empm.gender")}</label>
                    <select className={inputCls} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                      <option value="">{t("empm.selectGender")}</option>
                      {[["Male","gender.male"],["Female","gender.female"],["Other","gender.other"],["Prefer not to say","gender.prefer"]].map(([g,k]) => <option key={g} value={g}>{t(k)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("empm.seniority")}</label>
                    <select className={inputCls} value={form.seniority} onChange={(e) => setForm((f) => ({ ...f, seniority: e.target.value as SeniorityBand }))}>
                      {SENIORITY_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">{t("empm.seniorityHelp")}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button className={`${btnPrimary} text-sm`} disabled={!detailsValid()} onClick={() => setEmpStep("managers")}>{t("empm.continueArrow")}</button>
                </div>
              </>
            )}

            {empStep === "managers" && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">{t("empm.mgrDesc")}</p>
                <div className="space-y-2">
                  {managers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        placeholder={t("empm.mgrPlaceholder", { n: i + 1 })}
                        value={m}
                        onChange={(e) => setManagers((list) => list.map((v, idx) => (idx === i ? e.target.value : v)))}
                      />
                      {managers.length > 1 && (
                        <button
                          className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setManagers((list) => list.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {managers.length < 5 && (
                  <button
                    className="mt-3 text-xs font-medium text-primary hover:underline"
                    onClick={() => setManagers((list) => [...list, ""])}
                  >
                    + Add another manager
                  </button>
                )}
                <div className="mt-5 flex justify-between gap-2">
                  <button className={`${btnGhost} text-sm`} onClick={() => setEmpStep("details")}>{t("common.backArrow")}</button>
                  <button className={`${btnPrimary} text-sm`} disabled={!detailsValid()} onClick={add}>{t("emp.addEmployee")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {csvOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setCsvOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("emp.uploadCsv")}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setCsvOpen(false)}>✕</button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{t("csv.requiredCols")}</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className={`${btnGhost} px-3 py-2 text-xs`} onClick={downloadSampleCsv}>{t("csv.download")}</button>
              <label className={`${btnGhost} cursor-pointer px-3 py-2 text-xs`}>
                ↑ Upload CSV file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }} />
              </label>
            </div>
            <textarea className={`${inputCls} h-32 font-mono text-xs`} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={t("csv.placeholder")} />

            {parsed.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr><th className="px-3 py-2">{t("table.name")}</th><th className="px-3 py-2">{t("table.email")}</th><th className="px-3 py-2">{t("ov.role")}</th><th className="px-3 py-2">{t("table.status")}</th></tr>
                  </thead>
                  <tbody>
                    {parsed.map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                        <td className="px-3 py-2">{t(r.role === "Admin" ? "role.admin" : "role.member")}</td>
                        <td className="px-3 py-2"><Pill tone={r.valid ? (r.external ? "warn" : "ok") : "bad"}>{r.valid ? (r.external ? t("emp.externalDomain") : t("csv.ready")) : r.issue}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className={`${btnPrimary} mt-5 w-full`} disabled={!parsed.some((r) => r.valid)} onClick={() => { importRows(parsed, "csv"); setCsvOpen(false); }}>
              {t("csv.import", { n: parsed.filter((r) => r.valid).length })}
            </button>
          </div>
        </div>
      )}

      {dataOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setDataOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {t(dataStep === "method" ? "dt.method" : dataStep === "sftp" ? "dt.sftp" : "dt.hrms")}
                </h3>
                {(dataStep === "hrms-config" || dataStep === "hrms-apikey") && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PlatformLogo name={hrmsPlatform} size={14} />{t("dt.connectedTo", { p: hrmsPlatform })}</p>}
              </div>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setDataOpen(false)}>✕</button>
            </div>

            {dataStep === "method" && (
              <div className="space-y-3">
                <button
                  className="flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-secondary/40"
                  onClick={() => { setCsvOpen(true); setDataOpen(false); }}
                >
                  <span className="text-xl">📄</span>
                  <span>
                    <span className="block text-sm font-semibold">{t("emp.uploadCsv")}</span>
                    <span className="block text-xs text-muted-foreground">{t("dt.csv.desc")}</span>
                  </span>
                </button>
                <button
                  className="flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-secondary/40"
                  onClick={() => setDataStep("hrms-select")}
                >
                  <span className="text-xl">🔗</span>
                  <span>
                    <span className="block text-sm font-semibold">{t("dt.hrms")}</span>
                    <span className="block text-xs text-muted-foreground">{t("dt.hrms.desc")}</span>
                  </span>
                </button>
                <button
                  className="flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-secondary/40"
                  onClick={() => setDataStep("sftp")}
                >
                  <span className="text-xl">🗄️</span>
                  <span>
                    <span className="block text-sm font-semibold">{t("dt.sftp")}</span>
                    <span className="block text-xs text-muted-foreground">{t("dt.sftp.desc")}</span>
                  </span>
                </button>
              </div>
            )}

            {dataStep === "hrms-select" && (
              <div className="space-y-4">
                <input className={inputCls} placeholder={t("dt.searchHrms")} value={hrmsSearch} onChange={(e) => setHrmsSearch(e.target.value)} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {HRMS_PLATFORMS.filter((p) => p.toLowerCase().includes(hrmsSearch.toLowerCase())).map((p) => (
                    <button
                      key={p}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition ${hrmsPlatform === p ? "border-primary bg-secondary/50 ring-1 ring-primary" : "border-border hover:border-primary/60"}`}
                      onClick={() => setHrmsPlatform(p)}
                    >
                      <PlatformLogo name={p} size={28} />
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between gap-2">
                  <button className={`${btnGhost} text-sm`} onClick={() => setDataStep("method")}>{t("common.back")}</button>
                  <button className={`${btnPrimary} text-sm`} onClick={() => setDataStep("hrms-config")}>{t("common.continue")}</button>
                </div>
              </div>
            )}

            {dataStep === "hrms-config" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{t("dt.hrms.configDesc")}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border p-4 sm:grid-cols-3 md:grid-cols-4">
                  {DATA_FIELDS.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border accent-primary" />
                      {t(DATA_FIELD_KEYS[f])}
                    </label>
                  ))}
                </div>
                <div className="flex justify-between gap-2">
                  <button className={`${btnGhost} text-sm`} onClick={() => setDataStep("hrms-select")}>{t("common.back")}</button>
                  <button className={`${btnPrimary} text-sm`} onClick={() => setDataStep("hrms-apikey")}>{t("common.continue")}</button>
                </div>
              </div>
            )}

            {dataStep === "hrms-apikey" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{t("dt.apikey.desc", { p: hrmsPlatform })}</p>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("dt.apikey.label", { p: hrmsPlatform })}</label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder={t("dt.apikey.placeholder", { p: hrmsPlatform })}
                    value={hrmsApiKey}
                    onChange={(e) => setHrmsApiKey(e.target.value)}
                    autoFocus
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t("dt.apikey.note")}</p>
                </div>
                <div className="flex justify-between gap-2">
                  <button className={`${btnGhost} text-sm`} onClick={() => setDataStep("hrms-config")}>{t("common.back")}</button>
                  <button className={`${btnPrimary} text-sm`} disabled={!hrmsApiKey.trim()} onClick={() => importSample(hrmsPlatform)}>{t("dt.syncEmployees")}</button>
                </div>
              </div>
            )}


            {dataStep === "sftp" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{t("dt.sftp.desc2")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("sftp.host")}</label>
                    <input className={inputCls} value={sftp.host} onChange={(e) => setSftp((s) => ({ ...s, host: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("sftp.port")}</label>
                    <input className={inputCls} value={sftp.port} onChange={(e) => setSftp((s) => ({ ...s, port: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("sftp.username")}</label>
                    <input className={inputCls} value={sftp.username} onChange={(e) => setSftp((s) => ({ ...s, username: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("sftp.password")}</label>
                    <input className={inputCls} type="password" value={sftp.password} onChange={(e) => setSftp((s) => ({ ...s, password: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">{t("sftp.path")}</label>
                    <input className={inputCls} value={sftp.path} onChange={(e) => setSftp((s) => ({ ...s, path: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <button className={`${btnGhost} text-sm`} onClick={() => setDataStep("method")}>{t("common.back")}</button>
                  <button className={`${btnPrimary} text-sm`} onClick={() => importSample("SFTP")}>{t("dt.connectImport")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editPolicy && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditPolicy(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("epol.title")}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditPolicy(null)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("epol.name")}</label>
                <input className={inputCls} placeholder={t("epol.namePh")} value={editPolicy.name} onChange={(e) => setEditPolicy((p) => p && ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("epol.assignedGroup")}</label>
                <select className={inputCls} value={editPolicy.groupId} onChange={(e) => setEditPolicy((p) => p && ({ ...p, groupId: e.target.value }))}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold">{t("epol.domesticFlights")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("epol.budgetCap")}</label>
                    <input className={inputCls} value={editPolicy.domesticCap} onChange={(e) => setEditPolicy((p) => p && ({ ...p, domesticCap: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("epol.class")}</label>
                    <select className={inputCls} value={editPolicy.domesticCabin} onChange={(e) => setEditPolicy((p) => p && ({ ...p, domesticCabin: e.target.value }))}>
                      {CABIN_OPTIONS.map((c) => <option key={c} value={c}>{t("cabin." + c)}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold">{t("epol.intlFlights")}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("epol.budgetCap")}</label>
                    <input className={inputCls} value={editPolicy.intlCap} onChange={(e) => setEditPolicy((p) => p && ({ ...p, intlCap: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("epol.class")}</label>
                    <select className={inputCls} value={editPolicy.intlCabin} onChange={(e) => setEditPolicy((p) => p && ({ ...p, intlCabin: e.target.value }))}>
                      {CABIN_OPTIONS.map((c) => <option key={c} value={c}>{t("cabin." + c)}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("epol.advanceDays")}</label>
                  <input className={inputCls} value={editPolicy.advanceDays} onChange={(e) => setEditPolicy((p) => p && ({ ...p, advanceDays: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("epol.approvalOver")}</label>
                  <input className={inputCls} value={editPolicy.threshold} onChange={(e) => setEditPolicy((p) => p && ({ ...p, threshold: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" checked={editPolicy.cheaperFare} onChange={(e) => setEditPolicy((p) => p && ({ ...p, cheaperFare: e.target.checked }))} />
                Recommend cheaper fares to travellers
              </label>
            </div>
            <button className={`${btnPrimary} mt-5 w-full`} disabled={!editPolicy.name.trim()} onClick={() => { setPolicies((l) => l.some((x) => x.id === editPolicy.id) ? l.map((x) => x.id === editPolicy.id ? editPolicy : x) : [...l, editPolicy]); pushLog({ label: "Policy saved", value: `${editPolicy.name} → ${groups.find((g) => g.id === editPolicy.groupId)?.name ?? ""}`, tone: "ok" }); setEditPolicy(null); }}>{t("epol.save")}</button>
          </div>
        </div>

      )}

      {uploadPolicy && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setUploadPolicy(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("upol.title")}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setUploadPolicy(null)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("epol.name")}</label>
                <input className={inputCls} placeholder={t("upol.namePh")} value={uploadPolicy.name} onChange={(e) => setUploadPolicy((p) => p && ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("epol.assignedGroup")}</label>
                <select className={inputCls} value={uploadPolicy.groupId} onChange={(e) => setUploadPolicy((p) => p && ({ ...p, groupId: e.target.value }))}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t("upol.doc")}</label>
                <label className={`${btnGhost} flex cursor-pointer items-center justify-center px-4 py-3 text-xs`}>
                  {uploadPolicy.docName ? `✓ ${uploadPolicy.docName}` : t("upol.choose")}
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadPolicy((p) => p && ({ ...p, docName: f.name, name: p.name || f.name.replace(/\.[^.]+$/, "") })); e.target.value = ""; }} />
                </label>
                <p className="mt-1 text-xs text-muted-foreground">{t("upol.desc")}</p>
              </div>
            </div>
            <button
              className={`${btnPrimary} mt-5 w-full`}
              disabled={!uploadPolicy.name.trim() || !uploadPolicy.docName}
              onClick={() => {
                setPolicies((l) => {
                  const existing = l.find((x) => x.docName && x.name === uploadPolicy.name);
                  const policy: TravelPolicy = {
                    id: existing?.id ?? `p_${Date.now()}`, name: uploadPolicy.name.trim(), groupId: uploadPolicy.groupId,
                    domesticCap: 0, domesticCabin: "Economy", intlCap: 0, intlCabin: "Economy",
                    advanceDays: 0, cheaperFare: false, threshold: 0, docName: uploadPolicy.docName,
                  };
                  return existing ? l.map((x) => x.id === existing.id ? policy : x) : [...l, policy];
                });
                pushLog({ label: "Policy document uploaded", value: `${uploadPolicy.name} → ${groups.find((g) => g.id === uploadPolicy.groupId)?.name ?? ""}`, tone: "ok" });
                setUploadPolicy(null);
              }}
            >
              Save policy
            </button>
          </div>
        </div>
      )}


      {groupOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setGroupOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("grp.create")}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setGroupOpen(false)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("cgrp.name")}</label>
                <input className={inputCls} placeholder={t("cgrp.namePh")} value={newGroup.name} onChange={(e) => setNewGroup((g) => ({ ...g, name: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">{t("cgrp.desc")}</p>
            </div>
            <button
              className={`${btnPrimary} mt-5 w-full`}
              disabled={!newGroup.name.trim()}
              onClick={() => {
                const g: OrgGroup = { id: `g_${Date.now()}`, name: newGroup.name.trim(), isDefault: false, members: 0 };
                setGroups((l) => [...l, g]);
                pushLog({ label: "Group created", value: g.name, tone: "ok" });
                setGroupOpen(false);
              }}
            >
              Create group
            </button>
          </div>
        </div>
      )}

      {editRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => { setEditRule(null); setRuleConflict(null); }}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">{rules.some((x) => x.id === editRule.id) ? t("appr.editRule") : t("appr.newRule")}</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium">{t("appr.ruleName")}</label>
                <input className={inputCls} placeholder={t("appr.ruleNamePh")} value={editRule.name} onChange={(e) => setEditRule((r) => r && ({ ...r, name: e.target.value }))} />
              </div>
              <div className="text-xs font-semibold text-muted-foreground">{t("appr.when")}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("appr.condAmountMin")} ({currencySymbol(workspace.country).trim()})</label>
                  <input className={inputCls} inputMode="numeric" value={editRule.minAmount} onChange={(e) => setEditRule((r) => r && ({ ...r, minAmount: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("appr.condAmountMax")}</label>
                  <input className={inputCls} inputMode="numeric" placeholder={t("appr.noCap")} value={editRule.maxAmount ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setEditRule((r) => r && ({ ...r, maxAmount: v === "" ? null : Number(v) })); }} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("appr.condCabin")}</label>
                  <select className={inputCls} value={editRule.cabin} onChange={(e) => setEditRule((r) => r && ({ ...r, cabin: e.target.value as ApprovalCabin }))}>
                    <option value="any">{t("appr.anyCabin")}</option>
                    {CABIN_OPTIONS.map((c) => <option key={c} value={c}>{t("cabin." + c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("appr.condRegion")}</label>
                  <select className={inputCls} value={editRule.region} onChange={(e) => setEditRule((r) => r && ({ ...r, region: e.target.value as ApprovalRegion }))}>
                    <option value="any">{t("appr.anyRegion")}</option>
                    <option value="domestic">{t("appr.domestic")}</option>
                    <option value="intl">{t("appr.intl")}</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium">{t("appr.condSeniority")}</label>
                  <select className={inputCls} value={editRule.minSeniority} onChange={(e) => setEditRule((r) => r && ({ ...r, minSeniority: e.target.value as ApprovalSeniority }))}>
                    <option value="any">{t("appr.anySeniority")}</option>
                    {SENIORITY_BANDS.map((b) => <option key={b} value={b}>{t("appr.atLeast", { band: b })}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground">{t("appr.then")}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">{t("appr.outcome")}</label>
                  <select className={inputCls} value={editRule.outcome} onChange={(e) => setEditRule((r) => r && ({ ...r, outcome: e.target.value as ApprovalOutcome }))}>
                    <option value="auto">{t("appr.outcome.auto")}</option>
                    <option value="require">{t("appr.outcome.require")}</option>
                  </select>
                </div>
                {editRule.outcome === "require" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t("appr.approver")}</label>
                    <input className={inputCls} placeholder="approver@company.com" value={editRule.approver} onChange={(e) => setEditRule((r) => r && ({ ...r, approver: e.target.value }))} />
                  </div>
                )}
              </div>

              {ruleConflict && (
                <div className="rounded-xl border border-[color:var(--gold-deep,var(--border))] bg-[color:var(--gold,var(--accent))]/10 p-3 text-xs">
                  <div className="font-semibold">{t("appr.conflictTitle")}</div>
                  <p className="mt-1 text-muted-foreground">{t("appr.conflictBody", { name: ruleConflict.name || t("appr.untitled"), a: t(editRule.outcome === "auto" ? "appr.outcome.auto" : "appr.outcome.require"), b: t(ruleConflict.outcome === "auto" ? "appr.outcome.auto" : "appr.outcome.require") })}</p>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className={`${btnGhost} px-4 py-2 text-sm`} onClick={() => { setEditRule(null); setRuleConflict(null); }}>{t("common.cancel")}</button>
              <button
                className={`${btnPrimary} px-4 py-2 text-sm`}
                onClick={() => {
                  const conflict = findConflict(editRule, rules);
                  // Warn once; a second click (conflict already shown) saves anyway.
                  if (conflict && (!ruleConflict || ruleConflict.id !== conflict.id)) { setRuleConflict(conflict); return; }
                  setRules((l) => l.some((x) => x.id === editRule.id) ? l.map((x) => x.id === editRule.id ? editRule : x) : [...l, editRule]);
                  pushLog({ label: "Approval rule saved", value: `${editRule.name || "rule"} → ${editRule.outcome}`, tone: conflict ? "warn" : "ok" });
                  setEditRule(null); setRuleConflict(null);
                }}
              >
                {ruleConflict ? t("appr.saveAnyway") : t("appr.save")}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>

  );
}


// ---------- booking flow ----------
function BookFlow({ workspace, setWorkspace, employees, bookings, setBookings, pushLog, isAdmin }: { workspace: Workspace; setWorkspace: (w: Workspace) => void; employees: Employee[]; bookings: BookingRecord[]; setBookings: React.Dispatch<React.SetStateAction<BookingRecord[]>>; pushLog: (e: LogEvent | LogEvent[]) => void; isAdmin: boolean }) {
  const t = useT();
  const money = (n: number) => formatMoney(n, workspace.country);
  type BStep = "search" | "results" | "review" | "result" | "verify-needed";
  type TripType = "oneway" | "round" | "multi";
  const [bstep, setBstep] = useState<BStep>("search");
  const [tripType, setTripType] = useState<TripType>("oneway");
  const [cabin, setCabin] = useState<string>("Economy");
  const [search, setSearch] = useState({ from: "Mumbai", to: "Delhi", date: "2026-07-01", returnDate: "2026-07-05" });
  const [segments, setSegments] = useState<{ from: string; to: string; date: string }[]>([
    { from: "Mumbai", to: "Delhi", date: "2026-07-01" },
    { from: "Delhi", to: "Bengaluru", date: "2026-07-03" },
  ]);
  const [count, setCount] = useState(1);
  const [travellers, setTravellers] = useState<string[]>([workspace.userEmail]);
  const [selected, setSelected] = useState<Flight | null>(null);
  const [kybOpen, setKybOpen] = useState(false);
  const [result, setResult] = useState<{ booking: BookingRecord } | null>(null);

  const taxes = (fare: number) => Math.round(fare * 0.12);
  const legCount = tripType === "multi" ? segments.length : tripType === "round" ? 2 : 1;
  const pax = isAdmin ? count : 1;

  // Keep the per-seat traveller list in sync with the count (admins only).
  function setPaxCount(n: number) {
    const next = Math.max(1, Math.min(9, n));
    setCount(next);
    setTravellers((prev) => {
      const arr = prev.slice(0, next);
      while (arr.length < next) arr.push(workspace.userEmail);
      return arr;
    });
  }

  function routeSummary(): string {
    if (tripType === "multi") return segments.map((s) => s.from).concat(segments[segments.length - 1].to).join(" → ");
    if (tripType === "round") return `${search.from} ⇄ ${search.to}`;
    return `${search.from} → ${search.to}`;
  }

  function updateSegment(i: number, patch: Partial<{ from: string; to: string; date: string }>) {
    setSegments((segs) => segs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function finalizeBooking(ws: Workspace) {
    if (!selected) return;
    const base = selected.price * legCount * pax;
    const total = base + taxes(base);
    const { result: outcome, note, noteKey } = bookingOutcomeFor(ws.kybStatus);
    const rec: BookingRecord = {
      id: `bk_${Date.now()}`, route: routeSummary(),
      date: tripType === "multi" ? segments[0].date : search.date,
      traveller: pax > 1 ? `${travellers[0].split("@")[0]} +${pax - 1}` : travellers[0],
      fare: total, result: outcome, note, noteKey, cabin, pax, tripType,
    };
    setBookings((l) => [...l, rec]);
    setResult({ booking: rec });
    setBstep("result");
    pushLog([
      { label: "Booking confirmation attempted", value: `${routeSummary()} · ${cabin} · ${pax} pax` },
      { label: "Verification status checked", value: verificationLabel(ws.kybStatus), tone: verifTone(ws.kybStatus) },
      { label: "Booking outcome", value: outcome === "confirmed" ? "allowed" : outcome === "hold" ? "held" : "blocked", tone: outcome === "confirmed" ? "ok" : outcome === "hold" ? "warn" : "bad" },
    ]);
  }

  function onConfirm() {
    // Booking gate: search & review are open; confirm requires completed verification.
    if (!BOOKING_POLICY.allowConfirmBeforeVerification && !isVerificationComplete(workspace.kybStatus)) {
      pushLog({ label: "Booking confirmation attempted", value: "verification pending — confirm blocked", tone: "warn" });
      setBstep("verify-needed");
      return;
    }
    finalizeBooking(workspace);
  }


  return (
    <div>
      {bstep === "search" && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t("ov.searchTravel")}</h2>
            <div className="inline-flex rounded-xl border border-border bg-secondary/40 p-1 text-xs font-medium">
              {(["oneway", "round", "multi"] as const).map((tt) => (
                <button key={tt} onClick={() => setTripType(tt)} className={`rounded-lg px-3 py-1.5 transition ${tripType === tt ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t("bk.trip." + tt)}
                </button>
              ))}
            </div>
          </div>

          {tripType !== "multi" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-medium">{t("bk.from")}</label><input className={inputCls} value={search.from} onChange={(e) => setSearch((s) => ({ ...s, from: e.target.value }))} /></div>
              <div><label className="mb-1 block text-xs font-medium">{t("bk.to")}</label><input className={inputCls} value={search.to} onChange={(e) => setSearch((s) => ({ ...s, to: e.target.value }))} /></div>
              <div><label className="mb-1 block text-xs font-medium">{t("bk.departDate")}</label><input type="date" className={inputCls} value={search.date} onChange={(e) => setSearch((s) => ({ ...s, date: e.target.value }))} /></div>
              {tripType === "round" && (
                <div><label className="mb-1 block text-xs font-medium">{t("bk.returnDate")}</label><input type="date" className={inputCls} value={search.returnDate} min={search.date} onChange={(e) => setSearch((s) => ({ ...s, returnDate: e.target.value }))} /></div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={i} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{t("bk.leg", { n: i + 1 })}</span>
                    {segments.length > 2 && (
                      <button className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setSegments((segs) => segs.filter((_, idx) => idx !== i))}>{t("bk.removeLeg")}</button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><label className="mb-1 block text-xs font-medium">{t("bk.from")}</label><input className={inputCls} value={seg.from} onChange={(e) => updateSegment(i, { from: e.target.value })} /></div>
                    <div><label className="mb-1 block text-xs font-medium">{t("bk.to")}</label><input className={inputCls} value={seg.to} onChange={(e) => updateSegment(i, { to: e.target.value })} /></div>
                    <div><label className="mb-1 block text-xs font-medium">{t("bk.departDate")}</label><input type="date" className={inputCls} value={seg.date} onChange={(e) => updateSegment(i, { date: e.target.value })} /></div>
                  </div>
                </div>
              ))}
              {segments.length < 5 && (
                <button className="text-xs font-medium text-primary hover:underline" onClick={() => setSegments((segs) => [...segs, { from: segs[segs.length - 1].to, to: "", date: segs[segs.length - 1].date }])}>{t("bk.addLeg")}</button>
              )}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">{t("bk.cabin")}</label>
              <select className={inputCls} value={cabin} onChange={(e) => setCabin(e.target.value)}>
                {CABIN_OPTIONS.map((c) => <option key={c} value={c}>{t("cabin." + c)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t("bk.travellers")}</label>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="decrease" className="h-10 w-10 rounded-xl border border-input text-lg leading-none hover:bg-accent disabled:opacity-40" disabled={count <= 1} onClick={() => setPaxCount(count - 1)}>−</button>
                  <span className="w-10 text-center text-sm font-semibold">{count}</span>
                  <button type="button" aria-label="increase" className="h-10 w-10 rounded-xl border border-input text-lg leading-none hover:bg-accent disabled:opacity-40" disabled={count >= 9} onClick={() => setPaxCount(count + 1)}>+</button>
                  <span className="text-xs text-muted-foreground">{t("bk.travellerCount")}</span>
                </div>
              ) : (
                <>
                  <input className={`${inputCls} opacity-70`} value={workspace.userEmail} readOnly />
                  <p className="mt-1 text-xs text-muted-foreground">{t("bk.membersOnlySelf")}</p>
                </>
              )}
            </div>
          </div>

          {isAdmin && count > 0 && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium">{t("bk.assignTravellers")}</label>
              {travellers.map((tv, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{t("bk.seat", { n: i + 1 })}</span>
                  <select className={inputCls} value={tv} onChange={(e) => setTravellers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))}>
                    {employees.map((e) => <option key={e.id} value={e.email}>{e.name} · {e.seniority} · {e.email}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <button className={`${btnPrimary} mt-5 w-full`} onClick={() => { setBstep("results"); pushLog({ label: "Travel search performed", value: `${routeSummary()} · ${cabin} · ${pax} pax` }); }}>{t("bk.searchFlights")}</button>
        </section>
      )}

      {bstep === "results" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{routeSummary()}</h2>
              <p className="text-xs text-muted-foreground">{t("cabin." + cabin)} · {t("bk.legsPax", { legs: legCount, pax })}</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setBstep("search")}>{t("bk.editSearch")}</button>
          </div>
          {MOCK_FLIGHTS.map((f) => (
            <button key={f.id} onClick={() => { setSelected(f); setBstep("review"); pushLog({ label: "Itinerary selected", value: `${f.route} ${f.depart}` }); }}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent">
              <div><div className="font-semibold">{f.route}</div><div className="text-xs text-muted-foreground">{t("bk.departs", { time: f.depart })}</div></div>
              <div className="text-right"><div className="font-bold">{money(f.price)}</div><span className="text-xs text-muted-foreground">{t("bk.perPersonLeg")}</span></div>
            </button>
          ))}
        </section>
      )}

      {bstep === "review" && selected && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{t("bk.reviewBooking")}</h2><button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setBstep("results")}>{t("common.back")}</button></div>
          {(() => {
            const base = selected.price * legCount * pax;
            const tax = taxes(base);
            return (
          <div className="grid gap-2 text-sm">
            <Row k={t("bk.tripType")} v={t("bk.trip." + tripType)} />
            <Row k={t("bk.route")} v={routeSummary()} />
            <Row k={t("bk.cabin")} v={t("cabin." + cabin)} />
            <Row k={t("bk.date")} v={tripType === "round" ? `${search.date} → ${search.returnDate}` : tripType === "multi" ? segments.map((s) => s.date).join(", ") : search.date} />
            <Row k={t("bk.travellers")} v={travellers.map((e) => e.split("@")[0]).join(", ")} />
            <Row k={t("bk.fare")} v={`${money(selected.price)} × ${legCount} × ${pax}`} />
            <Row k={t("bk.taxes")} v={money(tax)} />
            <Row k={t("bk.company")} v={workspace.companyName} />
            <Row k={t("bk.paymentMode")} v={t("bk.corpAccount")} />
            <Row k={t("bk.gstInvoice")} v={isVerificationComplete(workspace.kybStatus) ? t("bk.enabled") : t("bk.afterVerification")} />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold"><span>{t("bk.total")}</span><span>{money(base + tax)}</span></div>
          </div>
            );
          })()}
          <button className={`${btnPrimary} mt-5 w-full`} onClick={onConfirm}>{t("bk.confirmBooking")}</button>
          <p className="mt-2 text-center text-xs text-muted-foreground">{t("bk.corpFaresNote")}</p>
        </section>
      )}

      {bstep === "result" && result && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mb-2 text-4xl">{result.booking.result === "confirmed" ? "✅" : result.booking.result === "hold" ? "⏳" : "⛔"}</div>
          <h2 className="text-lg font-bold">{t(result.booking.result === "confirmed" ? "bk.confirmed" : result.booking.result === "hold" ? "bk.onHold" : "bk.blocked")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t(result.booking.noteKey)}</p>
          <div className="mx-auto mt-4 max-w-xs rounded-xl bg-secondary/60 p-4 text-left text-sm">
            <Row k={t("bk.route")} v={result.booking.route} />
            {result.booking.cabin && <Row k={t("bk.cabin")} v={t("cabin." + result.booking.cabin)} />}
            <Row k={t("bk.date")} v={result.booking.date} />
            <Row k={t("bk.total")} v={money(result.booking.fare)} />
            <Row k={t("ov.verification")} v={t("vl." + verificationLabel(workspace.kybStatus))} />
          </div>
          <button className={`${btnGhost} mt-5`} onClick={() => { setBstep("search"); setSelected(null); setResult(null); }}>{t("bk.bookAnother")}</button>
        </section>
      )}

      {bstep === "verify-needed" && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mb-2 text-4xl">🔒</div>
          <h2 className="text-lg font-bold">{t("bk.completeToConfirm")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {isAdmin ? t("bk.verifyNeededAdmin") : t("bk.verifyNeededMember")}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button className={btnGhost} onClick={() => setBstep("review")}>{t("bk.backToReview")}</button>
            {isAdmin && <button className={btnPrimary} onClick={() => setKybOpen(true)}>{t("ov.continueVerification")}</button>}
          </div>
        </section>
      )}


      {kybOpen && (
        <KybUpgradeModal workspace={workspace} trigger="BOOKING_ATTEMPT" pushLog={pushLog}
          onClose={() => setKybOpen(false)}
          onResult={(w) => { setWorkspace(w); setKybOpen(false); finalizeBooking(w); }} />
      )}
    </div>
  );
}


// ---------- progressive KYB modal ----------
function KybUpgradeModal({ workspace, trigger, pushLog, onClose, onResult, onMemberContinue }: { workspace: Workspace; trigger: KybTrigger; pushLog: (e: LogEvent | LogEvent[]) => void; onClose: () => void; onResult: (w: Workspace) => void; onMemberContinue?: () => void }) {
  const t = useT();
  const isCompanyLike = ["Private Limited", "Public Limited", "Company"].includes(workspace.businessType);
  const businessType = (workspace.businessType || "Private Limited") as BusinessType;
  // Identifier is always required for verification.
  const identifierOptional = false;

  const country = workspace.country || "India";
  const cfg = countryKyb(country);
  const hasDirector = !!cfg.director;

  const [stage, setStage] = useState<"confirm" | "gst-verified" | "rep">("confirm");
  const outcome: LiveOutcome = "pass";
  const [relationship, setRelationship] = useState<RepresentativeRole>(isCompanyLike ? "director_kmp" : (workspace.businessType === "Sole Proprietorship" ? "proprietor" : "authorised_employee"));
  const [dinChoice, setDinChoice] = useState<"now" | "later">("now");
  // How the user proves authority: director identity, an uploaded Board Resolution, or provide later.
  const [authMethod, setAuthMethod] = useState<"din" | "document" | "later">(hasDirector ? "din" : "document");
  const [boardDoc, setBoardDoc] = useState<string>("");
  const [din, setDin] = useState(cfg.director?.placeholder ?? "");
  const defaultSignatoryName = workspace.userEmail.split("@")[0].replace(/[._-].*/, "").replace(/^\w/, (c) => c.toUpperCase());
  const [signatoryNameInput, setSignatoryNameInput] = useState(defaultSignatoryName);

  // Country-specific business identifiers. India keeps the GST → UDYAM fallback toggle.
  const [useFallback, setUseFallback] = useState(false);
  const activeFields = useFallback && cfg.fallback ? [cfg.fallback] : cfg.identifiers;
  const [idValues, setIdValues] = useState<Record<string, string>>({});
  const requiredFilled = activeFields.filter((f) => !f.optional).every((f) => (idValues[f.key] ?? "").trim().length >= 2);
  const idValid = identifierOptional || requiredFilled;
  const signatoryName = signatoryNameInput.trim();
  const signatoryNameValid = signatoryName.length >= 2;
  const idSummary = () => activeFields.map((f) => `${f.label}: ${(idValues[f.key] ?? "").trim() || "—"}`).join(" · ");

  // What the user is registering as — only the first three can run KYC / manage employees.
  const [regRole, setRegRole] = useState<"director_kmp" | "authorised_signatory" | "admin" | "member">("director_kmp");
  const canManage = regRole !== "member";
  const needsDeclaration = regRole === "admin" || regRole === "member";
  const [declAck, setDeclAck] = useState(false);

  function run() {
    const formCreatedAt = new Date().toISOString();
    const nowIso = new Date().toISOString();
    const ki = workspace.knownIdentifiers;
    const isIndia = country === "India";
    const gstinVal = isIndia && !useFallback ? (idValues.gstin ?? "").trim() : (ki.gstin ?? "");
    const udyamVal = isIndia && useFallback ? ((idValues.udyam ?? "").trim() || undefined) : undefined;
    // Mirror buildLiveBundle's PAN derivation so the engine's CIN↔PAN cross-check lines up.
    const panVal = (ki.pan ?? "") || (gstinVal ? gstinVal.slice(2, 12) : "");
    const input: EntityKybInput = {
      businessName: workspace.companyName, vertical: "", businessType,
      registeredAddress: "", country,
      state: "", city: "", pincode: "", numberOfEmployees: "", email: workspace.userEmail, phone: "", contactPerson: signatoryName,
      gstin: gstinVal,
      pan: panVal,
      cin: ki.cin ?? "",
      udyam: udyamVal,
      documents: autoDocs(businessType),
    };
    // Demo triangulation — fires only for domain-matched workspaces (TartanHQ et al.)
    if (workspace.companyIdentificationStatus === "Domain Matched") {
      const tri = checkTriangulation(workspace, gstinVal);
      pushLog([
        {
          label: "Triangulation: domain ↔ GSTIN",
          value: tri.domainGstinMatch === null
            ? "skipped (no known GSTIN for domain)"
            : tri.domainGstinMatch
              ? "match ✓"
              : `mismatch — entered ${gstinVal}, domain registry has ${workspace.knownIdentifiers.gstin}`,
          tone: tri.domainGstinMatch === false ? "bad" : tri.domainGstinMatch ? "ok" : "info",
        },
        {
          label: "Triangulation: domain ↔ legal name",
          value: tri.domainNameMatch === null
            ? "skipped (no name entered at sign-up)"
            : tri.domainNameMatch
              ? "match ✓"
              : `mismatch — "${workspace.legalNameAtOnboarding}" vs "${workspace.companyName}"`,
          tone: tri.domainNameMatch === false ? "warn" : tri.domainNameMatch ? "ok" : "info",
        },
        {
          label: "Triangulation: GSTIN ↔ PAN",
          value: tri.gstinPanMatch === null
            ? "skipped (insufficient GSTIN length)"
            : tri.gstinPanMatch
              ? `PAN embedded in GSTIN matches registry ✓`
              : `PAN mismatch — GSTIN embeds ${gstinVal.slice(2, 12)}, registry has ${workspace.knownIdentifiers.pan}`,
          tone: tri.gstinPanMatch === false ? "bad" : tri.gstinPanMatch ? "ok" : "info",
        },
        {
          label: "Triangulation verdict",
          value: tri.allPass
            ? "All signals corroborate"
            : "One or more signals conflict — review before proceeding",
          tone: tri.allPass ? "ok" : "warn",
        },
      ]);
    }

    const dinRemembered = hasDirector && isCompanyLike && dinChoice === "now";
    const rep: RepresentativeClaim = { role: relationship, signatoryName, din: dinRemembered ? din : undefined, dinRemembered };
    const { api, inputPatch } = buildLiveBundle(input, rep, outcome);
    const merged = { ...input, ...inputPatch };
    const d = runKybDecision(merged, rep, { api, formCreatedAt, nowIso, scenarioId: `upgrade_${trigger}` });
    const friendly = friendlyKybStatus(d.finalStatus);
    onResult({
      ...workspace,
      kybStatus: friendly,
      kybInternal: d.finalStatus,
      dinDeadline: friendly.includes("DIN Pending") ? d.deadline : undefined,
      workspaceStatus: "Active", // workspace never destroyed on KYB failure
    });
    pushLog([
      { label: "Country", value: country },
      { label: "Signing person", value: signatoryName },
      { label: "Identifier(s) submitted", value: idSummary() },
      { label: "Company details fetched", value: d.apiCalls.map((a) => a.endpoint).join(", ") },
      { label: "Verification rules evaluated", value: `${d.rules.length} (${d.failedRules.length} failed)` },
      { label: "Verification decision returned", value: verificationLabel(friendlyKybStatus(d.finalStatus)), tone: verifTone(friendlyKybStatus(d.finalStatus)) },
    ]);
  }


  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {stage !== "gst-verified" && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t(stage === "rep" ? "kyb.confirmAuthority" : "kyb.completeVerification")}</h2>
              <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>✕</button>
            </div>
            {stage === "rep" && (
              <p className="mb-5 text-sm text-muted-foreground">
                {t("kyb.repIntro")}
              </p>
            )}
            {stage === "confirm" && (
              <p className="mb-6 text-sm text-muted-foreground">
                {t("kyb.confirmIntro")}
              </p>
            )}
          </>
        )}
        {stage === "gst-verified" && (
          <div className="mb-4 flex items-center justify-end">
            <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>✕</button>
          </div>
        )}


        {stage === "confirm" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("bk.company")}</div>
              <div className="mt-3 grid gap-2 text-sm">
                <Row k={t("kyb.legalName")} v={workspace.companyName} />
                <Row k={t("kyb.businessType")} v={businessType} />
                <Row k={t("email.country")} v={country} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">{t("kyb.signatoryName")}</label>
                <input
                  className={`${inputCls} placeholder:text-muted-foreground/40`}
                  value={signatoryNameInput}
                  onChange={(e) => setSignatoryNameInput(e.target.value)}
                  placeholder={t("kyb.signatoryNamePh")}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("kyb.signatoryNameHelp")}</p>
              </div>
              {activeFields.map((f) => (
                <div key={f.key}>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">{f.label}</label>
                    {(f.optional || identifierOptional) && <Pill>{t("common.optional")}</Pill>}
                  </div>
                  <input
                    className={`${inputCls} placeholder:text-muted-foreground/40`}
                    value={idValues[f.key] ?? ""}
                    onChange={(e) => setIdValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              {cfg.fallback && (
                <button type="button"
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => setUseFallback((v) => !v)}>
                  {useFallback ? t("kyb.useInstead", { label: cfg.identifiers[0].label }) : t("kyb.fallbackPrompt", { primary: cfg.identifiers[0].label, fallback: cfg.fallback.label })}
                </button>
              )}
            </div>


            <div className="space-y-2 pt-1">
              <button className={`${btnPrimary} w-full`} disabled={!idValid || !signatoryNameValid} onClick={() => { if (isCompanyLike) setStage("gst-verified"); else run(); }}>
                {t("kyb.verifyCompany")}
              </button>
              <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={onClose}>{t("kyb.doLater")}</button>
            </div>
          </div>
        )}

        {stage === "gst-verified" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-foreground bg-secondary p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div className="text-lg font-bold text-foreground">{t("kyb.companyVerified")}</div>
              <p className="mt-1 text-sm text-muted-foreground">{t("kyb.confirmedFor", { label: activeFields[0]?.label ?? t("kyb.identifier"), company: workspace.companyName })}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kyb.verifiedDetails")}</div>
              <div className="grid gap-1 text-sm">
                <Row k={t("kyb.legalName")} v={workspace.companyName} />
                <Row k={t("kyb.businessType")} v={businessType} />
                <Row k={t("email.country")} v={country} />
                <Row k={t("kyb.identifier")} v={idSummary()} />

              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t("kyb.registeringAs")}</span>
              <select className={inputCls} value={regRole} onChange={(e) => setRegRole(e.target.value as typeof regRole)}>
                <option value="director_kmp">{t("role.directorKmp")}</option>
                <option value="authorised_signatory">{t("role.authSignatory")}</option>
                <option value="admin">{t("role.admin")}</option>
                <option value="member">{t("role.orgMember")}</option>
              </select>
            </label>
            {needsDeclaration && (
              <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={declAck}
                  onChange={(e) => setDeclAck(e.target.checked)}
                />
                <span>
                  {t("kyb.declaration", { company: workspace.companyName })}
                </span>
              </label>
            )}
            {canManage ? (
              <button className={`${btnPrimary} w-full`} disabled={needsDeclaration && !declAck} onClick={() => { setRelationship(regRole === "director_kmp" ? "director_kmp" : "authorised_employee"); setAuthMethod(!hasDirector || regRole === "authorised_signatory" ? "document" : "din"); setDinChoice("now"); setStage("rep"); }}>{t("kyb.continueAuthority")}</button>
            ) : (
              <button className={`${btnPrimary} w-full`} disabled={needsDeclaration && !declAck} onClick={() => (onMemberContinue ?? onClose)()}>{t("empm.continueArrow")}</button>
            )}
            {canManage && (
              <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => (onMemberContinue ?? onClose)()}>{t("kyb.doLater")}</button>
            )}
          </div>
        )}

        {stage === "rep" && (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("kyb.chooseAuthority")}</div>
              <div className="flex items-stretch gap-3">
                {hasDirector && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setAuthMethod("din"); setDinChoice("now"); }}
                      className={`flex-1 rounded-xl border p-3 text-left transition-colors ${authMethod === "din" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-foreground/30"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{cfg.director!.label}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${authMethod === "din" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                          {authMethod === "din" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{cfg.director!.help}</p>
                    </button>
                    <div className="flex flex-col items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground">{t("kyb.or")}</div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setAuthMethod("document"); setDinChoice("now"); }}
                  className={`flex-1 rounded-xl border p-3 text-left transition-colors ${authMethod === "document" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-foreground/30"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t("kyb.boardResolution")}</span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${authMethod === "document" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                      {authMethod === "document" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t("kyb.boardResolutionHelp")}</p>
                </button>
              </div>
              {hasDirector && authMethod === "din" && <input className={inputCls} placeholder={cfg.director!.placeholder} value={din} onChange={(e) => setDin(e.target.value)} />}
              {authMethod === "document" && (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground hover:text-foreground">
                  <span className="font-medium">{boardDoc || t("kyb.uploadBoard")}</span>
                  <span className="text-xs">{t("kyb.fileTypes")}</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setBoardDoc(e.target.files?.[0]?.name ?? "")} />
                </label>
              )}
            </div>
            <button className={`${btnPrimary} w-full`} disabled={authMethod === "din" ? !din.trim() : !boardDoc} onClick={() => { setDinChoice("now"); run(); }}>{t("kyb.confirmAuthorityBtn")}</button>
            <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => { setAuthMethod("later"); setDinChoice("later"); run(); }}>{t("kyb.provideLater")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

// ---------- backend console ----------
function ConsoleDock({ open, setOpen, log }: { open: boolean; setOpen: (b: boolean) => void; log: LogEvent[] }) {
  const t = useT();
  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-30 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background shadow-lg">
        {t(open ? "console.hide" : "console.show")}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-30 max-h-[60vh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">{t("console.title")}</span>
            <Pill>{t("console.events", { n: log.length })}</Pill>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t("console.desc")}</p>
          <ul className="space-y-1.5 font-mono text-[11px]">
            {log.length === 0 && <li className="text-muted-foreground">{t("console.noEvents")}</li>}
            {log.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.tone === "ok" ? "bg-foreground" : e.tone === "bad" ? "bg-border" : "bg-muted-foreground"}`} />
                <span><span className="text-muted-foreground">{e.label}:</span> {e.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// English dictionary — source of truth. All other languages mirror these keys.
export const en: Record<string, string> = {
  // common
  "common.getStarted": "Get started",
  "common.continue": "Continue",
  "common.back": "Back",
  "common.backArrow": "← Back",
  "common.remove": "Remove",
  "common.optional": "Optional",
  "common.on": "On",
  "common.off": "Off",
  "common.none": "—",

  // nav
  "nav.platform": "Platform",
  "nav.how": "How it works",
  "nav.why": "Why us",

  // hero
  "hero.badge": "Corporate travel, reimagined",
  "hero.title": "Business travel your whole company will love.",
  "hero.subtitle":
    "Book trips, control spend and keep travellers safe — all from one platform. Set up your corporate workspace in under a minute with just your work email.",
  "hero.ctaPrimary": "Get started — it's free",
  "hero.ctaSecondary": "See how it works",
  "hero.noCard": "No credit card. No paperwork to begin.",
  "hero.card.upcoming": "Upcoming trip",
  "hero.card.confirmed": "Confirmed",
  "hero.card.hotel": "Taj Santacruz · 2 nights",
  "hero.card.withinPolicy": "Within policy",
  "hero.card.estSpend": "Estimated spend",

  // stats
  "stats.saved": "average travel spend saved",
  "stats.onboard": "to onboard your company",
  "stats.countries": "countries covered",
  "stats.satisfaction": "traveller satisfaction",

  // features
  "features.title": "Everything travel, nothing manual",
  "features.subtitle":
    "One platform for booking, spend and traveller safety — built for finance and employees alike.",
  "feature.book.title": "Book in seconds",
  "feature.book.desc": "Flights, hotels and rail in one place with negotiated corporate rates.",
  "feature.expense.title": "Automatic expensing",
  "feature.expense.desc": "Receipts, GST invoices and reconciliation handled for you — no spreadsheets.",
  "feature.policy.title": "Policy on autopilot",
  "feature.policy.desc": "Set travel policies once; approvals and limits enforce themselves.",
  "feature.care.title": "24/7 traveller care",
  "feature.care.desc": "Real humans on call for re-bookings, disruptions and emergencies.",

  // how it works
  "how.title": "Live in three steps",
  "how.subtitle":
    "We identify your company instantly — verification only happens when you unlock corporate benefits.",
  "how.step1.t": "Enter your work email",
  "how.step1.d": "Verify with a one-time code. We instantly recognise your company from your domain.",
  "how.step2.t": "Your workspace is ready",
  "how.step2.d": "Start booking right away — no forms, no documents, no waiting.",
  "how.step3.t": "Unlock corporate benefits",
  "how.step3.d": "Activate GST invoicing, credit and controls when you're ready. We handle the rest.",

  // cta
  "cta.title": "Set up your corporate travel in under a minute",
  "cta.subtitle": "Join finance and people teams who run all of company travel from one place.",
  "cta.button": "Get started now",

  // footer
  "footer.proto": "◆ TartanHQ Travel · Prototype",
  "footer.rights": "© {year} TartanHQ. All rights reserved.",

  // email screen
  "email.title": "Set up your business travel workspace",
  "email.sub": "Use your work email and we'll identify your company automatically.",
  "email.workEmail": "Work email",
  "email.companyLegal": "Company legal name",
  "email.country": "Country",
  "email.err.invalid": "Enter a valid email address.",
  "email.err.disposable": "Disposable email domains aren't supported. Use your work email.",

  // otp
  "otp.title": "Verify your email",
  "otp.sub": "We sent a 6-digit code to {email}.",
  "otp.verify": "Verify email",
  "otp.resend": "Didn't get it? Resend code",
  "otp.err.invalid": "Invalid code. Try again.",

  // company mismatch
  "mismatch.title": "We couldn't find your company",
  "mismatch.sub": "The work email domain and company legal name do not appear to match.",
  "mismatch.body": "Please reach out to us via our support email ID and we'll help verify the right company for your workspace.",
  "mismatch.email": "Email support@tartanhq.com",
  "mismatch.tryAgain": "Use a different work email",

  // company name
  "cname.title": "What's your company name?",
  "cname.sub": "We couldn't identify your company from your email domain. We'll look it up.",
  "cname.find": "Find my company",

  // company select
  "cselect.title": "Select your company",
  "cselect.sub": "We found these possible matches.",
  "cselect.none": "None of these",

  // free email
  "free.title": "Please use your work email to continue faster",
  "free.sub": "Or share a few details and we'll try to identify your company.",
  "free.useWork": "Use work email instead",
  "free.company": "Company name",
  "free.website": "Company website",
  "free.continue": "Continue with these details",

  // dashboard
  "dash.selectAccount": "Select account",
  "dash.restart": "Restart demo",
  "dash.welcome": "Welcome, {name}",
  "dash.ready": "{company} workspace is ready · {role}",
  "dash.roleAdmin": "You're the workspace admin.",
  "dash.roleMember": "You're a member of this workspace.",
  "tab.overview": "Overview",
  "tab.employees": "Employees",
  "tab.book": "Book travel",

  // overview
  "ov.identifiedVia": "Identified via {via}",
  "ov.via.lookup": "company-name lookup",
  "ov.role": "Role",
  "ov.companyId": "Company identification",
  "ov.workspace": "Workspace",
  "ov.verification": "Verification",
  "ov.workspaceBadge": "Workspace: {status}",
  "ov.completeVerification": "Complete company verification",
  "ov.verifyDesc":
    "We have identified your company from your work email. Verify your {idLabel} to complete setup and enable employee travel bookings.",
  "ov.verifyWithFallback": "Verify with {primary} · {fallback} accepted if unavailable",
  "ov.verifyWith": "Verify with {primary}",
  "ov.continueVerification": "Continue verification",
  "ov.memberPending":
    "Company verification is pending. Ask a workspace admin to complete verification to enable travel bookings.",
  "ov.quickActions": "Quick actions",
  "ov.searchTravel": "Search travel",
  "ov.addEmployees": "Add employees",
  "ov.glance": "At a glance",
  "ov.teamMembers": "Team members",
  "ov.bookings": "Bookings",

  // roles
  "role.admin": "Admin",
  "role.member": "Member",
  "role.directorKmp": "Director / KMP",
  "role.authSignatory": "Authorised Signatory",
  "role.orgMember": "Employee / Organisation Member",

  // workspace status
  "ws.Workspace Created": "Workspace Created",
  "ws.Company Identified": "Company Identified",
  "ws.Company Identification Pending": "Company Identification Pending",
  "ws.Limited Access": "Limited Access",
  "ws.Active": "Active",

  // company identification status
  "ci.Domain Matched": "Domain Matched",
  "ci.Domain Unknown": "Domain Unknown",
  "ci.Free Email": "Free Email",
  "ci.Company Name Match": "Company Name Match",
  "ci.Company Name Unresolved": "Company Name Unresolved",

  // verification labels
  "vl.Verification Complete": "Verification Complete",
  "vl.Authority Confirmation Pending": "Authority Confirmation Pending",
  "vl.Verification In Progress": "Verification In Progress",
  "vl.Assisted Onboarding Required": "Assisted Onboarding Required",
  "vl.Verification Failed": "Verification Failed",
  "vl.Verification Pending": "Verification Pending",

  // employees tab
  "emp.setupTitle": "Would you like to set up your organisation?",
  "emp.setupDesc":
    "Define who travels, the rules they travel by, and who signs off. Everything below is pre-filled — review and continue.",
  "emp.tab.people": "People",
  "emp.tab.policies": "Travel policies",
  "emp.tab.approvals": "Approvals",
  "emp.tab.groups": "Groups",
  "emp.people.desc":
    "Add teammates manually, or import in bulk via CSV, HRMS integration, or SFTP — no verification needed to add people.",
  "emp.addEmployee": "Add employee",
  "emp.uploadCsv": "Upload CSV",
  "emp.importData": "Import data",
  "emp.externalDomain": "External domain",

  // table headers
  "table.name": "Name",
  "table.email": "Email",
  "table.role": "Role",
  "table.group": "Group",
  "table.status": "Status",
  "table.addedBy": "Added by",

  // groups names
  "grp.adminGroup": "Admin Group",
  "grp.orgGroup": "Organization Group",

  // employee status
  "es.Joined": "Joined",
  "es.Pending": "Pending",
  "es.Suspended": "Suspended",

  // policies tab
  "pol.desc": "Flight policies — build them on the portal or upload a policy document, each assigned to a group.",
  "pol.upload": "↑ Upload policy",
  "pol.new": "+ New policy",
  "pol.noGroup": "No group",
  "pol.type": "Type",
  "pol.uploadedDoc": "Uploaded document",
  "pol.replace": "Replace",
  "pol.edit": "Edit",
  "pol.file": "File",
  "pol.domestic": "Domestic",
  "pol.international": "International",
  "pol.advanceBooking": "Advance booking",
  "pol.days": "{n} days",
  "pol.cheaperNudge": "Cheaper-fare nudge",
  "pol.approvalOver": "Approval over",

  // approvals tab
  "appr.autoUnder": "Auto-approve trips under",
  "appr.higherRoutes": "— anything higher routes through the chain below.",
  "appr.autoApprove": "Auto-approve",
  "appr.stage.manager": "Manager",
  "appr.stage.finance": "Finance",
  "appr.disable": "disable",
  "appr.enable": "enable",

  // groups tab
  "grp.create": "Create group",
  "grp.colGroup": "Group",
  "grp.colMembers": "Members",
  "grp.colPolicy": "Policy",
  "grp.colApproval": "Approval",
  "grp.default": "Default",
  "grp.mgrFinance": "Manager → Finance",

  // org ready
  "org.ready": "Organisation ready",
  "org.readyDesc":
    "{count} {ppl} · {pol} policies · approval chain set · {grp} groups. Continue now and refine anytime.",
  "org.person": "person",
  "org.people": "people",
  "org.continueBooking": "Continue to travel booking →",

  // add employee modal
  "empm.add": "Add employee",
  "empm.modifyMgr": "Modify manager",
  "empm.stepOf": "Step {n} of 2 · {label}",
  "empm.empDetails": "Employee details",
  "empm.assignMgrs": "Assign managers",
  "empm.mailId": "Mail ID",
  "empm.diffDomain": "Different domain — they'll be added as External / needs admin confirmation.",
  "empm.empId": "Employee ID",
  "empm.mobile": "Mobile number",
  "empm.group": "Group",
  "empm.gender": "Gender",
  "empm.selectGender": "Select gender",
  "empm.continueArrow": "Continue →",
  "empm.mgrDesc": "Add up to 5 managers for this employee (mail ID). All optional.",
  "empm.mgrPlaceholder": "Manager {n} mail ID",
  "empm.addAnother": "+ Add another manager",

  // gender
  "gender.male": "Male",
  "gender.female": "Female",
  "gender.other": "Other",
  "gender.prefer": "Prefer not to say",

  // csv modal
  "csv.title": "Upload CSV",
  "csv.requiredCols":
    "Required columns: Employee Name, Employee ID, Designation, Email ID, Manager Name, Manager Email ID. Download the sample, fill it in, and upload — or paste/edit rows below.",
  "csv.download": "↓ Download sample CSV",
  "csv.uploadFile": "↑ Upload CSV file",
  "csv.placeholder": "Paste CSV rows here or upload a file above",
  "csv.ready": "Ready",
  "csv.import": "Import {n} employees",

  // data transfer modal
  "dt.method": "Data Transfer Method",
  "dt.sftp": "SFTP Transfer",
  "dt.hrms": "HRMS Integration",
  "dt.connectedTo": "Connected to {p}",
  "dt.csv.desc":
    "Quickly upload your data using CSV files. Download our template, fill in your data, and upload — simple and fast.",
  "dt.hrms.desc":
    "Connect your HRMS for seamless, automated data transfer. Supports major platforms like SAP, Workday, BambooHR and more.",
  "dt.sftp.desc":
    "Upload files securely via SFTP for automated ingestion. Scheduled pickups and encrypted file transfer included.",
  "dt.searchHrms": "Search HRMS",
  "dt.hrms.configDesc":
    "Mandatory fields (Name, Employment Status, Employee ID) are always synced. Select additional data fields to import — all pre-selected for you.",
  "dt.apikey.desc":
    "Enter your {p} API key to authorise the connection. You can find this in your {p} admin settings under API / Integrations.",
  "dt.apikey.label": "{p} API key",
  "dt.apikey.placeholder": "Paste your {p} API key",
  "dt.apikey.note": "Your key is encrypted and used only to sync employee data.",
  "dt.syncEmployees": "Sync employees",
  "dt.sftp.desc2": "Enter your SFTP details and you're ready to go. Pre-filled for this demo.",
  "dt.connectImport": "Connect & import",

  // data fields
  "field.employeeName": "Employee Name",
  "field.employeeId": "Employee ID",
  "field.designation": "Designation",
  "field.emailId": "Email ID",
  "field.managerName": "Manager Name",
  "field.managerEmailId": "Manager Email ID",

  // sftp
  "sftp.host": "Host",
  "sftp.port": "Port",
  "sftp.username": "Username",
  "sftp.password": "Password / Key",
  "sftp.path": "Remote path",

  // edit policy
  "epol.title": "✈️ Flight policy",
  "epol.name": "Policy name",
  "epol.namePh": "e.g. Standard Flight Policy",
  "epol.assignedGroup": "Assigned group",
  "epol.domesticFlights": "Domestic flights",
  "epol.intlFlights": "International flights",
  "epol.budgetCap": "Budget cap ({cur})",
  "epol.class": "Class",
  "epol.advanceDays": "Advance booking (days)",
  "epol.approvalOver": "Approval over ({cur})",
  "epol.recommendCheaper": "Recommend cheaper fares to travellers",
  "epol.save": "Save policy",

  // cabin classes
  "cabin.Economy": "Economy",
  "cabin.Premium Economy": "Premium Economy",
  "cabin.Business": "Business",
  "cabin.First": "First",

  // upload policy
  "upol.title": "📄 Upload policy document",
  "upol.name": "Policy name",
  "upol.namePh": "e.g. Corporate Travel Policy 2025",
  "upol.assignedGroup": "Assigned group",
  "upol.doc": "Policy document",
  "upol.choose": "↑ Choose file (PDF, DOC, DOCX)",
  "upol.desc": "Upload your existing written travel policy to attach it to a group.",
  "upol.save": "Save policy",

  // create group
  "cgrp.title": "Create group",
  "cgrp.name": "Group name",
  "cgrp.namePh": "e.g. Sales Team",
  "cgrp.desc": "Assign a flight policy to this group from the Travel policies tab.",
  "cgrp.create": "Create group",

  // booking
  "bk.searchTravel": "Search travel",
  "bk.from": "From",
  "bk.to": "To",
  "bk.travelDate": "Travel date",
  "bk.traveller": "Traveller",
  "bk.membersOnlySelf": "Members can only book travel for themselves.",
  "bk.searchFlights": "Search flights",
  "bk.editSearch": "Edit search",
  "bk.departs": "Departs {time}",
  "bk.select": "Select →",
  "bk.reviewBooking": "Review booking",
  "bk.route": "Route",
  "bk.date": "Date",
  "bk.fare": "Fare",
  "bk.taxes": "Taxes",
  "bk.company": "Company",
  "bk.paymentMode": "Payment mode",
  "bk.corpAccount": "Corporate account",
  "bk.gstInvoice": "GST invoice",
  "bk.enabled": "Enabled",
  "bk.afterVerification": "After verification",
  "bk.total": "Total",
  "bk.confirmBooking": "Confirm booking",
  "bk.corpFaresNote": "Corporate fares require a one-time company verification.",
  "bk.confirmed": "Booking confirmed",
  "bk.onHold": "Booking on hold",
  "bk.blocked": "Booking blocked",
  "bk.verification": "Verification",
  "bk.bookAnother": "Book another trip",
  "bk.completeToConfirm": "Complete verification to confirm booking",
  "bk.verifyNeededAdmin":
    "Company verification is pending. Complete verification to confirm this booking — you can still review the itinerary in the meantime.",
  "bk.verifyNeededMember":
    "Company verification is pending. Please contact a workspace admin to complete verification before this booking can be confirmed.",
  "bk.backToReview": "Back to review",
  "bk.continueVerification": "Continue verification",

  // booking notes
  "note.confirmed": "Company verified — booking confirmed.",
  "note.confirmedAuthPending": "Booking confirmed. Authority confirmation still pending.",
  "note.holdAuth": "Booking on hold until authority is confirmed.",
  "note.holdDoc": "Booking on hold — a required document is pending.",
  "note.assisted": "Booking can't be auto-confirmed. Our team will assist with verification.",
  "note.blocked": "Booking blocked — company verification failed. Workspace stays active.",
  "note.holdDefault": "Complete company verification before this booking can be confirmed.",

  // kyb modal
  "kyb.confirmAuthority": "Confirm your authority",
  "kyb.completeVerification": "Complete company verification",
  "kyb.repIntro": "We identified your company. Confirm how you're authorised to set up travel for this company.",
  "kyb.confirmIntro": "Confirm your company and verify with a single business identifier.",
  "kyb.company": "Company",
  "kyb.legalName": "Legal name",
  "kyb.businessType": "Business type",
  "kyb.country": "Country",
  "kyb.useInstead": "← Use {label} instead",
  "kyb.fallbackPrompt": "{primary} unavailable? Proceed with {fallback}",
  "kyb.verifyCompany": "Verify company",
  "kyb.doLater": "I'll do this later",
  "kyb.companyVerified": "Company verified",
  "kyb.confirmedFor": "{label} confirmed for {company}",
  "kyb.verifiedDetails": "Verified details",
  "kyb.identifier": "Identifier",
  "kyb.signatoryName": "Full name of person signing up",
  "kyb.signatoryNamePh": "e.g. Ahad Nadeem",
  "kyb.signatoryNameHelp": "Use the legal name of the person who will confirm authority for this workspace.",
  "kyb.registeringAs": "Are you registering as a",
  "kyb.declaration":
    "I declare that I am authorised to access this portal on behalf of {company}, that the information provided is true and accurate, and that I will use this access solely for legitimate business purposes in line with company policy.",
  "kyb.continueAuthority": "Continue to confirm authority →",
  "kyb.continueArrow": "Continue →",
  "kyb.chooseAuthority": "Choose how to confirm authority",
  "kyb.boardResolution": "Board Resolution",
  "kyb.boardResolutionHelp": "For Authorised Signatories — upload an authorising document.",
  "kyb.or": "OR",
  "kyb.uploadBoard": "Click to upload Board Resolution",
  "kyb.fileTypes": "PDF, JPG or PNG",
  "kyb.confirmAuthorityBtn": "Confirm authority",
  "kyb.provideLater": "I'll provide this later",

  // console dock
  "console.hide": "Hide",
  "console.show": "See how verification works",
  "console.title": "Backend console",
  "console.events": "{n} events",
  "console.desc":
    "Domain registry is a mock enrichment layer for demo purposes. Company verification runs once an identifier is provided.",
  "console.noEvents": "No events yet.",

  // common
  "common.edit": "Edit",
  "common.cancel": "Cancel",

  // seniority
  "empm.seniority": "Seniority band",
  "empm.seniorityHelp": "Used by approval rules.",

  // booking — trip type, cabin, travellers, multi-city
  "tab.admin": "Admin",
  "bk.trip.oneway": "One-way",
  "bk.trip.round": "Round-trip",
  "bk.trip.multi": "Multi-city",
  "bk.tripType": "Trip type",
  "bk.departDate": "Depart date",
  "bk.returnDate": "Return date",
  "bk.leg": "Flight {n}",
  "bk.addLeg": "+ Add another city",
  "bk.removeLeg": "Remove",
  "bk.cabin": "Cabin class",
  "bk.travellers": "Travellers",
  "bk.travellerCount": "travellers (admins can book for the team)",
  "bk.assignTravellers": "Assign travellers",
  "bk.seat": "Seat {n}",
  "bk.legsPax": "{legs} flight(s) · {pax} traveller(s)",
  "bk.perPersonLeg": "per person / flight",

  // admin console
  "admin.title": "Admin console",
  "admin.sub": "Configure connections, regions and travel policy for {company}.",
  "admin.tab.connections": "Connections & data",
  "admin.tab.regions": "Regions & currency",
  "admin.connectionsDesc": "Sync employees from your HRMS, an SFTP drop or a CSV upload.",
  "admin.supported": "Supported sources",
  "admin.connectHint": "This is a prototype — connections import sample data only; no live credentials are used.",
  "admin.regionNote": "The operating country sets the currency and number format used across policies, booking and approvals.",
  "admin.regionCountry": "Operating country",
  "admin.regionCurrency": "Currency",
  "admin.preview": "Format preview",

  // approval rules
  "appr.rulesTitle": "Approval rules",
  "appr.rulesDesc": "Rules are checked top to bottom; the first match decides the outcome.",
  "appr.addRule": "Add custom rule",
  "appr.untitled": "Untitled rule",
  "appr.conflictTag": "conflict",
  "appr.outcome.auto": "Auto-approve",
  "appr.outcome.require": "Require approver",
  "appr.defaultTitle": "Default fallback",
  "appr.newRule": "New approval rule",
  "appr.editRule": "Edit approval rule",
  "appr.ruleName": "Rule name",
  "appr.ruleNamePh": "e.g. Domestic economy auto-approve",
  "appr.when": "When all of these match",
  "appr.then": "Then",
  "appr.condAmountMin": "Min amount",
  "appr.condAmountMax": "Max amount",
  "appr.noCap": "No cap",
  "appr.condCabin": "Cabin class",
  "appr.anyCabin": "Any cabin",
  "appr.condRegion": "Route",
  "appr.anyRegion": "Any route",
  "appr.domestic": "Domestic",
  "appr.intl": "International",
  "appr.condSeniority": "Traveller seniority is at least",
  "appr.anySeniority": "Any seniority",
  "appr.atLeast": "{band} & up",
  "appr.outcome": "Outcome",
  "appr.approver": "Approver",
  "appr.save": "Save rule",
  "appr.saveAnyway": "Save anyway",
  "appr.delete": "Delete",
  "appr.noRules": "No custom rules yet. The default amount threshold below still applies.",
  "appr.anyAmount": "Any amount",
  "appr.over": "over {min}",
  "appr.upTo": "up to {max}",
  "appr.between": "{min}–{max}",
  "appr.conflictTitle": "Heads up — this rule may conflict",
  "appr.conflictBody": "It overlaps with “{name}” but resolves differently ({a} vs {b}). When trips match both, the first rule in the list wins.",
};

export type TKey = keyof typeof en;

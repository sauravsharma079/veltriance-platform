# Veltriance — gap analysis and build order

Goal: a source-to-pay platform that runs end to end on agents with minimal human touch, credible next to
Zip and Oro Labs. Written 2026-09-21 from a review of the code (≈27,500 lines, 42 pages, 122 API routes).

**How to read this.** "Built" means it exists *and* was exercised by tests against a real database.
"Partial" means it exists but has a stated limit. The comparison with Zip and Oro is from general public
knowledge of what those products do; it is not from hands-on use of their current versions, so treat the
competitor column as a directional checklist, not a verified feature matrix.

## 1. What exists today

| Stage | State | Notes |
|---|---|---|
| Intake | Built (chat) | Aria chat intake with catalog/policy prompts. No email, Slack or Teams intake. |
| Approvals | Built | Rule-based routing by amount/category/department, parallel groups, ANY/ALL, **email one-click approval, reminders, escalation, out-of-office delegation, requester notified of outcome**, atomic decisions (Tranche 1). |
| Sourcing | Built (RFQ) | Events, supplier bid portal, deterministic scoring, award to contract or PO. No auctions, no multi-round, no weighted RFP scoring. |
| Supplier onboarding & risk | Built | Vendor self-service portal, checklist, country-specific validation, deterministic risk score, onboarding agent. No sanctions/adverse-media screening (needs a paid data provider). |
| Contracts | Built | Drafting, clause playbook, negotiation, link-based e-signature, repository, renewal alerts. Native signature only (no DocuSign). No obligation tracking. |
| Purchase orders | Built | Auto-raised on approval, email/cXML/manual transmission, change orders. One PO per requisition (schema constraint), so multi-supplier requisitions are not split. |
| Receiving & invoices | Built | Goods receipt, three-way match with tolerances, auto-approve clean matches, exceptions with override. Invoices are keyed in by staff: no supplier submission, no OCR, no credit notes, no payment run. |
| Agents | Built (batch) | Document chaser, contract negotiator, renewal watch, RFQ assistant, bid evaluator, onboarding agent; approval inbox and autonomy levels. Run manually or daily — **not event-driven**. |
| Licensing | Built | Per-module licences, seat limits, operator API. No billing, no vendor admin UI. |

## 2. Gaps, by what blocks a sale

### A. Blockers for enterprise buyers (security and quality)
- **No automated tests and no CI.** Every claim above rests on ad-hoc scripts run by hand.
- **No SSO/SAML, SCIM or MFA.** Login is password or Google only.
- **Bank/tax details stored in plain text.** No field-level encryption.
- **No rate limiting** on any endpoint, including the public token pages.
- **No security headers**, no error monitoring, no documented backup/restore or DR plan.
- **Audit log is not tamper-evident or exportable.**
- Free-tier LLMs cap out at roughly 200k tokens a day per provider; production needs a paid key.

### B. What makes it "touchless" (agents end to end)
- **No orchestrator.** Agents don't react to events. Approval → sourcing decision → PO → receipt → invoice should be one
  automatic chain; today it is separate steps with humans (or a daily cron) between them.
- **No budgets or commitments.** A requisition can't be checked against remaining budget; there is no encumbrance.
- **No policy engine** beyond amount thresholds (e.g. "over X with no contract → competitive quote", preferred-supplier and
  contract-price enforcement, split-order detection).
- **No auto-sourcing trigger**, no "cheapest compliant option" recommendation at intake.
- **Intake is one channel.** Zip and Oro meet people in email and Slack/Teams.
- Agents are not evaluated (no regression suite for prompts), and there is no usage or cost metering per tenant.

### C. Breadth versus Zip/Oro
- **Analytics:** only a basic overview. No spend analysis, savings tracking, supplier performance, cycle-time or
  compliance reports; no scheduled exports.
- **Integrations:** generic outbound ERP push only. No SAP/Oracle/NetSuite/Dynamics/Tally/Zoho/QuickBooks connectors, no
  HRIS or directory sync, no webhooks/event stream.
- **Supplier network:** single-use token links rather than a persistent supplier portal (POs, acknowledgements, ASN,
  invoices, catalogues, payment status).
- **Invoices:** OCR/e-invoice ingestion, credit notes, prepayments, payment runs and bank/ERP payment status.
- **Contracts:** DocuSign/Adobe Sign, PDF export, obligation and SLA tracking, PO-against-contract compliance.
- **No-code workflow builder** for approval and routing logic beyond the rule table.
- **Commercial:** self-serve signup and trial, billing/metering, a vendor-side admin console (licences are set by API).

## 3. Build order

| # | Tranche | Why now |
|---|---|---|
| 1 | **Touchless approvals** — *done* | The biggest hole in the core flow: nobody was told about an approval. |
| 2 | **Budgets + policy engine + orchestrator** | Turns separate modules into one autonomous chain and adds the controls finance asks for first. |
| 3 | **Quality and security gate** — tests, CI, rate limiting, headers, SSO/MFA, field encryption, audit export | Required before any enterprise security review. Also protects everything built since. |
| 4 | **Email intake, then Slack/Teams** | Adoption: requesters stay where they already work. |
| 5 | **Analytics and savings** | What executives buy on; needs the data from tranche 2. |
| 6 | **Integrations** — webhooks, ERP/accounting connectors, HRIS, supplier invoice portal, OCR | Largest effort; depends on customer stack. |
| 7 | **Commercial** — billing/metering, operator console, self-serve trial | Needed to sell at scale; not needed for first pilots. |

## 4. Known limits of this review
- Competitor capabilities are from general knowledge, not verified hands-on.
- LLM behaviour was tested mainly with scripted responses (free-tier quotas were exhausted during development), so
  agent quality on a production-grade model is unmeasured.
- Nothing has been load-tested; there is no performance baseline.
- Most pages were verified through their APIs and libraries, not by driving a browser.

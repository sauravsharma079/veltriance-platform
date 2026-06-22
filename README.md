# Veltriance Procurement Platform

AI-assisted intake → supplier validation → approval routing → (future) downstream
ERP requisition creation, built per the Veltriance MVP scope. Multi-tenant:
each client company gets its own subdomain and fully isolated data.

## What's built (Sprints 1–4 of the original roadmap, now multi-tenant)

- **Multi-tenancy** — every client is an `Organization` with its own subdomain
  (`acme.veltriance-platform.com`). All data — users, suppliers, requisitions —
  is scoped to an organization at the database level, enforced in every query,
  not just hidden in the UI. See "Multi-tenancy" below for the full picture.
- **User module** — email/password + Google sign-in (Supabase Auth), profile
  onboarding (department, cost center, manager, currency), four roles
  (Requestor, Approver, Procurement, Admin) with server-side route protection.
- **Supplier module** — searchable supplier master, "request new supplier"
  workflow with PENDING_APPROVAL → ACTIVE/BLOCKED status.
- **Intake module** — both a structured form and a conversational chatbot.
  The chatbot uses a **rule-based NLU agent** (`lib/intake-agent.ts`), not a
  paid LLM — see that file's header comment for the exact upgrade path once
  you're ready to wire in a real Anthropic/OpenAI key.
- **Requisition module** — drafts are created from either intake path, with
  line items and an amount-based approval workflow
  (`lib/approval-matrix.ts`): Manager → Manager+Director → Procurement+Finance.
- **Admin module** — user role management, pending supplier review.

## Multi-tenancy

**How a new client gets onboarded:** visiting the root domain (e.g.
`veltriance-platform.com`, or `localhost:3000` locally) always lands on
`/create-organization` — a form that takes a company name, a workspace URL
(the subdomain, auto-suggested from the company name), and the first user's
details. Submitting it creates the `Organization` row and that first user as
its `ADMIN` — no manual SQL step needed anymore, unlike earlier in this
project's setup. They're then directed to sign in at their new subdomain.

**How it's enforced, not just displayed:** `middleware.ts` reads the request's
`Host` header, extracts the subdomain, and forwards it downstream as a header
(`x-tenant-slug`) — middleware runs on the Edge runtime and deliberately never
touches the database directly. `lib/tenant.ts`'s `getCurrentOrganization()` is
the one place that resolves that header into an actual `Organization` row, and
every API route and Server Component in the app calls it and includes
`organizationId` in its Prisma `where` clause. `getCurrentUser()`
(`lib/supabase/server.ts`) additionally cross-checks that the logged-in user's
own `organizationId` matches the organization resolved from the current
subdomain — if a session somehow ends up on the wrong subdomain, this returns
null rather than another tenant's data.

**What changed in the schema:** every previously-globally-unique field that
should really be unique *per client* now is — `User.employeeId`,
`Supplier.code`, and `Requisition.requisitionNumber` are all
`@@unique([organizationId, ...])` instead of plain `@unique`, so each client's
requisition numbering independently starts at `REQ-2026-00001`, two different
clients can both have an employee `EMP-001`, and so on.

**Local development:** `acme.localhost:3000` resolves automatically in
Chrome and Edge — no `/etc/hosts` editing needed. Create a workspace at
`localhost:3000/create-organization`, then you'll be redirected to
`{your-slug}.localhost:3000` to actually use it.

**Going live with real client subdomains:** this requires owning a domain for
this platform (separate from veltriance.com) and configuring a wildcard DNS
record — `*.yourdomain.com` pointed at Vercel, the same kind of DNS change
made for veltriance.com's own domain, except wildcard instead of a single
record. In Vercel's project settings, add both `yourdomain.com` and
`*.yourdomain.com` as domains. Then set `NEXT_PUBLIC_ROOT_DOMAIN` in Vercel's
environment variables to `yourdomain.com`. This is a step only you can do
when you're ready to onboard a real second client, since it requires owning
and configuring an actual domain.

**Known simplification, worth knowing about:** after creating a workspace on
the root domain, you're sent to sign in again at your new subdomain rather
than being kept logged in automatically. Sharing a session across subdomains
is possible (a shared cookie domain) but it's exactly the kind of
cross-cutting auth behavior that's risky to ship without being able to test
it against a real deployed domain — so for now it's one extra, deliberate
sign-in, not a bug.

## Deliberately not built yet

- **Purchase Orders** — converting approved requisitions into POs, with
  email / cXML / manual routing to suppliers.
- **Configurable approval chains** — the matrix is still hardcoded in
  `lib/approval-matrix.ts`. Replacing it with an admin-configurable,
  condition-based rules engine (department, category, amount combinations)
  is next.
- **User invitations** — admins can change roles for existing users, but
  can't yet invite someone by email who hasn't signed up themselves.
- **Admin configuration: custom fields, lookups, chart of accounts** —
  client-specific dynamic fields, reference data management, and
  segment-based account/company-code mapping.
- **Richer Coupa-style supplier module + interactive homepage.**
- **ERP integration framework** (Coupa/SAP/Ivalua/Oracle connectors) — these
  need real API credentials from each platform, which the business doesn't
  have yet. The schema already has `erpTargetSystem` / `erpReferenceId`
  fields on `Requisition` ready for this, and a requisition lands in
  `ERP_SYNC_PENDING` status once fully approved — that's the hook point for
  the first real connector.
- **Supplier Recommendation Agent** (lowest-cost / highest-rated supplier
  suggestions) — needs supplier rating data to accumulate first.
- **Dashboards, reporting, audit logs.**
- **SSO / Microsoft Entra login** — only Google OAuth + email/password are
  wired up.

## Stack

- Next.js (App Router) + TypeScript + Tailwind — frontend and API routes in
  one app, one Vercel deployment.
- Supabase — Postgres database + authentication (free tier).
- Prisma 6 — schema and queries (`prisma/schema.prisma`). Deliberately pinned
  below Prisma 7, which restructures how connection URLs and the client are
  configured in a way that's still actively changing release to release —
  Prisma 6's simpler, stable `datasource { url, directUrl }` pattern is the
  more reliable choice for now. Ignore any "update available" prompts.
- Zod — request validation on every API route.

This intentionally diverges from the original spec's separate NestJS
backend — a single Next.js app is simpler to deploy for free and is the
same pattern already used for veltriance.com. Split out a dedicated backend
service later if/when there's a real reason to (e.g. long-running async ERP
sync jobs that don't fit a serverless request/response model).

## Local setup

See the full step-by-step setup guide provided alongside this codebase for
creating a free Supabase project, configuring Google OAuth, and deploying to
Vercel. Quick reference once you have your credentials:

```bash
npm install
cp .env.example .env   # fill in your Supabase values
npm run db:push        # syncs the Prisma schema to your Supabase database
npm run dev
```

Then open `localhost:3000` — this redirects to `/create-organization` since
the root domain has no tenant. Create your first workspace there; you'll be
the Admin automatically, no manual database step required.

If you're upgrading an existing local copy of this project from before
multi-tenancy: the schema changed (new `Organization` model, new required
`organizationId` columns, changed unique constraints), so `npm run db:push`
needs to run again. Any existing test data won't have an `organizationId` and
will conflict with the new schema — easiest path is to reset your Supabase
project's tables (Table Editor → delete the existing rows, or drop and
recreate the `public` schema via the SQL Editor) and re-push fresh, then
re-test the signup → create-organization → onboarding → intake → approval
flow from scratch under the new tenant model.


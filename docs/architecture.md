# Architecture and assumptions

## Boundaries

Next.js App Router serves a small public entry, an account screen, a demo client and an authenticated live client. React components share the same Zod domain contracts and deterministic calculations. CSS/Tailwind provides a warm, responsive interface with native dialogs, visible keyboard focus, semantic forms and print styles. Important UI strings are grouped by screen/stage; full internationalization is not installed. UI language is English; the workspace locale is available for dates, with Europe/Rome as the initial timezone.

The demo adapter writes only its namespaced local storage. Live mode fetches authorized records and never reads those keys. Persona switching exists only in the demo domain action and is rejected by live handlers. Demo products carry `synthetic: true`; the live database rejects synthetic catalog offers.

## Persistence and authorization

Relational tables: workspaces, memberships, properties, property_access, projects, reviews, catalog_items, plan_versions, approvals, invitations, assets, analysis_runs, request_limits. A property has a canonical review library with a unique fingerprint constraint; projects reuse those source identities. A project is a **typed JSON aggregate**, containing rooms, canonical measurements, retained objects, selected review/import snapshots, observations, current draft, historical version mirror, tasks, follow-up and activity events. This avoids a table for every nested field while keeping the workspace/property boundary relational and enforced by composite keys.

The server calls `auth.getUser()` and loads membership through the user's RLS-bound client. Workspace IDs, project IDs and roles from browser requests do not establish permission. Approvers receive only assigned properties and their plan offer snapshots, not the whole catalog. Operators have editing rights but no automatic approval rights. Approval requires a current explicit `property_access` grant, including for administrators.

Browser clients have read-only table access under RLS. Validated writes use a server-only service-role adapter. `commit_project` is service-only, checks the actual actor's current role/property grant again, locks the project, compares expected revision, enforces parent IDs, preserves prior immutable snapshots and inserts separate frozen plan and approval rows atomically. Shared review edits update every affected project in one SQL bundle transaction, invalidating current analyses while preserving submitted historical sources. Invitation claiming and membership edits use locked SQL functions. These functions are explicitly revoked from public, anonymous and authenticated callers. Native authenticated table writes are denied.

Service-role credentials must remain server-only. Server handlers must preserve the explicit membership checks before any privileged operation. The real deployment's Auth, PostgREST and Storage interactions remain to be validated when configured; passing embedded SQL tests is not evidence of hosted connectivity.

## Evidence and AI

SHA-256 hashes identify the exact source inputs and immutable draft content. Evidence is accepted only when its source ID is in the selected authorized project and its excerpt is an exact substring of the stored source. Distinct review IDs determine counts; operator observations are separate. Raw text is never interpreted as HTML or instructions.

Runs are persisted before a provider request, unique by project/stage/input hash. Calls are awaited. Stored complete results can be reused after a project conflict, so a conflict need not trigger another billable call. Running leases expire after two minutes; failed runs offer explicit retry. This handles normal request interruption, not exactly-once provider billing across arbitrary process crashes. The app does not promise that a provider request interrupted after billing can always be recovered.

The model proposes text and references; it does not own cost arithmetic, verification, permissions or final readiness. Candidates are filtered on known constraints before they are supplied. Parsed evidence and candidate IDs are validated again. AI errors never invoke the synthetic adapter. Manual observations and interventions work without AI.

## Costs, fit and decisions

Prices and quantities are validated, integer-based and bounded. Gross plan unit prices incorporate explicitly known catalog VAT once; other taxes and grouped delivery are explicit plan components. Fixed/percentage contingency is deterministic. Budget allowances are labeled; unknown required costs block reviewability. Width/depth and curtain-coverage checks are intentionally limited and explain their recorded inputs. Unknown facts never become a green pass.

Submitted plans snapshot scope, evidence, measurements, offers, assumptions and costs. Decision records do not confer stock, fit or delivery guarantees. Draft material edits clear the current version reference; past approvals remain historical. Task progress has separate actual costs. Product substitutions require editing the draft and a new decision.

## Known first-release limitations

- **No configured external services in this handoff.** Live code/migrations exist; hosted Auth, recovery mail, uploads, persistence and live provider connectivity have not been exercised. The requested working mode for this handoff is the demo.
- Delivery costs are explicitly grouped and labeled at plan level; the app does not calculate retailer-specific shipping tariffs. Plan allowances can cover installation. It does not place orders or reserve products.
- The first catalog CSV importer uses fixed documented columns, unlike the review import's interactive mapping. Similar catalog offers can be separately entered. No supplier scraping or trusted supplier adapter is present.
- Photos are stored and shown but no image understanding, scale drawing, annotation editor or photorealistic preview is included. Additional fit notes supplement the recorded checks; they do not override unknown or failed dimensions.
- Review deduplication does not perform semantic similarity; near-duplicate warnings are conservative normalized-text equality checks with different identity/date metadata.
- Locale settings govern stored workspace/date preferences; common EUR formatting currently uses English EUR presentation throughout. Full interface translation and exhaustive locale formatting remain future work.
- A browser's local storage is not an account/database backup. Demo imports/photos should be synthetic only. Draft form input is retained on handled submission failures; browser navigation warns on dirty forms. Not every possible in-app route change has an autosaved draft.
- Current policies and functional browser tests are present. A full manual screen-reader audit, penetration test and hosted operational certification are not claimed.

Explicitly deferred: billing/checkouts, subscriptions, scraping, automatic purchases, marketplaces, channel integrations, email campaigns, dynamic pricing, full 3D and native mobile apps.

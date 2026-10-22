# Host Upgrade Planner

Turn guest feedback into practical property improvements.

A Next.js application for small short-term-rental portfolios. The five project stages are **Brief → Evidence → Options → Approval → Completion**. The interface is English, handles Italian and English review text, uses EUR integer cents and stores measurement values in millimetres.

## Run the demo

Requires Node.js **24 LTS** and npm. Exact dependency versions are recorded in `package-lock.json`.

```sh
cd /workspace/project
npm ci --cache /workspace/.npm
npm run dev
```

Open the application's `/demo` route in your local browser. The public entry is `/`. The demo requires no account, API key, paid service or network service. All demo reviews, offers, prices and members are synthetic. No real retailer links or inventory are fabricated.

The demo is stored under `host-upgrade-planner:demo:v1` in browser local storage. Photo data has a separate key in the same demo namespace. **Reset demo** clears changes and demo photos. It does not affect live services. A different browser has its own demo. Export work before clearing browser storage.

The initial studio has 40 stable reviews (`DEMO-R01`–`DEMO-R40`), with **8** light mentions, **5** bedside charging mentions and **3** luggage mentions, including intentional overlaps. Counts are computed from validated evidence IDs. The budget is **€700**, with **€500 allocated** and **€200 remaining**. Initial offers are explicitly unverified allowances with missing fit/delivery information. Approval is possible for this estimated plan; purchasing remains blocked.

Try this journey:

1. Open the studio project. Inspect reviews and evidence; import pasted reviews or a CSV using the supplied template and mapping preview.
2. Edit interventions and costs. Record confirmed measurements in Brief. Catalog facts are edited in Product catalog.
3. Submit the reviewable plan in Approval. The operator cannot decide.
4. Switch the isolated demo persona to Sofia or Luca and record a decision for that revision.
5. Update a pre-purchase verification task in Completion, recording actual expenditure independently of the estimate.
6. Change the budget or scope: the current draft needs approval again; the earlier decision remains in history.
7. Download JSON/CSV or use Print / Save as PDF on the selected revision.

## Live setup

Live mode is intentionally separate at `/app`. With no configuration it shows a setup state, with a link to the separate demo. A real empty workspace receives no synthetic records.

No external project was provisioned or published during implementation. The user chose demo plus live preparation; connecting real services remains a deployment step.

1. Create or select a Supabase project. Apply `supabase/migrations/202610210001_initial.sql` through its SQL editor or your migration process. It creates schema, constraints, indexes, policies, privileged transactions and the private `property-private` storage bucket.
2. Copy `.env.example` to the ignored `.env.local` and populate the Supabase URL, publishable key, **server-only** service-role key, and `APP_ORIGIN`. The service-role key is required by the authenticated server adapter for validated transactional writes, invitations and private file cleanup. Never expose it in `NEXT_PUBLIC_*` variables.
3. Enable email/password authentication. Configure your site's origin and allow authentication redirect URLs at `/auth/callback` and `/auth/callback?recovery=1`. Configure a mail provider for actual confirmation/recovery emails in production. The application creates invitation links for manual copying; it does not send invitation emails.
4. Restart the development server. Public Supabase variables are compiled into the browser bundle: set them before a production build and rebuild when they change.
5. Create and confirm an account at `/auth`, sign in, create a workspace, add an empty property and a project. An administrator grants property-specific approval rights in settings; administrator/operator status alone never grants decision rights. Create email-bound, expiring single-use invitations only when you intend to share a workspace.
6. Configure AI optionally. Without AI credentials, review import, observations, manual plans, budgets, approvals and task tracking remain usable.

Use a dedicated environment for first live verification. Run the real integration tests described below against a **disposable local Supabase instance**, then test your deployed Auth redirect and private upload flow with authorized synthetic data. The embedded PostgreSQL tests do not prove hosted Supabase Auth, Storage or deployment connectivity.

## AI configuration

The server uses the official OpenAI SDK's Responses API with `zodTextFormat`, bounded strict structured output and post-parse evidence/catalog validation. The stages are issue extraction, intervention proposals and explanations of server-filtered catalog candidates.

Set `OPENAI_API_KEY` server-side and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`, a structured-text model). No vision capability is required or claimed. Review data is submitted only after an editor requests analysis. Calls use `store: false`; consult your provider's policies for its actual retention behavior.

Some cloud environment editors reserve variable names beginning with `OPENAI_`. In that environment use the supported aliases **`HUP_AI_KEY`** and **`HUP_AI_MODEL`** instead; keep key values in secure settings, never chat or this repository. The key must be allowed for `api.openai.com`. Supabase HTTPS access must be allowed for your exact project's hostname. No network allowlist has been broadened automatically.

Input text is limited to 100,000 serialized characters per AI request; output to 7,000 tokens. Request timeout is 45 seconds with at most one SDK retry; the route limit is 60 seconds. Per-user AI limit is three requests/minute. Runs are persisted by project/stage/input hash. Completed results are reused, concurrent running requests are refused and failed/expired runs can be explicitly retried. Every provider request is awaited; no background in-memory job is relied on. A request interrupted by deployment may incur provider work without a saved result: inspect the persisted run before retrying. An operator can always continue manually.

## Rules you can inspect

- `lib/model.ts`: shared runtime contracts. `lib/domain.ts`: money, source validation, compatibility, permissions, versioning, task and export rules. `lib/demo.ts`: the isolated synthetic fixture.
- Money uses integer cents. Unknown required amounts are `null`, not zero. Unit plan prices include known VAT; catalog prices with excluded VAT add their explicitly recorded per-unit tax once. The plan's additional-tax component is for other explicit taxes, not VAT already in unit prices. Shared shipping must be grouped once in the project's delivery component and documented in cost assumptions.
- Contingency is a fixed amount or basis points of the **item subtotal + delivery + installation + other tax − discount** subtotal, rounded to the nearest cent. A budget change is an explicit saved action.
- Reviewability requires known amounts/explicit allowances, a nonnegative budget balance, current reviewed evidence and no known failed selected fit check. Unknown dimensions remain visible conditions. Reviewability is different from purchase readiness.
- Purchase readiness additionally requires the current approved version, matching quoted gross unit costs, current human-verified price/stock/delivery information, in-stock offers, passed recorded checks and confirmed target-date delivery feasibility. Material catalog facts that differ from the frozen offer require a new plan revision.
- Initial checks: curtain width covers recorded window-opening width; bedside/storage width/depth fit within confirmed available dimensions. A manual note cannot hide a failed or missing deterministic check. Passing these limited checks does not certify mounting, electrical work, structural conditions or full installation compatibility.
- Verification freshness defaults: seven days for price; 24 hours for stock/delivery. These are conservative application policies, not retailer guarantees. A URL alone never verifies an offer. The server never fetches arbitrary catalog URLs.
- Submitted versions freeze draft, costs, budget, evidence, measurements, observations and offer snapshots. Decisions identify an actual actor and exact version. Material draft edits clear current approval without changing historical decisions. The SQL transaction checks project revision and preserves immutable snapshots.
- Tasks reference an approved revision. Recorded actual expenditure does not rewrite that estimate. Verification/operational tasks can proceed while buying is blocked. External assignees are names only, without accounts or notifications.
- Baseline and follow-up use distinct reviews and explicit dates. No data is displayed honestly; small samples stay labeled. There is no causal or revenue claim.
- Exports use the selected saved revision (or an unmistakable current draft), contain source references and unresolved conditions and are authorized in live mode. CSV cells are protected against spreadsheet formula injection. Print uses the browser's real PDF/print flow; there is no public report URL.

## Import and upload limits

Reviews: CSV or one pasted review per line, up to **500 rows/import**, **6,000 characters/review**, **3 MB/CSV**. CSV mapping and validation precede explicit confirmation; valid rows survive rejected rows. The shared property library reuses canonical source identities across projects and synchronizes edits, invalidating affected analyses. Duplicate external IDs are keyed by property/source; other rows use a normalized property/source/date/text fingerprint. Ambiguous similar text with different identities is flagged and retained. Source text and import IDs remain stored; editing or excluding evidence invalidates current analysis. Projects can reuse reviews with the Use property review library action.

Catalog CSV fields are listed in the downloadable template: name, retailer, SKU, HTTPS URL, category, dimensions in mm, price in EUR, tax treatment, delivery area. Maximum 500 rows/3 MB. Validated offers are explicitly confirmed before import and remain unverified. Re-importing catalog CSV creates offers; catalog import is not a supplier synchronization service.

Private images: JPEG, PNG, WebP; 10 MB in live mode with signature and MIME checks, 1 MB in browser demo. Live signed URLs expire after 120 seconds; Refresh private photos renews them. Metadata insertion failures request cleanup of the just-uploaded file. Deleting a property/project removes its private assets before deleting associated database records. Shared property reviews remain in the property library when only a project is deleted; deleting the property removes the library too. For operational recovery, compare storage paths with `assets` metadata and remove confirmed orphans through an authorized administrator process; no public cleanup endpoint exists.

## Validation commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
# Install a Playwright Chromium runtime, or use an already installed Chromium:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
# With Playwright's own installed browser, simply: npm run test:e2e
```

`npm test` includes domain, mocked-provider and **actual PostgreSQL engine** tests using PGlite. The SQL tests apply the application migration, with lightweight Auth/Storage relation stubs; only the optional `CREATE EXTENSION pgcrypto` statement is omitted because UUID generation is part of core PostgreSQL. They exercise RLS, composite foreign keys, restricted writes, concurrency and invitation claiming. These are distinct from real Supabase integration tests.

`tests/live.integration.test.ts` runs only when all `TEST_SUPABASE_*` variables are present, requires a disposable loopback Supabase instance, creates synthetic test accounts through its admin API and cleans them up. Without configuration its four checks are **skipped**, not passed. No live provider smoke call has been made.

See `docs/test-results.md`, `docs/feature-status.md` and `docs/architecture.md` for the verified scope and remaining limitations.

## Production preparation

Set live configuration securely, apply the migration, configure Auth redirects/mail delivery, restrict allowed outbound hosts and run the outstanding live integration checks. Then `npm ci`, `npm run build`, `npm start`. HTTPS must terminate at your hosting platform. Review provider access, data retention, backups and recovery using your actual requirements. No deployment, billing, public publication or paid infrastructure is included or automatically performed.

# Feature status

The delivered, credential-free workflow is the synthetic demo. Live infrastructure was deliberately left unprovisioned at the user's request. “Implemented but unverified” means the code exists and is built, not that real external service behavior has passed.

| Capability | Status | Evidence / limit |
| --- | --- | --- |
| Public entry, responsive portfolio, empty/new properties/projects | Implemented and tested | Desktop/mobile browser journeys; browser persistence |
| Isolated synthetic fixture and persona roles | Implemented and tested | 40 IDs; 8/5/3 evidence counts; storage boundary tests |
| Brief, rooms, confirmed metric measurements, retained furniture | Implemented and tested at domain level | Shared schemas, fit rules, browser brief save/reload |
| Review paste / CSV mapping, validation, preview, confirmation | Implemented and tested | Domain CSV tests and browser import; idempotence within project |
| Evidence citation validation, counts, manual observations, stale analysis | Implemented and tested | Unit tests; browser evidence view |
| Cross-project shared property review library | Implemented and domain/SQL tested | Canonical identities, unique property fingerprints, synchronized edits and atomic project bundles |
| AI extraction, intervention proposals, catalog explanations | Implemented; mocked-provider tests passed | No live provider request; no photo AI |
| Manual catalog entry, CSV import, human verification, freshness | Implemented; domain and browser coverage | CSV import validates fixed columns; no supplier adapter |
| Deterministic budgets, VAT treatment, estimates, limited fit checks | Implemented and tested | Exact fixture totals; unknown cost/measurement failure tests |
| Versioned submission, explicit approval rights, decision history | Implemented and tested | Domain + real PostgreSQL policies/transactions + demo browser journey |
| Task progress, assignee labels, actual expenditure | Implemented and tested | Domain and browser tests; purchases remain blocked until ready |
| Follow-up windows and distinct-review observations | Implemented; domain tests passed | No real follow-up outcomes claimed |
| Chosen-revision print / budget CSV / JSON | Implemented and tested | Snapshot/formula tests and browser downloads/print styles |
| Live Auth, sign-up, sign-in/out, recovery | Implemented but external integration unverified | Requires configured Supabase and mail/redirect setup |
| Live persistence and workspace/property RLS | SQL implemented and tested on embedded PostgreSQL | Hosted/local Supabase PostgREST tests remain skipped |
| Live invitations and member/approval-right management | SQL implemented and tested; live UI unverified | Single-use recipient binding, property boundaries and last-admin protection tested |
| Live private storage, signed URLs and upload/cleanup | Implemented but Supabase integration unverified | Authenticated scope, size/type/signature validation; bucket policies in migration |
| Demo private photos | Implemented; manual path available | Browser-local data URLs; not a real private storage service |
| Property/project deletion | Implemented; domain coverage | Live asset cleanup requires configured Supabase |
| Type checking, lint, production build | Verified | See test-results.md |
| Paid billing, purchases, public deployment | Deliberately deferred / not performed | No checkout, charge or public publication |
| 3D, image generation, native mobile, scraping, marketplaces, channel integrations, campaigns, pricing automation | Deliberately deferred | Outside the supplied first-release scope |

Known limits and operational assumptions are described in architecture.md and README.md. Passing mocked/provider or embedded SQL tests does not establish live service readiness.

# Verification results

Verified on 22 October 2026 (Europe/Rome), Node.js 24.19.0, using the exact package-lock.json. The credential-free demo is the verified operating mode. No external accounts, paid infrastructure or public deployment were created.

| Check | Result |
| --- | --- |
| Frozen dependency reinstall: `npm ci --cache /workspace/.npm` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no errors or warnings |
| `npm test` | **65 passed**, **4 skipped**, 0 failed |
| Domain tests | 44 passed: evidence, CSV imports, shared sources, permissions, integer costs, tax/fit/readiness, immutable decisions, concurrency, tasks, follow-up, exports |
| PostgreSQL engine / migration tests | 13 passed: actual SQL/RLS execution in PGlite, parent boundaries, privileged RPC/table restrictions, concurrent revisions, invitations, uniqueness and property-scoped sources |
| Mocked OpenAI provider tests | 8 passed: missing config, refusals, malformed output, unsupported excerpts, timeout, no-issue output, catalog IDs and candidate constraints |
| Real Supabase integration suite | **4 skipped**: no disposable local Supabase URL/key/server key configured; these are not counted as passed |
| Playwright browser journeys | **4 passed**: two journeys on desktop Chromium and mobile Chromium emulation |
| `npm run build` | Passed: optimized production build, TypeScript, prerendered/dynamic route generation |
| Production `npm start` and functional HTTP checks | Passed: `/`, `/demo`, `/app` returned 200 with the expected entry/demo/setup content |
| Production browser smoke | The same four desktop/mobile journeys passed against the production server |
| Live OpenAI request | Not run; no credential configured and no billable smoke test requested |
| Hosted Supabase Auth / email recovery / storage / persistence | Not run; real project intentionally not provisioned |
| Public publication or paid deployment | Not performed |

The browser journey checks the initial counts, review import and reanalysis, the €500/€700 allocation, operator approval denial, an authorized decision on the submitted version, purchase readiness remaining blocked by missing facts, JSON/CSV downloads, print-only content, task actual expenditure, a material budget edit requiring a new decision, historical approval retention and persistence after reload. It also checks catalog entry, a newly stored property, no horizontal overflow and separation from the unconfigured live route. No uncaught page errors occurred in the core journey.

Desktop and mobile screenshots were inspected. Test-generated screenshots and traces are in the ignored `test-results/` directory; the automated screenshots include the portfolio overview and project brief. Mobile testing uses a Chromium device emulation and does not constitute a native iOS/Safari test. The print check validates actual print CSS and content; a physical printer was not used.

The SQL suite loads the actual application migration in PostgreSQL with minimal Auth/Storage relation stubs. PGlite uses core `gen_random_uuid()`; only the optional pgcrypto extension declaration is removed in that test bootstrap. This validates PostgreSQL behavior, not Supabase gateway configuration or real storage uploads. The optional real-service suite is implemented separately in tests/live.integration.test.ts.

Expected local artifacts: node_modules, .next, tsbuildinfo, test-results and the framework-generated AGENTS.md. Application source, migration, lockfile, examples and documentation are new files in the initially empty repository. No existing user source was overwritten and no secret values were saved in source or instructions.

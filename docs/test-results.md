# Verification results

## Beta workflow iteration — 22 October 2026

Verified on Node.js 24.19.0 with the unchanged lockfile.

| Check                                      | Result                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                        | Passed                                                                                                     |
| `npm run lint`                             | Passed                                                                                                     |
| `npm test`                                 | **94 passed, 4 skipped**, 0 failed                                                                         |
| Added tests                                | 12 guidance scenarios, 8 auth/helper/callback checks, 9 AI reconciliation/domain/route checks              |
| Playwright against the production server   | **18 scenarios passed** across desktop Chromium and mobile Chromium emulation                              |
| Production build                           | `npm run build -- --webpack` passed                                                                        |
| Standard Turbopack build in this workspace | Could not complete: environment prevented an internal process from binding its port; not claimed as passed |
| Live Supabase and live AI                  | Not run; no services or keys configured                                                                    |

The final full browser run passed all 18 scenarios in 8.6 seconds against the rebuilt production server. The checks cover all five non-purchase actions, quantity preservation, canceled navigation/persona changes, handled save errors, successful saves, guide navigation, recovery rendering, callback failures and the original end-to-end planning journey. The print check also verifies that the new live next-step guide is hidden, keeping exported reports tied to the selected revision. Desktop and mobile guide screenshots were inspected.

Browser runtime: Chromium 153.0.8010.0 supplied temporarily through `@sparticuz/chromium`, selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; it was not added to the app's dependencies. The standard Playwright Chromium archive download was unavailable in this environment. Mobile is Chromium emulation, not a Safari or native-device certification. The production server listened on loopback only.

## Original implementation verification

Verified on 22 October 2026 (Europe/Rome), Node.js 24.19.0, using the exact package-lock.json. The credential-free demo is the verified operating mode. No external accounts, paid infrastructure or public deployment were created.

| Check                                                         | Result                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frozen dependency reinstall: `npm ci --cache /workspace/.npm` | Passed                                                                                                                                                                         |
| `npm run typecheck`                                           | Passed                                                                                                                                                                         |
| `npm run lint`                                                | Passed, no errors or warnings                                                                                                                                                  |
| `npm test`                                                    | **65 passed**, **4 skipped**, 0 failed                                                                                                                                         |
| Domain tests                                                  | 44 passed: evidence, CSV imports, shared sources, permissions, integer costs, tax/fit/readiness, immutable decisions, concurrency, tasks, follow-up, exports                   |
| PostgreSQL engine / migration tests                           | 13 passed: actual SQL/RLS execution in PGlite, parent boundaries, privileged RPC/table restrictions, concurrent revisions, invitations, uniqueness and property-scoped sources |
| Mocked OpenAI provider tests                                  | 8 passed: missing config, refusals, malformed output, unsupported excerpts, timeout, no-issue output, catalog IDs and candidate constraints                                    |
| Real Supabase integration suite                               | **4 skipped**: no disposable local Supabase URL/key/server key configured; these are not counted as passed                                                                     |
| Playwright browser journeys                                   | **4 passed**: two journeys on desktop Chromium and mobile Chromium emulation                                                                                                   |
| `npm run build`                                               | Passed: optimized production build, TypeScript, prerendered/dynamic route generation                                                                                           |
| Production `npm start` and functional HTTP checks             | Passed: `/`, `/demo`, `/app` returned 200 with the expected entry/demo/setup content                                                                                           |
| Production browser smoke                                      | The same four desktop/mobile journeys passed against the production server                                                                                                     |
| Live OpenAI request                                           | Not run; no credential configured and no billable smoke test requested                                                                                                         |
| Hosted Supabase Auth / email recovery / storage / persistence | Not run; real project intentionally not provisioned                                                                                                                            |
| Public publication or paid deployment                         | Not performed                                                                                                                                                                  |

The browser journey checks the initial counts, review import and reanalysis, the €500/€700 allocation, operator approval denial, an authorized decision on the submitted version, purchase readiness remaining blocked by missing facts, JSON/CSV downloads, print-only content, task actual expenditure, a material budget edit requiring a new decision, historical approval retention and persistence after reload. It also checks catalog entry, a newly stored property, no horizontal overflow and separation from the unconfigured live route. No uncaught page errors occurred in the core journey.

Desktop and mobile screenshots were inspected. Test-generated screenshots and traces are in the ignored `test-results/` directory; the automated screenshots include the portfolio overview and project brief. Mobile testing uses a Chromium device emulation and does not constitute a native iOS/Safari test. The print check validates actual print CSS and content; a physical printer was not used.

The SQL suite loads the actual application migration in PostgreSQL with minimal Auth/Storage relation stubs. PGlite uses core `gen_random_uuid()`; only the optional pgcrypto extension declaration is removed in that test bootstrap. This validates PostgreSQL behavior, not Supabase gateway configuration or real storage uploads. The optional real-service suite is implemented separately in tests/live.integration.test.ts.

Expected local artifacts: node_modules, .next, tsbuildinfo, test-results and the framework-generated AGENTS.md. Application source, migration, lockfile, examples and documentation are new files in the initially empty repository. No existing user source was overwritten and no secret values were saved in source or instructions.

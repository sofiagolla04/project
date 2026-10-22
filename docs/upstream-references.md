# Upstream references checked

During implementation the public documentation sites were unavailable through the environment's initial network policy (proxy returned HTTP 403). The relevant official upstream repository documentation was retrieved instead through the already-allowed raw.githubusercontent.com destination:

- Next.js installation and supported toolchain: `vercel/next.js`, `docs/01-app/01-getting-started/01-installation.mdx` (canary).
- Supabase row-level security: `supabase/supabase`, `apps/docs/content/guides/database/postgres/row-level-security.mdx`.
- Supabase Storage security/access controls: `supabase/supabase`, `apps/docs/content/guides/storage/security/access-control.mdx`.
- OpenAI official JavaScript SDK README, generated Responses types and installed `openai/helpers/zod` documentation/examples for `responses.parse` and `zodTextFormat`.

Package versions were queried from the official npm registry, installed without disabling TLS/checksum verification and pinned in package-lock.json. Current exact versions can be inspected with `npm ls --depth=0`. The supported structured-text model default is configurable; no live provider compatibility smoke test was possible without credentials.

No documentation destination was added to the environment network allowlist automatically.

After `next dev` generated its AGENTS.md instructions, the installed Next.js 16.4.2 guides for route handlers, async cookies, forms and server/client boundaries were also read from node_modules/next/dist/docs/. The implementation uses awaited cookies, authenticated Route Handlers and explicit server-only provider/repository modules.

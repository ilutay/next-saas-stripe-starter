# Architecture map

**Stack:** Next 16.3.4 (App Router, Turbopack: `proxy.ts`, `await params`), Drizzle 0.45 on `@neondatabase/serverless` **Pool (WebSocket)**, Better Auth 1.7 (organization + admin + `@better-auth/stripe`), Stripe 22, Fumadocs MDX 15 (macro API, no `source.config.ts`), Tailwind v4 + shadcn on Base UI, zod 4, sonner. Single package, **pnpm**. No LLM library. No test runner.

## Commands (as they actually ran)
| What | Command | Status |
|---|---|---|
| install | `pnpm install --prefer-offline` | done by sprint-start |
| dev | `env $(grep -oE "^[A-Za-z_]+=" .env | tr -d = | sed "s/^/-u /") PORT=3000 ./node_modules/.bin/next dev -p 3000` (tmux `sprint-test:dev`) | running, `/` `/docs` `/blog` 200 |
| typecheck | `pnpm exec next typegen && pnpm typecheck` | passes (exit 0) |
| migrate | `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm db:migrate` | 0000 applied to Neon `production` |
| generate migration | `pnpm db:generate` | — |
| auth schema | `pnpm auth:generate` (rewrites `lib/db/schema/auth.ts`; never hand-edit it) | — |
| seed / test | none exist | — |

**DB var:** `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (migrations). It is **unset** in `.env` and points at Neon in prod. A local Postgres 15 is up on `/tmp:5432`, but the Neon Pool driver needs a WebSocket proxy to reach it. See Blockers.

## Module system (read AGENTS.md)
- Each module is defined in `config/features.ts` with `defineFeatures({ key: { default, dependsOn, requires, files, routes, packages } })` and wrapped in `// module:x start/end` markers for `pnpm modules:prune`.
- Each `requires` entry maps to a foundation piece in `config/foundation.ts`, and that piece's env vars must be set:
  - `database` needs `DATABASE_URL`.
  - `auth` needs `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
  - `payments` needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRO_MONTHLY_PRICE_ID`.
- Guards live in `lib/features/guard.ts`: `requireFeature(key)` goes in a layout (notFound), and `assertFeature(key)` goes at the top of every server action (throws).

## Data model (`lib/db/schema/`)
- `auth.ts` is generated and holds `user`, `session` (`activeOrganizationId`), `account`, `verification`, `organization`, `team`, `teamMember`, `member` (`organizationId`, `userId`, `role`), `invitation` and `subscription`.
- `subscription` (auth.ts:179) has `plan` (`"pro" | "business"`), **`referenceId` = organization id**, `status` (default `incomplete`), `stripeCustomerId`, `periodStart`/`periodEnd`, `cancelAtPeriodEnd` and `seats`.
- `index.ts` re-exports every schema file. Rule: **every business table carries a non-null `organizationId`**. No app tables exist yet. There is one migration, `drizzle/0000_lush_cyclops.sql`.
- **Tenancy:** `organizationId` column, with the active org taken from `session.session.activeOrganizationId`.
- **Access level:** `subscription.plan` per org. Platform admins (`user.role`, checked with `isPlatformAdmin`) count as `business` (`modules/billing/plans.ts` `adminPlan`).

## Request flow (dashboard page → data)
1. `app/(app)/layout.tsx` calls `requireFeature("auth")`, then `getActiveOrganization()`, then `filterNav`, then renders `DashboardShell`.
2. Each page calls `getActiveOrganization()` again (cached by `react.cache`), which returns `{ session, organization, member }`. It redirects to `/login` or `/onboarding` when either is missing.
3. Session helpers are in `lib/auth/session.ts`: `getSession` (line 10), `requireSession` (14), `requireRole` (21) and `getActiveOrganization` (30). Org roles are in `lib/auth/roles.ts` (`isOrganizationManager`).
4. Plan lookup:
   - `modules/billing/viewer.ts` `getBillingViewer()` calls `auth.api.listActiveSubscriptions({ query: { referenceId: orgId, customerType: "organization" } })`.
   - **No `hasPlan` helper exists.** Billing is off while Stripe env is missing.
5. Server action example: `modules/admin/preview-actions.ts`. It runs `"use server"`, then `assertFeature`, then a manual input check, then `requireSession()`, and **throws** on errors. There is no `{ok,error}` shape and no zod in actions yet.

## Content (the corpus for the brief)
- `lib/content/docs.ts` defines `docsSource = loader({ baseUrl: "/docs", source: defineDocs({ dir: "content/docs" }) })`. It has 8 pages.
- `lib/content/blog.ts` defines `blogSource` for `/blog/[slug]`. It has 6 posts, with frontmatter for authors, categories and date.
- To enumerate pages, call `xSource.getPages()` and use `page.url`, `page.data.title` and `page.data.description` (see `app/sitemap.ts:40,59`).
- **Raw text is not exposed:** `includeProcessedMarkdown` is off. Read the MDX from `content/` with fs instead, or enable the postprocess.
- `app/api/search/route.ts` already uses `createFromSource(docsSource)`, but for docs only.
- Changelog and legal are out of scope: the brief says docs and blog only.

## External services
| Service | Adapter | Key present | Fixture mode |
|---|---|---|---|
| Postgres (Neon) | `lib/db/index.ts` | no | — (blocker) |
| Better Auth / Google OAuth | `lib/auth/server.ts`, `lib/auth/client` | unknown/no | sign-in is **Google only** (magic link is Pro) |
| Stripe | `lib/stripe.ts`, `modules/billing/*` | no, billing module off | none; plan gate must read the `subscription` table directly |
| LLM | none yet | — | build `lib/ask/` with `AI_FIXTURES=1` |

## Conventions
- **Files:** kebab-case. Server logic goes in `modules/<module>/*.ts`, route UI in `app/(app)/dashboard/<x>/page.tsx`, and feature components in `components/<module>/`.
- **UI:** shadcn primitives in `components/ui`. Available: button, input, label, badge, dialog, sheet, popover, switch and sonner. Missing: textarea, card and skeleton.
- **Layout:** `PageContent`/`PageHeader` from `components/dashboard/page-header.tsx`, plus `SectionCard` and `EmptyState`. Use `buildMetadata({ title, noIndex: true })` for page metadata.
- **Forms:** a client component with `useTransition` that calls the action and reports via `toast.success/error` (`components/dashboard/settings/general-settings-form.tsx`).
- **Nav:** add an item to `dashboardNav` in `config/nav.ts:41` (`{ title, href, icon, feature }`), then extend the `NavIcon` union and `components/dashboard/nav-icons.ts`.
- **Upgrade CTA:** reuse `components/billing/upgrade-button.tsx` / `plan-cta.tsx`.

## The 5 files that matter for the brief
1. `lib/auth/session.ts`: `getActiveOrganization()` is the only sanctioned source of the org id.
2. `lib/db/schema/index.ts` and `auth.ts:179` (`subscription`): the history table goes beside them, and the plan comes from `subscription.referenceId = orgId`.
3. `modules/billing/viewer.ts` + `plans.ts`: the existing plan lookup to wrap into a `getOrgPlan(orgId)` gate.
4. `lib/content/docs.ts` + `blog.ts`: corpus enumeration and citation URLs.
5. `config/features.ts` + `config/nav.ts`: register an `ask` module (dependsOn `auth`) and its sidebar item.

## Where the feature goes
- **Module:** add `ask` in `config/features.ts` with `dependsOn: ["auth"]` and `files: ["app/(app)/dashboard/ask", "components/ask", "modules/ask", "lib/db/schema/ask.ts"]`.
- **Table:** `lib/db/schema/ask.ts` defines `askQuery` with `id`, `organizationId` (non-null, indexed), `userId`, `question`, `answer`, `citations` (jsonb `{title,url}[]`), `plan` and `createdAt`. Export it from `index.ts`, then run `pnpm db:generate`.
- **Adapter:** `modules/ask/engine.ts` exposes one interface, `answer(question, corpus)`, which returns `{ answer, citations }`.
  - `AI_FIXTURES=1` or no key: keyword retrieval plus a templated answer with deterministic citations.
  - Otherwise: an LLM call over the top-k chunks.
- **Corpus:** `modules/ask/corpus.ts` reads `getPages()` from both sources, joins them with the raw MDX from fs, and chunks by heading.
- **Gate:** `modules/ask/plan.ts` `getOrgPlan(orgId)` reads `subscription` where `referenceId = orgId` and `status in (active, trialing)`, with platform admins counting as business.
- **Action:** `modules/ask/actions.ts` `askQuestion(input)` runs `assertFeature("ask")`, then zod, then `getActiveOrganization()` (the session re-check), then the plan gate, then the engine, then inserts into `askQuery` scoped by org.
- **Page:** `app/(app)/dashboard/ask/page.tsx` (server) contains the ask box, an upgrade prompt on free plans, and history from `askQuery where organizationId = org.id order by createdAt desc`. Client parts go in `components/ask/`.

## Blockers / gotchas
- **Auth is live:** Google sign-in works locally. The hosted Better Auth dashboard is connected through `dash()` from `@better-auth/infra` and needs `BETTER_AUTH_API_KEY` in `.env`. It reaches the app through an ngrok tunnel to :3000, and the free ngrok URL changes on every restart.
- **The shell holds a stale, mostly empty copy of every `.env` key** (`DATABASE_URL`, `BETTER_AUTH_SECRET`, …). `@next/env` never overrides an existing var, so start the dev server with the command above, which unsets them all. `@next/env` never overrides an existing var, so `.env` is ignored. Prefix commands, and the dev server, with `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED`.
- **Neon:** linked to project `bold-lab-08594161`, branch `production` (`.neon`, `neon.ts`). Self-managed Better Auth is kept; Neon Managed Auth is not used.
- ~~No database~~ (fixed: Neon linked). Previously `DATABASE_URL` was unset, so the auth module is off, and `/dashboard`, `/login` and `/pricing` return 404.
  - Neon's Pool driver can't reach plain local Postgres without a wsproxy. Fixes: use a Neon branch URL, or run local Postgres plus `ghcr.io/timowilhelm/local-neon-http-proxy` with `neonConfig` overrides. Either is a decision for the user.
- **Sign-in is Google only.** A local demo needs Google OAuth creds, or a dev-only session seeding path.
- **Stripe is unset,** so billing is off. The plan gate must read the `subscription` table directly, and the demo needs a seeded `subscription` row (`plan='pro', status='active', referenceId=<orgId>`).
- `next dev` re-writes the `nextjs-agent-rules` block in `AGENTS.md`. Commit it rather than fight it.
- The orientation session was denied reading `.env` values. Only `sprint-start`'s note that `DATABASE_URL` is unset is known.

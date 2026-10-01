@AGENTS.md

# Project notes for Claude
Read `ARCHITECTURE-MAP.md` first.

## Commands
- Use pnpm only (`pnpm-lock.yaml`).
- Dev server: `PORT=3000 ./node_modules/.bin/next dev -p 3000`. It already runs in tmux window `dev`.
- Before calling anything done, run `pnpm exec next typegen && pnpm typecheck`, then curl the page you touched.
- Database: change `lib/db/schema/*.ts`, then run `pnpm db:generate && pnpm db:migrate`. Never hand-edit `lib/db/schema/auth.ts`; regenerate it with `pnpm auth:generate`.
- There is no test runner and no seed script.

## Rules
- **Tenancy:** every business table has a non-null, indexed `organizationId`. Get the org only from `getActiveOrganization()` (`lib/auth/session.ts`) inside the page or action, and never from a client-supplied id.
- **Server actions:** start with `"use server"`, then call `assertFeature("<module>")`, then validate with zod, then call `getActiveOrganization()` (this is the session re-check), then filter every query by `organizationId`. Layouts call `requireFeature`.
- **Plan:** read from `subscription` where `referenceId = orgId` and `status` is active or trialing. Platform admins count as `business`. Billing is off without Stripe env, so do not depend on `auth.api.listActiveSubscriptions` working.
- **Modules:** a new feature is a module in `config/features.ts` with `files`/`routes`, and code in shared files gets `// module:<key>` markers (see AGENTS.md).
- **UI:**
  - Use shadcn components from `components/ui`, plus `PageContent`/`PageHeader`/`SectionCard`/`EmptyState` from `components/dashboard`.
  - Forms are client components that use `useTransition` and report through a sonner `toast`.
  - Add the sidebar item in `config/nav.ts` and its icon in `components/dashboard/nav-icons.ts`.
- **File layout:** kebab-case file names. Server logic goes in `modules/<key>/`, components in `components/<key>/`.

## Fixture mode
- `AI_FIXTURES=1`, or a missing LLM key, switches the ask engine (`modules/ask/engine.ts`) to deterministic retrieval and a templated answer.
- There is no Stripe locally. Seed a `subscription` row to demo the paid plan.

## Sprint mode
Time-boxed build (default 120 min; T+ is shown in the status line, there are no timer alerts). These rules apply to every session in this repo and its worktrees.
- Scope: ONE vertical slice, demo-able end to end by T+60. Reuse existing models; never add a domain. Anything outside BRIEF.md's MVP row is written down as "cut", not built.
- Cadence: first commit (BRIEF.md + orientation docs) by T+15, then a commit every ~15 min with a why-message on your branch; stop new scope at T+85; stop coding at T+112; `/handover-readme` starts at T+105 no matter what.
- Environment issues get 10 min total, then fixture mode (`AI_FIXTURES=1`, `MOCK_STRIPE=1`, console email) and a README note.
- Protect the demo, not the feature list: behind at T+70 → cut the "should" items, never the running happy path or the handover note.
- Ownership: edit only the files your `### <slice>` prompt in BRIEF.md owns; contract/schema/shared changes go to `@main` as an exact diff, never made by you. Never edit `.env` or lockfiles.
- Only slice `a` runs migrations unless your DB is `<repo>_<slice>` (check the DB var in your worktree's `.env`).
- Before "done": `tsc --noEmit` (+ `next typegen` on Next ≥15) and the touched page on your `PORT` from `.env.local`. Every report starts with the current T+.
- Budget: run `/usage` at T+0 and T+60; if headroom < 30 %, `/model opus` in slice sessions.
- AI is subordinate: read every diff, run every change, keep the list of what you rejected for the README.

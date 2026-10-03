# BRIEF — Ask your docs

_Committed at T+32. Reviewer: read this first. It is the contract I built against._

## The ask (in one sentence)
As a **member of an organization** on **SaaS Starter**, I can **ask a plain-language question and get an answer grounded only in our published docs and blog, with links to the source pages**, so that **I find the answer in seconds instead of skimming 14 pages**. Answering is a paid feature, and the organization keeps a history of what was asked.

## Why this slice
The brief is a single feature with explicit must-haves: ask box, grounded answer with citations, plan gate and per-org history. So there is no menu to pick from.
- **Reuse:** the existing tenancy (`organizationId` plus `getActiveOrganization()`), the plan source (the `subscription` row with `referenceId = orgId`), and the existing content (8 docs, 6 blog posts). The only new table is the question history.
- **Fixture mode first:** the engine works in `AI_FIXTURES=1` before any LLM exists, so a clean clone demos end to end.

## Metric to claim
**Benchmark:** at least 8 of the 10 questions in `scripts/ask/questions.json` are answered with a citation to the page that actually covers them. Each answer comes in about 1 s in fixture mode, compared with roughly 3–4 minutes of browsing `/docs` and `/blog` by hand.

**Behaviour:** 0 of 3 off-topic questions get an answer that isn't grounded.

`node scripts/ask/smoke.ts` prints both numbers.

## Data model
| Table | Change | Notes |
|---|---|---|
| `ask_query` (new, `lib/db/schema/ask.ts`) | `id` text pk, `organization_id` text **not null** fk to organization (cascade) and indexed, `user_id` text fk to user (set null), `question` text, `answer` text null, `citations` jsonb `Citation[]` default `[]`, `grounded` boolean, `plan` text, `engine_mode` text, `created_at` timestamp | Every row is scoped by `organization_id`. A free-plan question is stored with `answer = null`, and the history shows it as gated. |
| `subscription` (existing, generated) | no change | The plan gate reads `plan` and `status in ('active','trialing')` where `reference_id = orgId`. Platform admins count as `business`. |

**Migration strategy:** `pnpm db:generate`, which writes `drizzle/0001_*.sql`, then `pnpm db:migrate`. The repo already uses migration files, so this keeps history reviewable. Only slice **a** runs it, against the shared Neon DB, prefixed with `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED`.

## Scope ladder
### MVP — demo-able by T+60
1. **Ask box at `/dashboard/ask`** for any member, linked from the sidebar. Files: `app/(app)/dashboard/ask/page.tsx`, `components/ask/ask-form.tsx`.
2. **Grounded answer with citations** on a paid org. Each citation shows the title and snippet and links to `/docs/...#anchor` or `/blog/<slug>`. An off-topic question returns "not covered" with no citations. Files: `modules/ask/engine/*`, `modules/ask/corpus.ts`, `components/ask/answer-card.tsx`.
3. **Plan gate:** a free org still sees the ask box. Submitting returns an upgrade prompt instead of an answer, and the server action enforces this, not just the UI. Files: `modules/ask/plan.ts`, `modules/ask/actions.ts`, `components/ask/upgrade-prompt.tsx`.
4. **Per-organization history:** the last 20 questions, with asker and time, newest first. A gated question shows the label "upgrade to see the answer". Switching org shows only that org's history. Files: `modules/ask/queries.ts`, `components/ask/history-list.tsx`.

### Should — T+60–85 only if MVP is green
1. **LLM engine** (`modules/ask/engine/llm.ts`): Anthropic Messages API via `fetch`, so no new dependency. It answers only from the top 5 passages and must cite them, returning `grounded:false` when they don't cover the question. It is selected when `ANTHROPIC_API_KEY` is set and `AI_FIXTURES` is not `1`.
2. Expand a history item to show its stored answer and citations again, without re-asking.
3. All four UI states: a pending state while answering, an empty history, an error toast, and the success card.

### Stretch — README "what's next" unless everything is green at T+85
1. Streaming answers.
2. Per-org content: tag MDX with `organizationId` once orgs can publish their own pages. Today every org publishes the same starter content.
3. Feedback on answers (helpful or not), plus a usage count shown next to the plan.
4. Embedding retrieval (pgvector on Neon) in place of keyword scoring.

### Explicitly cut (and why)
- **Real Stripe checkout from the upgrade prompt:** billing is off locally (no webhook secret or price IDs). The prompt links to `/dashboard/billing` when billing is on, and the demo flips the plan with a seed script.
- **Vector DB or embeddings:** 14 short pages fit keyword retrieval, and embeddings would add a second external key.
- **Chat with follow-ups:** the brief asks for questions and answers, not conversations.
- **Changelog and legal pages in the corpus:** the brief says docs and blog only.
- **Rate limiting and usage quotas:** not in the must-haves. The plan gate is the only limit.
- **Vitest or Playwright setup:** there is no test runner, and adding one costs about 15 minutes. A Node smoke script gives the same signal.
- **Neon Managed Auth or other auth changes:** auth already works.
- **Admin view of all orgs' questions:** it crosses tenants and is not asked for.

## Demo script (≤3 min)
Main checkout: the dev server is in tmux `sprint-test:dev` at `http://localhost:3000`, started with the `env -u …` command from `.claude/CLAUDE.md`. With no `ANTHROPIC_API_KEY`, the fixture engine is used.
1. Open `http://localhost:3000/login` and choose **Continue with Google**. Sign-up creates the user and a personal organization.
2. In the sidebar, click **Ask** to open `/dashboard/ask`. The page shows a **Free** badge and the ask box.
3. Ask *"How do I set up the Stripe webhook?"*. Expected: an upgrade prompt, and the question appears in history as gated.
4. Upgrade the org: `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED node scripts/ask/seed-plan.ts <your-google-email> pro`.
5. Reload the page. The badge now shows **Pro**. Ask the same question. Expected: an answer with 2–3 citations, including `/docs/stripe#…` and `/blog/stripe-billing-from-checkout-to-webhooks`.
6. Click a citation. Expected: you land on that page and section.
7. Ask *"What's the capital of France?"*. Expected: "Your docs and blog don't cover this.", with no citations.
8. In a private window, sign in with a second Google account, which gets its own personal org, and open `/dashboard/ask`. Expected: empty history and a Free badge, which shows the tenancy scoping. The UI has no way to create an org, so a second account is the cheapest proof.
9. Run `node scripts/ask/smoke.ts`. Expected: `grounded 8+/10, correct citation 8+/10, off-topic refused 3/3`.

## Work split
**Contract** (committed on main before branching; edited only by main):
- `modules/ask/contracts.ts` exports `askInputSchema`, `AskInput`, `Citation`, `ContentSource`, `AskAnswer`, `AskEngine`, `AskAccess`, `AskPlanName`, `AskHistoryItem`, `AskActionResult`, `AskActionError` and `AskPageData`.
- Two stub signatures are owned by **a**, which replaces their bodies:
  - `askQuestion(input: unknown): Promise<AskActionResult>` in `modules/ask/actions.ts`
  - `loadAskPage(): Promise<AskPageData>` in `modules/ask/queries.ts`
- Main already registered the `ask` module in `config/features.ts`, the sidebar item in `config/nav.ts` and the icon in `components/dashboard/nav-icons.ts`. No slice edits those files.

| Slice | Goal | Owns (may edit) | Reads only | DB | Done when |
|---|---|---|---|---|---|
| **a** data+server | table, plan gate, corpus, engine adapter with fixture mode, action, page loader | `lib/db/schema/ask.ts`, `lib/db/schema/index.ts` (one export line), `drizzle/**`, `modules/ask/**` except `contracts.ts` | contract, `lib/auth/**`, `lib/db/schema/auth.ts`, `lib/features/**`, `content/**` | `DATABASE_URL`: shared Neon (`production`); **only a migrates** | migration applied; `loadAskPage` returns real plan and history; `askQuestion` stores and returns cited answers in fixture mode; typecheck clean |
| **b** UI | `/dashboard/ask` page, ask form, answer card, upgrade prompt, history, all four states | `app/(app)/dashboard/ask/**`, `components/ask/**`, `components/ui/textarea.tsx` (new) | contract, stubs, `components/ui/**`, `components/dashboard/**`, `components/billing/**` | shared, read-only | the page renders for free and paid states using the stubs and then the real functions; the 4 states are present; mobile width works |
| **c** proof | plan seed script, benchmark questions, smoke script, README section | `scripts/ask/**`, `README.md` (a new `## Ask your docs` section only) | everything | shared; writes only `subscription` rows via the seed script | `seed-plan.ts` flips an org between free and pro; `smoke.ts` prints the metric; README documents the demo |

Ports are assigned by the launcher (the next free port above `KIT_BASE_PORT`) and written to each worktree's `.env.local`. Read `PORT` there and never hard-code one.

**Merge order at T+85:** a, then b, then c. Only **a** runs migrations. After pulling a's schema change, b and c need nothing extra: Drizzle has no generate step for the client.

## Risks & fallbacks
- **No LLM key:** the `AI_FIXTURES=1` fixture engine is also the default whenever `ANTHROPIC_API_KEY` is missing. It logs `[ask] engine=fixture` once at startup.
- **No Stripe:** the plan comes from the `subscription` table, and `scripts/ask/seed-plan.ts` flips it. The upgrade prompt links to billing only when the `billing` feature is on.
- **Stale shell env:** this shell exports empty `DATABASE_URL` and `BETTER_AUTH_SECRET`, which hides `.env`. If `/dashboard` returns 404 in a worktree, restart its dev server with ``env $(grep -oE "^[A-Za-z_]+=" .env | tr -d = | sed "s/^/-u /") ./node_modules/.bin/next dev -p $PORT``.
- **The shared DB is Neon `production`:** a's migration only adds a table. If it goes wrong, restore from Neon branch history (`neon branches restore`).
- **Merge conflicts:** the file owner wins, and main wins on the contract.
- **`pnpm modules:prune ask`** reports missing paths until a, b and c have each created their folders. It is expected to pass after the merge.
- **Behind at T+70:** drop the Should items. Keep the demo script and the README.

## Slice prompts

### a
You are slice **a**, "data + server: table, plan gate, corpus, engine adapter, action, page loader", of the build described in BRIEF.md. Read BRIEF.md, ARCHITECTURE-MAP.md and .claude/CLAUDE.md first.

Facts:
- **Worktree:** `$KIT_WORKTREES_DIR/sprint-test/a`, branch `feat/a`. The dev server is already running in the pane below; read `PORT` from `.env.local`. If `/dashboard` returns 404, the stale shell env is hiding `.env`. Restart the server with ``env $(grep -oE "^[A-Za-z_]+=" .env | tr -d = | sed "s/^/-u /") ./node_modules/.bin/next dev -p $PORT``.
- **DB:** `DATABASE_URL` is the shared Neon DB. **You are the only slice that migrates:** `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm db:generate && env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm db:migrate`.
- **You OWN (may edit):**
  - `lib/db/schema/ask.ts` (new)
  - `lib/db/schema/index.ts` (add only `export * from "./ask" // module:ask`)
  - `drizzle/**`
  - `modules/ask/**` except `modules/ask/contracts.ts`
- **READ-ONLY:** `modules/ask/contracts.ts`, `lib/auth/**`, `lib/db/schema/auth.ts` (generated, never edit), `lib/features/**`, `config/**`, `content/**` and everything else. If you need a change there, stop and message `@main` with the exact diff you need; do not make it yourself.
- **Contract:** `modules/ask/contracts.ts` exports `askInputSchema`, `AskInput`, `Citation`, `ContentSource`, `AskAnswer`, `AskEngine`, `AskAccess`, `AskHistoryItem`, `AskActionResult` and `AskPageData`. Keep the stub signatures exactly: `askQuestion(input: unknown): Promise<AskActionResult>` in `modules/ask/actions.ts` (a `"use server"` file) and `loadAskPage(): Promise<AskPageData>` in `modules/ask/queries.ts`. Slice b is building against them now.
- **Fixture mode:** `AI_FIXTURES=1`, or a missing `ANTHROPIC_API_KEY`, must run with no keys and no network.

What to build, in order:
1. **`lib/db/schema/ask.ts`:** the `askQuery` table per the BRIEF data model. Copy the column and index style from `lib/db/schema/auth.ts` (`member`). Then generate and migrate.
2. **`modules/ask/plan.ts`:** `getAskAccess(organizationId, userRole)` reads `subscription` with Drizzle where `referenceId = organizationId` and `status in ('active','trialing')`. `isPlatformAdmin(role)` means `business`. Do **not** use `auth.api.listActiveSubscriptions`: billing is off locally.
3. **`modules/ask/corpus.ts`:**
   - Read `content/docs/*.mdx` and `content/blog/*.mdx` from `process.cwd()` with `fs`.
   - Parse the `title:` frontmatter and strip the frontmatter, JSX tags (such as `<Callout>`) and code fences down to plain text.
   - Chunk by `##`/`###` headings, using an anchor slug of the heading text lowercased with non-alphanumerics replaced by `-`, which is how Fumadocs builds heading ids.
   - URLs: docs `index` maps to `/docs`, other docs to `/docs/<slug>`, and blog posts to `/blog/<slug>`.
   - Use **relative imports only, no `@/` and no `server-only` in `corpus.ts` and `engine/**`**. Slice c runs them with plain `node`.
4. **`modules/ask/engine/`:**
   - `index.ts` exports `getAskEngine(): AskEngine`, which picks fixture or llm and logs `[ask] engine=<mode>` once.
   - `fixture.ts` does keyword scoring: tokenize, drop stopwords, score title and heading matches higher, keep the top 3 chunks over a minimum score. Its answer is the 2–3 best sentences from those chunks, with one `Citation` per distinct page. Nothing over the threshold means `{ grounded:false, citations:[], answer:"Your docs and blog don't cover this." }`.
   - `llm.ts` is a Should item. Do it only after the MVP is green.
5. **`modules/ask/actions.ts` `askQuestion`:**
   1. `assertFeature("ask")`.
   2. `askInputSchema.safeParse`, which returns `invalid_input` on failure.
   3. `getActiveOrganization()`, the session re-check. Never take an org id from input.
   4. `getAskAccess`. If the org can't answer, insert a row with `answer:null` and return `upgrade_required`.
   5. Otherwise call the engine, insert the row, and return `{ ok:true, item }`.
   6. Wrap engine errors as `engine_failed`.
   7. Call `revalidatePath("/dashboard/ask")`.
6. **`modules/ask/queries.ts` `loadAskPage`:** `getActiveOrganization()`, then access, then the last 20 `askQuery` rows **where `organizationId = organization.id`**, joined to `user.name` and newest first.

Definition of done: the migration is applied. As a pro org, calling `askQuestion` stores and returns an answer with citations in fixture mode; as a free org, it returns `upgrade_required` and stores the question. `loadAskPage` returns only the active org's history. `pnpm exec next typegen && pnpm typecheck` is clean.

Working rules:
- Do the MVP items in order. After each one, run `tsc --noEmit` and hit the page or endpoint on your port (curl or browser) before moving on.
- Commit every ~15 minutes with a why-message on your branch.
- Follow the repo's existing patterns: find the analogous file first.
- Scope every query by the tenant id, and re-check auth in every action.
- When an MVP item is done, tell me in 3 lines what works and how to see it, then continue.

Start by restating your owned files and definition of done in 5 lines.

### b
You are slice **b**, "UI: the /dashboard/ask page with ask box, answer card, upgrade prompt and history", of the build described in BRIEF.md. Read BRIEF.md, ARCHITECTURE-MAP.md and .claude/CLAUDE.md first.

Facts:
- **Worktree:** `$KIT_WORKTREES_DIR/sprint-test/b`, branch `feat/b`. The dev server is already running in the pane below; read `PORT` from `.env.local`. If `/dashboard` returns 404, restart it with ``env $(grep -oE "^[A-Za-z_]+=" .env | tr -d = | sed "s/^/-u /") ./node_modules/.bin/next dev -p $PORT``.
- **DB:** `DATABASE_URL` is the shared Neon DB. You **never migrate** and never write SQL.
- **You OWN (may edit):** `app/(app)/dashboard/ask/**`, `components/ask/**`, and `components/ui/textarea.tsx` (new; copy the style of `components/ui/input.tsx`).
- **READ-ONLY:** `modules/ask/**` (the contract plus a's stubs), `components/ui/**` except `textarea.tsx`, `components/dashboard/**`, `components/billing/**`, `config/**` and `lib/**`. The sidebar item and icon already exist. If you need a change elsewhere, stop and message `@main` with the exact diff; do not make it yourself.
- **Contract:**
  - `modules/ask/contracts.ts` gives you the types `AskPageData`, `AskHistoryItem`, `Citation`, `AskActionResult` and `AskAccess`, plus `askInputSchema` and `ASK_QUESTION_MAX` for client-side limits.
  - Server: `loadAskPage()` from `@/modules/ask/queries` (called in the page).
  - Action: `askQuestion(input)` from `@/modules/ask/actions` (called from the client form).
  - Both are stubs until a merges. The stub returns free access, empty history and `upgrade_required`, so build the free state first. For the paid state, use a local `DEV_SAMPLE` constant shaped like `AskHistoryItem`, and remove it before your final commit.
- **Fixture mode:** the page works with no keys. Show a small "Fixture engine" badge when `engineMode === "fixture"`.

What to build, in order:
1. **`app/(app)/dashboard/ask/layout.tsx`:** `requireFeature("ask")`. Copy `app/(app)/dashboard/billing/layout.tsx`.
2. **`page.tsx`** (server):
   - `buildMetadata({ title: "Ask", noIndex: true })`.
   - `const data = await loadAskPage()`.
   - `PageContent` and `PageHeader` with the title "Ask your docs", the org name, and a plan badge (Free / Pro / Business).
3. **`components/ask/ask-form.tsx`** (client):
   - A textarea with a character counter, and a submit button that also submits on Cmd/Ctrl+Enter.
   - `useTransition` for the pending state, calling `askQuestion`.
   - On `ok`, render the answer card. On `upgrade_required`, render `<UpgradePrompt/>`. On other errors, show a `toast.error`.
   - Call `router.refresh()` after each result so the history updates.
4. **`components/ask/answer-card.tsx`:**
   - The answer text and a numbered citation list. Each citation shows its title as a `next/link` to `url`, a "Docs" or "Blog" badge, and a muted snippet.
   - When `grounded === false`, show a neutral "not covered" style with no citations.
5. **`components/ask/upgrade-prompt.tsx`:** explains that answers are on Pro. If the `billing` feature is on, link to `/dashboard/billing`; otherwise show "Ask an owner to upgrade". Reuse the look of `components/billing/plan-cta.tsx`; do not call checkout.
6. **`components/ask/history-list.tsx`:** the last 20 questions with asker and relative time. A gated item shows the label "Upgrade to see the answer". Expanding an answered item shows its stored answer card. When there is no history, show `EmptyState`.
7. **States:** pending (disabled button plus spinner or skeleton), empty, error and success. Check the page at 375 px width.

Definition of done: `/dashboard/ask` renders the free state from the stub (ask, then the upgrade prompt). After rebasing on a, it renders the paid state with real cited answers and the org's history. All four states are present, it works at 375 px, and typecheck is clean.

Working rules:
- Do the MVP items in order. After each one, run `tsc --noEmit` and hit the page on your port (curl or browser) before moving on.
- Commit every ~15 minutes with a why-message on your branch.
- Follow the repo's existing patterns: find the analogous file first.
- Every query is scoped by the tenant id, and every action re-checks auth. Both come from a's server code; never pass an org id from the client.
- When an MVP item is done, tell me in 3 lines what works and how to see it, then continue.

Start by restating your owned files and definition of done in 5 lines.

### c
You are slice **c**, "proof: plan seed script, benchmark questions, smoke script, README section", of the build described in BRIEF.md. Read BRIEF.md, ARCHITECTURE-MAP.md and .claude/CLAUDE.md first.

Facts:
- **Worktree:** `$KIT_WORKTREES_DIR/sprint-test/c`, branch `feat/c`. The dev server is already running in the pane below; read `PORT` from `.env.local`.
- **DB:** `DATABASE_URL` is the shared Neon DB. You **never migrate**. Your seed script writes only `subscription` rows.
- **You OWN (may edit):** `scripts/ask/**`, and in `README.md` only a new `## Ask your docs` section, inserted before `## Pro version`.
- **READ-ONLY:** everything else, including `modules/ask/**`, `lib/**` and `content/**`. If you need a change there, stop and message `@main` with the exact diff; do not make it yourself.
- **Contract:** `modules/ask/contracts.ts` defines `AskAnswer`, `Citation` and `AskEngine`. Slice a will export `getAskEngine()` from `modules/ask/engine/index.ts`, and `corpus.ts` and `engine/**` use relative imports only, so plain `node` (v24, which strips types) can import them. Until a lands, write the smoke script against that signature and run it after rebasing on a.
- **Fixture mode:** everything runs with `AI_FIXTURES=1` and no keys.

What to build, in order:
1. **`scripts/ask/seed-plan.ts <email> <free|pro|business>`:**
   - Plain Node with `@neondatabase/serverless` `Pool` and `process.env.DATABASE_URL`. Load `.env` with `process.loadEnvFile()` and document running it under `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED`.
   - Find the user by email, then their organizations through `member`. Act on the org given by `--org <slug>`, or on the user's only org.
   - `free` deletes that org's `subscription` rows. `pro` or `business` upserts one row: `id` = `crypto.randomUUID()`, `plan`, `reference_id = org id`, `status = 'active'`, `period_start = now()`, `period_end = now() + 30 days`.
   - Print `org <name> (<id>) -> <plan>`. Check the exact column names in `lib/db/schema/auth.ts`.
2. **`scripts/ask/questions.json`:**
   - 10 benchmark questions answerable from `content/docs` and `content/blog`, each with `expectUrl`, the page that covers it. Read the MDX to pick them: Stripe webhook, Google OAuth redirect URI, pruning modules, deploying, why Drizzle and Neon, organizations and roles, and so on.
   - Plus 3 off-topic questions with `expectGrounded: false`.
3. **`scripts/ask/smoke.ts`:**
   - Imports `getAskEngine` by relative path, sets `AI_FIXTURES=1`, and runs every question.
   - Prints a table plus the totals `grounded N/10, correct citation N/10, off-topic refused N/3`.
   - Exits non-zero if correct citations are below 8 or any off-topic question is answered.
4. **README `## Ask your docs` section:** what the feature does, the plan gate, `AI_FIXTURES=1`, the demo steps from BRIEF.md, the metric line from the smoke script, and "what's next" from the BRIEF stretch list.

Definition of done: `seed-plan.ts` flips a real org between free and pro, verified by reloading `/dashboard/ask` after a merges. `smoke.ts` prints the metric and passes against a's fixture engine. The README section is drafted.

Working rules:
- Do the MVP items in order. After each one, run it and show the output before moving on.
- Commit every ~15 minutes with a why-message on your branch.
- Follow the repo's existing patterns: `scripts/prune.ts` shows how scripts are written here.
- When an item is done, tell me in 3 lines what works and how to see it, then continue.

Start by restating your owned files and definition of done in 5 lines.

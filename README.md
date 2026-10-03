# SaaS Starter

An open-source, modular SaaS starter built with Next.js 16, Better Auth, Drizzle, Neon and Stripe. Everything you usually rebuild on day one — auth, organizations, subscriptions, an admin panel, docs, a blog and a changelog — is here, and every part of it can be switched off or deleted for good.

- **Modular**: each module is a flag in `config/features.ts`. Switch it off and its routes 404, its links disappear and its endpoints are refused. Delete it with one command.
- **Typed end to end**: TypeScript, Drizzle schema, Zod validation, server actions.
- **Ready to charge**: Stripe Checkout, customer portal, webhooks, plan prices read from Stripe.

Need onboarding, teams, seat-based billing and transactional emails? **[Get Pro](https://buy.polar.sh/polar_cl_P0l5APsd2ke0F23jE8JZXBCJv5xHbJzAHOMMN1g6u8k)** — $99 early bird until Oct 12 (then $149), one-time payment. See [Pro version](#pro-version).

https://github.com/user-attachments/assets/6e002fc2-5adf-458d-9f42-442746d82a60

## Stack

| Layer     | Choice                                                 |
| --------- | ------------------------------------------------------ |
| Framework | Next.js 16 (App Router, Turbopack)                     |
| Database  | Neon Postgres + Drizzle ORM                            |
| Auth      | Better Auth (Google, organizations)                    |
| Payments  | Stripe (Checkout, customer portal, webhooks)           |
| UI        | Tailwind CSS v4, shadcn/ui, Base UI                    |
| Content   | MDX with Fumadocs (docs, blog, changelog, legal pages) |

## Modules

- **`auth`** — Google sign-in and the dashboard: `/login`, `/register`, `/dashboard`. Requires Database and Auth. <!-- module:auth -->
- **`billing`** — subscriptions and customer portal: `/pricing`, `/dashboard/billing`. Depends on `auth`, requires Payments. <!-- module:billing -->
- **`admin`** — user management for platform admins: `/admin`. Depends on `auth`. <!-- module:admin -->
- **`docs`** — MDX documentation: `/docs`. <!-- module:docs -->
- **`blog`** — MDX articles with authors and categories: `/blog`. <!-- module:blog -->
- **`changelog`** — product updates on a single page: `/changelog`. <!-- module:changelog -->

A module stays off while a module it depends on is off, or while a service it requires misses its environment variables. In development, the flag button in the bottom-right corner shows the state of everything; in production, set `default: false` on the module in `config/features.ts` and rebuild.

Don't need a module at all?

```bash
pnpm modules:prune blog changelog
```

Without `--yes`, the command only prints what it would delete: routes, components, content, packages, plus any link left pointing at a removed route.

## Getting started

```bash
npx create-next-app my-saas --example "https://github.com/mickasmt/next-saas-stripe-starter"
cd my-saas
pnpm install
cp .env.example .env.local
```

Fill in what you need — nothing has to be complete on the first run, since a module stays off until its services are configured. Then apply the migrations and start the app:

```bash
pnpm db:migrate
pnpm dev
```

To test subscriptions locally, forward Stripe events in a second terminal:

```bash
stripe listen --forward-to localhost:3000/api/auth/stripe/webhook
```

The full setup — Stripe products and prices, Google OAuth, deployment — is documented in `/docs`, or in `content/docs`. <!-- module:docs -->

## Project structure

```
app/            Routes: (marketing), (auth), (app), (docs), api
components/     UI and feature components
config/         Site, features, foundation, navigation
content/        MDX: docs, blog, changelog, legal
lib/            Auth, database, content sources, feature resolution
modules/        Server logic of the feature modules
drizzle/        Migrations
```

## Scripts

| Command                                                   | What it does                  |
| --------------------------------------------------------- | ----------------------------- |
| `pnpm dev`                                                | Start the dev server          |
| `pnpm build`                                              | Production build              |
| `pnpm typecheck` / `pnpm lint` / `pnpm format`            | Types, linting, formatting    |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle migrations and studio |
| `pnpm modules:prune <module...>`                          | Delete a module for good      |

## Metadata and SEO

Titles, descriptions, canonical URLs and social cards come from `lib/metadata.ts`; the site-wide card is generated in `app/opengraph-image.tsx`. `app/sitemap.ts` lists the public pages of the enabled modules, and `app/robots.ts` keeps the dashboard and API out of search results. Set `NEXT_PUBLIC_APP_URL` to your domain so every absolute URL is right.

<!-- module:ask start -->
## Ask your docs

`/dashboard/ask` lets a member of an organization ask a plain-language question and get an answer grounded only in the published docs and blog (`content/docs`, `content/blog`), with numbered citations that link to the exact page and section. A question the content doesn't cover gets "Your docs and blog don't cover this." and no citations; the engine never answers from outside the corpus. Every question is kept in the organization's history (the last 20, newest first), and switching organization shows only that organization's questions.

**Plan gate.** Answers are a paid feature. The plan is read from the `subscription` row where `reference_id` is the organization id and `status` is `active` or `trialing`; platform admins count as `business`. A free organization still sees the ask box, but the server action returns an upgrade prompt instead of an answer and stores the question as gated ("upgrade to see the answer"). The check happens in the action, not only in the UI.

**Fixture mode.** With `AI_FIXTURES=1`, or with no `ANTHROPIC_API_KEY`, the engine (`modules/ask/engine/`) uses keyword retrieval over the MDX and an extractive answer: no keys, no network, deterministic output. The page shows a "Fixture engine" badge, and the server logs `[ask] engine=fixture` once.

**Switching plans without Stripe.** Billing is off locally, so flip an organization's plan by writing its `subscription` row:

```bash
env -u DATABASE_URL -u DATABASE_URL_UNPOOLED node scripts/ask/seed-plan.ts <email> <free|pro|business> [--org <slug>]
# org Acme (Pksm…) -> pro
```

`pro` and `business` replace the organization's subscription rows with one active row valid for 30 days; `free` deletes them. `--org` is needed only when the user belongs to several organizations. The `env -u` is there because a shell that exports an empty `DATABASE_URL` hides `.env`.

### Demo (about 3 minutes)

1. Open `/login` and choose **Continue with Google**. Sign-up creates the user and a personal organization.
2. Click **Ask** in the sidebar. `/dashboard/ask` shows a **Free** badge and the ask box.
3. Ask *"How do I set up the Stripe webhook?"*. You get an upgrade prompt, and the question appears in history as gated.
4. Upgrade the organization: `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED node scripts/ask/seed-plan.ts <your-google-email> pro`.
5. Reload. The badge shows **Pro**. Ask the same question: the answer cites `/docs/stripe#…` and `/blog/stripe-billing-from-checkout-to-webhooks`.
6. Click a citation. You land on that page and section.
7. Ask *"What's the capital of France?"*. You get "Your docs and blog don't cover this." with no citations.
8. In a private window, sign in with a second Google account. It gets its own organization: empty history and a **Free** badge.
9. Run `node scripts/ask/smoke.ts` (below).

### Benchmark

`scripts/ask/questions.json` holds 10 questions, each paired with the page that covers it, and 3 off-topic questions. `node scripts/ask/smoke.ts` runs them all through the fixture engine and exits non-zero when fewer than 8 cite the right page or when any off-topic question gets an answer:

```
engine=fixture  grounded 8/10, correct citation 8/10, off-topic refused 3/3  (slowest 8 ms)
```

Build notes, decisions, cuts and known gaps are in [SUBMISSION.md](SUBMISSION.md).

### What's next

- Streaming answers.
- Per-organization content: tag MDX with an `organizationId` once organizations can publish their own pages. Today every organization shares the starter's content.
- Feedback on answers (helpful or not), and a usage count next to the plan.
- Embedding retrieval (pgvector on Neon) in place of keyword scoring.
<!-- module:ask end -->

## Pro version

A paid version adds what comes after launch — onboarding, transactional emails, team management and seat-based billing — on the same foundation. It isn't part of this repository; every "About Pro" link in the app points back to this section.

**[Get Pro](https://buy.polar.sh/polar_cl_P0l5APsd2ke0F23jE8JZXBCJv5xHbJzAHOMMN1g6u8k)** — $99 early bird until Oct 12 (then $149), one-time payment, no subscription.

<!-- TODO: replace with a short screen recording — onboarding, team members, emails — hosted on GitHub or linked to YouTube. -->

### What's included

- **Onboarding** — a guided, full-screen first-run flow with its own routes, saved and resumed per member.
- **Teams and roles** — invite by email, accept in one click, assign owner, admin or member. Every page and action checks the role.
- **Seat-based billing** — charge per member with Stripe. Seats follow invites and removals, prorations handled automatically.
- **Transactional emails** — welcome, magic link, team invite, receipt, trial ending: React Email templates sent through Resend.
- **Account security** — two-factor authentication and session revocation.
- **Admin panel** — real user management: roles, bans and logging in as a user.
- **Error monitoring** — Sentry wired for server and client errors.
- **SEO** — metadata, JSON-LD, sitemap and Open Graph images.
- **Installs like any other module** — Pro modules show up in the same dev panel and prune with the same command.

### Free vs Pro

| Feature                                  | Free | Pro |
| ---------------------------------------- | :--: | :-: |
| Modules, dev panel and prune command     |  ✅  | ✅  |
| Auth with organizations (Better Auth)    |  ✅  | ✅  |
| Stripe subscriptions and customer portal |  ✅  | ✅  |
| Admin panel                              |  ✅  | ✅  |
| Docs, blog and changelog                 |  ✅  | ✅  |
| Guided onboarding flow                   |  —   | ✅  |
| Team invitations, roles and permissions  |  —   | ✅  |
| Seat-based team billing                  |  —   | ✅  |
| Transactional email templates via Resend |  —   | ✅  |
| Error monitoring with Sentry             |  —   | ✅  |
| SEO: metadata, JSON-LD and sitemap       |  —   | ✅  |
| Private repository and lifetime updates  |  —   | ✅  |

### Pricing

**$99** early bird until Oct 12, then $149. One-time payment, no subscription. **[Get Pro](https://buy.polar.sh/polar_cl_P0l5APsd2ke0F23jE8JZXBCJv5xHbJzAHOMMN1g6u8k)**

The dashboard previews those features on locked pages: sample data, inert controls and an "About Pro" banner. When you ship your own product, delete `components/dashboard/pro`, the routes that use it and the `pro: true` nav items in `config/nav.ts`.

## License

MIT — see [LICENSE.md](LICENSE.md).

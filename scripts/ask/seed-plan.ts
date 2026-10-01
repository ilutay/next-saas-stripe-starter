// Sets an organization's plan by writing its `subscription` row directly, so
// the Ask plan gate can be demoed without Stripe. Touches only `subscription`.
//
//   env -u DATABASE_URL -u DATABASE_URL_UNPOOLED \
//     node scripts/ask/seed-plan.ts <email> <free|pro|business> [--org <slug>]
//
// The `env -u` matters: this shell exports DATABASE_URL as an empty string,
// and process.loadEnvFile() never overrides a variable that is already set.

import { randomUUID } from "node:crypto"
import path from "node:path"

import { Pool } from "@neondatabase/serverless"

const PLANS = ["free", "pro", "business"] as const
type Plan = (typeof PLANS)[number]

const PERIOD_DAYS = 30

class SeedError extends Error {}

type Org = { id: string; name: string; slug: string }

async function main() {
  const args = process.argv.slice(2)
  const orgFlag = args.indexOf("--org")
  const orgSlug = orgFlag === -1 ? undefined : args[orgFlag + 1]
  const [email, plan] = args.filter(
    (arg, i) => !arg.startsWith("--") && (orgFlag === -1 || i !== orgFlag + 1)
  )

  if (!email || !plan || (orgFlag !== -1 && !orgSlug)) {
    throw new SeedError(
      "Usage: node scripts/ask/seed-plan.ts <email> <free|pro|business> [--org <slug>]"
    )
  }
  if (!isPlan(plan)) {
    throw new SeedError(`Unknown plan "${plan}". Plans: ${PLANS.join(", ")}`)
  }

  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, "../../.env"))
  } catch {
    // No .env: rely on the environment.
  }
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new SeedError(
      "DATABASE_URL is empty. Run under `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED` so .env is read."
    )
  }

  const pool = new Pool({ connectionString })
  try {
    const org = await findOrg(pool, email, orgSlug)
    await setPlan(pool, org.id, plan)
    console.log(`org ${org.name} (${org.id}) -> ${plan}`)
  } finally {
    await pool.end()
  }
}

async function findOrg(pool: Pool, email: string, orgSlug?: string) {
  const users = await pool.query<{ id: string }>(
    `select id from "user" where lower(email) = lower($1)`,
    [email]
  )
  const user = users.rows[0]
  if (!user) throw new SeedError(`No user with email ${email}.`)

  const orgs = await pool.query<Org>(
    `select o.id, o.name, o.slug
       from member m join organization o on o.id = m.organization_id
      where m.user_id = $1
      order by o.created_at`,
    [user.id]
  )
  const list = orgs.rows.map((o) => `${o.slug} (${o.name})`).join(", ")

  if (orgSlug) {
    const org = orgs.rows.find((o) => o.slug === orgSlug)
    if (!org) {
      throw new SeedError(
        `${email} is not a member of "${orgSlug}". Orgs: ${list || "none"}`
      )
    }
    return org
  }
  if (orgs.rows.length === 0) throw new SeedError(`${email} has no organizations.`)
  if (orgs.rows.length > 1) {
    throw new SeedError(`${email} has several orgs; pass --org <slug>. Orgs: ${list}`)
  }
  return orgs.rows[0]
}

// `subscription.reference_id` has no unique constraint, so the upsert is a
// delete plus insert in one transaction: the org ends with exactly one row.
async function setPlan(pool: Pool, orgId: string, plan: Plan) {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query(`delete from subscription where reference_id = $1`, [
      orgId,
    ])
    if (plan !== "free") {
      await client.query(
        `insert into subscription (id, plan, reference_id, status, period_start, period_end)
         values ($1, $2, $3, 'active', now(), now() + make_interval(days => $4))`,
        [randomUUID(), plan, orgId, PERIOD_DAYS]
      )
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value)
}

try {
  await main()
} catch (error) {
  if (!(error instanceof SeedError)) throw error
  console.error(error.message)
  process.exitCode = 1
}

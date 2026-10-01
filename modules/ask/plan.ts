import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { isPlatformAdmin } from "@/lib/auth/roles"
import { db } from "@/lib/db"
import { subscription } from "@/lib/db/schema"
import type { AskAccess, AskPlanName } from "@/modules/ask/contracts"

const ACTIVE_STATUSES = ["active", "trialing"]

// Reads the subscription table directly rather than
// auth.api.listActiveSubscriptions: billing (Stripe) is off locally, and the
// demo flips the plan with a seeded subscription row.
export async function getAskAccess(
  organizationId: string,
  userRole: string | null | undefined
): Promise<AskAccess> {
  // Platform admins count as business (same rule as modules/billing/plans.ts adminPlan).
  if (isPlatformAdmin(userRole)) return { plan: "business", canAnswer: true }

  const rows = await db
    .select({ plan: subscription.plan })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, organizationId),
        inArray(subscription.status, ACTIVE_STATUSES)
      )
    )

  const plans = rows.map((r) => r.plan)
  const plan: AskPlanName = plans.includes("business")
    ? "business"
    : plans.includes("pro")
      ? "pro"
      : "free"

  return { plan, canAnswer: plan !== "free" }
}

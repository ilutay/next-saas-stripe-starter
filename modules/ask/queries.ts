import "server-only"

import { desc, eq } from "drizzle-orm"

import { getActiveOrganization } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { askQuery, user } from "@/lib/db/schema"
import type { AskPageData } from "@/modules/ask/contracts"
import { getAskEngine } from "@/modules/ask/engine"
import { toHistoryItem } from "@/modules/ask/history"
import { getAskAccess } from "@/modules/ask/plan"

const HISTORY_LIMIT = 20

export async function loadAskPage(): Promise<AskPageData> {
  const { session, organization } = await getActiveOrganization()

  const [access, rows] = await Promise.all([
    getAskAccess(organization.id, session.user.role),
    db
      .select({ row: askQuery, askedByName: user.name })
      .from(askQuery)
      .leftJoin(user, eq(user.id, askQuery.userId))
      .where(eq(askQuery.organizationId, organization.id))
      .orderBy(desc(askQuery.createdAt))
      .limit(HISTORY_LIMIT),
  ])

  return {
    organizationName: organization.name,
    access,
    engineMode: getAskEngine().mode,
    history: rows.map((r) => toHistoryItem(r.row, r.askedByName)),
  }
}

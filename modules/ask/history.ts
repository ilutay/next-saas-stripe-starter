import "server-only"

import type { askQuery } from "@/lib/db/schema"
import type { AskHistoryItem } from "@/modules/ask/contracts"

type AskQueryRow = typeof askQuery.$inferSelect

// One shape for the action's result and the page's history list.
export function toHistoryItem(
  row: AskQueryRow,
  askedByName: string | null
): AskHistoryItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    citations: row.citations,
    grounded: row.grounded,
    // user_id is set null when the asker's account is deleted.
    askedBy: { name: askedByName ?? "Former member" },
    createdAt: row.createdAt.toISOString(),
  }
}

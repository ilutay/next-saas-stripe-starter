// module:ask
// Question history for "Ask your docs". Every row is scoped to one
// organization; a free-plan question is stored with answer = null (gated).
import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import type { Citation } from "../../../modules/ask/contracts"
import { organization, user } from "./auth"

export const askQuery = pgTable(
  "ask_query",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    answer: text("answer"),
    citations: jsonb("citations").$type<Citation[]>().default([]).notNull(),
    grounded: boolean("grounded").default(false).notNull(),
    plan: text("plan").notNull(),
    engineMode: text("engine_mode").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ask_query_organizationId_idx").on(table.organizationId),
    index("ask_query_organizationId_createdAt_idx").on(
      table.organizationId,
      table.createdAt
    ),
  ]
)

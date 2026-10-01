"use server"

import { revalidatePath } from "next/cache"

import { getActiveOrganization } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { askQuery } from "@/lib/db/schema"
import { assertFeature } from "@/lib/features/guard"
import {
  askInputSchema,
  type AskActionResult,
  type AskAnswer,
} from "@/modules/ask/contracts"
import { getAskEngine } from "@/modules/ask/engine"
import { toHistoryItem } from "@/modules/ask/history"
import { getAskAccess } from "@/modules/ask/plan"

// The plan gate lives here, not in the UI: a free org's question is stored
// (answer = null) but never answered.
export async function askQuestion(input: unknown): Promise<AskActionResult> {
  await assertFeature("ask")

  const parsed = askInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid question.",
    }
  }
  const { question } = parsed.data

  // Session re-check; the organization never comes from the client.
  const { session, organization } = await getActiveOrganization()
  const access = await getAskAccess(organization.id, session.user.role)
  const engine = getAskEngine()

  if (!access.canAnswer) {
    await db.insert(askQuery).values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      userId: session.user.id,
      question,
      answer: null,
      plan: access.plan,
      engineMode: engine.mode,
    })
    revalidatePath("/dashboard/ask")
    return {
      ok: false,
      error: "upgrade_required",
      message: "Answers are part of the Pro plan.",
    }
  }

  let result: AskAnswer
  try {
    result = await engine.ask(question)
  } catch (error) {
    console.error("[ask] engine failed", error)
    return {
      ok: false,
      error: "engine_failed",
      message: "Couldn't answer that right now. Try again in a moment.",
    }
  }

  const [row] = await db
    .insert(askQuery)
    .values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      userId: session.user.id,
      question,
      answer: result.answer,
      citations: result.citations,
      grounded: result.grounded,
      plan: access.plan,
      engineMode: engine.mode,
    })
    .returning()

  revalidatePath("/dashboard/ask")
  return { ok: true, item: toHistoryItem(row, session.user.name) }
}

// Shared contract for the `ask` module. Owned by main: slices build against it
// and never edit it. Types and zod only, so client components can import it.

import { z } from "zod"

export const ASK_QUESTION_MIN = 3
export const ASK_QUESTION_MAX = 500

export const askInputSchema = z.object({
  question: z.string().trim().min(ASK_QUESTION_MIN).max(ASK_QUESTION_MAX),
})

export type AskInput = z.infer<typeof askInputSchema>

// Only the organization's published docs and blog. Changelog and legal are out.
export type ContentSource = "docs" | "blog"

export type Citation = {
  title: string
  // Site-relative page URL: /docs, /docs/<slug> or /blog/<slug>, plus an
  // optional #heading-anchor.
  url: string
  source: ContentSource
  // The passage the answer relied on, plain text, at most ~240 characters.
  snippet: string
}

export type AskAnswer = {
  answer: string
  citations: Citation[]
  // false when no passage matched: the answer then says the content does not
  // cover the question, and citations is empty. Never answer from outside.
  grounded: boolean
}

// The one adapter for retrieval and answering (modules/ask/engine/).
// AI_FIXTURES=1, or no LLM key, selects the "fixture" engine: keyword
// retrieval over the MDX and an extractive answer, with no network calls.
export interface AskEngine {
  readonly mode: "fixture" | "llm"
  ask(question: string): Promise<AskAnswer>
}

export type AskPlanName = "free" | "pro" | "business"

export type AskAccess = {
  plan: AskPlanName
  // pro, business, or a platform admin.
  canAnswer: boolean
}

export type AskHistoryItem = {
  id: string
  question: string
  // null when the question was asked on the free plan (gated).
  answer: string | null
  citations: Citation[]
  grounded: boolean
  askedBy: { name: string }
  // ISO 8601.
  createdAt: string
}

export type AskActionError =
  "invalid_input" | "upgrade_required" | "engine_failed"

export type AskActionResult =
  | { ok: true; item: AskHistoryItem }
  | { ok: false; error: AskActionError; message: string }

export type AskPageData = {
  organizationName: string
  access: AskAccess
  engineMode: AskEngine["mode"]
  // This organization only, newest first, at most 20.
  history: AskHistoryItem[]
}

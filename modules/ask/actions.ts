"use server"

import type { AskActionResult } from "@/modules/ask/contracts"

// STUB committed by main so slice b can build against the final signature.
// Slice a owns this file and replaces the body: assertFeature("ask") → zod
// (askInputSchema) → getActiveOrganization() → plan gate → engine → insert
// into ask_query scoped by organizationId.
export async function askQuestion(input: unknown): Promise<AskActionResult> {
  void input
  return {
    ok: false,
    error: "upgrade_required",
    message: "Answers are part of the Pro plan.",
  }
}

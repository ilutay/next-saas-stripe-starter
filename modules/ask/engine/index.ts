// The one adapter for answering questions. AI_FIXTURES=1, or no
// ANTHROPIC_API_KEY, selects the fixture engine (no keys, no network).
//
// Relative imports only (see corpus.ts): scripts/ask/smoke.ts runs this with
// plain `node`.

import type { AskEngine } from "../contracts.ts"
import { createFixtureEngine } from "./fixture.ts"

let engine: AskEngine | null = null

export function getAskEngine(): AskEngine {
  if (engine) return engine
  // The LLM engine (BRIEF "Should" item) plugs in here once it exists; until
  // then every environment answers from the fixture engine.
  engine = createFixtureEngine()
  console.log(`[ask] engine=${engine.mode}`)
  return engine
}

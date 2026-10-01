// Runs the benchmark in questions.json through the Ask engine in fixture mode
// and prints the metric BRIEF.md claims. No keys, no network, no database.
//
//   node scripts/ask/smoke.ts
//
// Fails (exit 1) when fewer than 8 of the on-topic questions cite the page
// that covers them, or when any off-topic question gets an answer.

import { readFileSync } from "node:fs"
import path from "node:path"

import type { AskAnswer } from "../../modules/ask/contracts.ts"

const MIN_CORRECT_CITATIONS = 8

type Question =
  | { question: string; expectUrl: string }
  | { question: string; expectGrounded: false }

type Row = {
  question: string
  expect: string
  grounded: boolean
  cited: string
  pass: boolean
  ms: number
}

async function main() {
  // Set before the engine module loads, so it can never pick the LLM engine.
  process.env.AI_FIXTURES = "1"
  // The corpus reads content/ relative to the working directory.
  process.chdir(path.resolve(import.meta.dirname, "../.."))

  const { getAskEngine } = await import("../../modules/ask/engine/index.ts")
  const engine = getAskEngine()

  const questions: Question[] = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "questions.json"), "utf8")
  )

  const rows: Row[] = []
  for (const q of questions) {
    const started = performance.now()
    const answer = await engine.ask(q.question)
    const ms = Math.round(performance.now() - started)
    const pages = citedPages(answer)

    rows.push({
      question: q.question,
      expect: "expectUrl" in q ? q.expectUrl : "(not covered)",
      grounded: answer.grounded,
      cited: pages.join(" ") || "-",
      pass:
        "expectUrl" in q
          ? pages.includes(q.expectUrl)
          : !answer.grounded && answer.citations.length === 0,
      ms,
    })
  }

  console.table(
    rows.map((r) => ({
      ...r,
      grounded: r.grounded ? "yes" : "no",
      pass: r.pass ? "PASS" : "FAIL",
    }))
  )

  const onTopic = rows.filter((_, i) => "expectUrl" in questions[i])
  const offTopic = rows.filter((_, i) => !("expectUrl" in questions[i]))
  const grounded = onTopic.filter((r) => r.grounded).length
  const correct = onTopic.filter((r) => r.pass).length
  const refused = offTopic.filter((r) => r.pass).length
  const slowest = Math.max(...rows.map((r) => r.ms))

  console.log(
    `engine=${engine.mode}  grounded ${grounded}/${onTopic.length}, ` +
      `correct citation ${correct}/${onTopic.length}, ` +
      `off-topic refused ${refused}/${offTopic.length}  (slowest ${slowest} ms)`
  )

  if (correct < MIN_CORRECT_CITATIONS || refused < offTopic.length) {
    console.error(
      `FAIL: need correct citation >= ${MIN_CORRECT_CITATIONS} and every off-topic question refused.`
    )
    process.exitCode = 1
  }
}

// Page URLs without the #anchor, so a citation to any section of the
// expected page counts.
function citedPages(answer: AskAnswer) {
  return [...new Set(answer.citations.map((c) => c.url.split("#")[0]))]
}

await main()

// Fixture engine: keyword retrieval over the MDX corpus and an extractive
// answer. No keys, no network, deterministic.
//
// Relative imports only (see corpus.ts): scripts/ask/smoke.ts runs this with
// plain `node`.

import type { AskAnswer, AskEngine, Citation } from "../contracts.ts"
import { loadCorpus, type CorpusChunk } from "../corpus.ts"

export const NOT_COVERED = "Your docs and blog don't cover this."

const TOP_CHUNKS = 3
const MAX_SENTENCES = 3
const SNIPPET_MAX = 240
// Share of the question's (idf-weighted) keywords the best chunk must contain.
// Off-topic questions match one stray word at most, so they stay under it.
const MIN_COVERAGE = 0.5
// A runner-up chunk must score at least this fraction of the best one.
const MIN_RELATIVE_SCORE = 0.35

const STOPWORDS = new Set(
  (
    "a about after all also am an and any are as at be been before being but by can " +
    "could did do does doing done for from get gets got had has have having how i if " +
    "in into is it its it's just me more most my need no not of off on once only or " +
    "other our out over own same set should so some such than that the their them " +
    "then there these they this those through to too under up use used using very " +
    "want was way we were what when where which while who whom why will with would " +
    "you your yours tell explain show work works make"
  ).split(" ")
)

// Light stemming so "webhooks" matches "webhook" and "roles" matches "role".
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y"
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1)
  }
  return token
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
}

type IndexedChunk = {
  chunk: CorpusChunk
  title: Set<string>
  heading: Set<string>
  body: Set<string>
}

type Index = { chunks: IndexedChunk[]; vocab: string[] }

let cachedIndex: Index | null = null

function buildIndex(): Index {
  if (cachedIndex) return cachedIndex
  const chunks = loadCorpus().map((chunk) => ({
    chunk,
    title: new Set(tokenize(chunk.pageTitle)),
    heading: new Set(tokenize(chunk.heading ?? "")),
    body: new Set(tokenize(`${chunk.text} ${chunk.code}`)),
  }))
  const vocab = new Set<string>()
  for (const c of chunks) for (const t of [...c.title, ...c.heading, ...c.body]) vocab.add(t)
  cachedIndex = { chunks, vocab: [...vocab] }
  return cachedIndex
}

// A question term matches its corpus variants by shared prefix, so "deploy"
// finds "deployment" and "install" finds "installation".
const MIN_PREFIX = 5

function variantsOf(term: string, vocab: string[]): Set<string> {
  const variants = new Set([term])
  if (term.length < MIN_PREFIX) return variants
  for (const v of vocab) {
    if (v.length >= MIN_PREFIX && (v.startsWith(term) || term.startsWith(v))) {
      variants.add(v)
    }
  }
  return variants
}

type Term = { variants: Set<string>; idf: number }

function hasAny(set: Set<string>, variants: Set<string>): boolean {
  for (const v of variants) if (set.has(v)) return true
  return false
}

// idf over the term's variant group. Words the corpus never uses weigh the
// most: they are what makes a question off-topic.
function weighTerms(words: string[], index: Index): Term[] {
  const n = index.chunks.length
  return words.map((word) => {
    const variants = variantsOf(word, index.vocab)
    const df = index.chunks.filter(
      (c) => hasAny(c.body, variants) || hasAny(c.heading, variants) || hasAny(c.title, variants)
    ).length
    return { variants, idf: Math.log(1 + n / Math.max(df, 1)) }
  })
}

function scoreChunk(c: IndexedChunk, terms: Term[]) {
  let score = 0
  let matched = 0
  for (const { variants, idf } of terms) {
    const hit =
      (hasAny(c.body, variants) ? 1 : 0) +
      (hasAny(c.heading, variants) ? 2 : 0) +
      (hasAny(c.title, variants) ? 1.5 : 0)
    if (hit > 0) {
      score += idf * hit
      matched += idf
    }
  }
  return { score, matched }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9`"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`
}

function pageUrl(url: string): string {
  return url.split("#")[0]
}

export function answerFromCorpus(question: string): AskAnswer {
  const index = buildIndex()
  const notCovered: AskAnswer = { grounded: false, citations: [], answer: NOT_COVERED }
  const terms = weighTerms([...new Set(tokenize(question))], index)
  if (terms.length === 0) return notCovered

  const total = terms.reduce((sum, t) => sum + t.idf, 0)
  const ranked = index.chunks
    .map((c) => {
      const { score, matched } = scoreChunk(c, terms)
      // A section that answers the whole question beats one whose heading
      // repeats a single word of it.
      const coverage = matched / total
      return { c, coverage, score: score * coverage }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.coverage < MIN_COVERAGE) return notCovered

  const top = ranked
    .filter((r) => r.score >= best.score * MIN_RELATIVE_SCORE)
    .slice(0, TOP_CHUNKS)

  // Best sentences across the top chunks, by how many question terms they hit.
  const sentences = top.flatMap((r, rank) =>
    splitSentences(r.c.chunk.text).map((text, position) => {
      const words = new Set(tokenize(text))
      const score = terms.reduce((sum, t) => sum + (hasAny(words, t.variants) ? t.idf : 0), 0)
      return { text, score, rank, position }
    })
  )
  const picked = sentences
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.position - b.position)
    .slice(0, MAX_SENTENCES)
    // Read in source order: best chunk first, then position within it.
    .sort((a, b) => a.rank - b.rank || a.position - b.position)

  const answer =
    picked.length > 0
      ? picked.map((s) => s.text).join(" ")
      : truncate(best.c.chunk.text, SNIPPET_MAX * 2)
  if (!answer) return notCovered

  // One citation per page, pointing at its best-scoring section.
  const citations: Citation[] = []
  const seen = new Set<string>()
  for (const r of top) {
    const page = pageUrl(r.c.chunk.url)
    if (seen.has(page)) continue
    seen.add(page)
    const sentence = picked.find((s) => top[s.rank] === r)?.text
    citations.push({
      title: r.c.chunk.heading
        ? `${r.c.chunk.pageTitle} › ${r.c.chunk.heading}`
        : r.c.chunk.pageTitle,
      url: r.c.chunk.url,
      source: r.c.chunk.source,
      snippet: truncate(sentence ?? r.c.chunk.text, SNIPPET_MAX),
    })
  }

  return { grounded: true, answer, citations }
}

export function createFixtureEngine(): AskEngine {
  return {
    mode: "fixture",
    async ask(question) {
      return answerFromCorpus(question)
    },
  }
}

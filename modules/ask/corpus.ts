// The searchable corpus for "Ask your docs": content/docs and content/blog,
// read from disk and chunked by heading.
//
// Relative imports only, no "@/" and no "server-only": scripts/ask/smoke.ts
// imports this with plain `node` (v24 strips the types).

import fs from "node:fs"
import path from "node:path"

import type { ContentSource } from "./contracts.ts"

export type CorpusChunk = {
  source: ContentSource
  pageTitle: string
  // The ## / ### heading, or null for the text before the first heading.
  heading: string | null
  // Page URL plus #anchor when the chunk has a heading.
  url: string
  // Prose only, used for the extractive answer and the snippet.
  text: string
  // Code-fence contents: searchable (env var names, commands), never quoted.
  code: string
}

const SOURCES: { source: ContentSource; dir: string; urlFor: (slug: string) => string }[] = [
  {
    source: "docs",
    dir: "content/docs",
    urlFor: (slug) => (slug === "index" ? "/docs" : `/docs/${slug}`),
  },
  { source: "blog", dir: "content/blog", urlFor: (slug) => `/blog/${slug}` },
]

// Same ids Fumadocs renders (github-slugger): lowercase, punctuation removed,
// each space becomes "-". "It's still modules" -> "its-still-modules".
export function slugifyHeading(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-")
}

// Markdown inline syntax down to plain text.
function inlineToText(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\s)[*_](\S.*?\S|\S)[*_](?=\s|[.,;:!?)]|$)/g, "$1$2")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseMdx(raw: string): { title: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const frontmatter = match?.[1] ?? ""
  const title =
    frontmatter
      .match(/^title:\s*(.+)$/m)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? ""
  return { title, body: match ? raw.slice(match[0].length) : raw }
}

export function chunkMdx(
  raw: string,
  meta: { source: ContentSource; pageUrl: string; fallbackTitle: string }
): CorpusChunk[] {
  const { title, body } = parseMdx(raw)
  const pageTitle = title || meta.fallbackTitle
  const chunks: CorpusChunk[] = []

  let heading: string | null = null
  let prose: string[] = []
  let code: string[] = []
  let inFence = false

  const flush = () => {
    const text = prose.join(" ").replace(/\s+/g, " ").trim()
    if (text || heading) {
      chunks.push({
        source: meta.source,
        pageTitle,
        heading,
        url: heading ? `${meta.pageUrl}#${slugifyHeading(heading)}` : meta.pageUrl,
        text,
        code: code.join(" ").replace(/\s+/g, " ").trim(),
      })
    }
    prose = []
    code = []
  }

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      code.push(line)
      continue
    }
    const h = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (h) {
      flush()
      heading = inlineToText(h[2])
      continue
    }
    // JSX: drop the tags (<Callout>, </Callout>, <Card ... />), keep inner text.
    const stripped = line.replace(/<\/?[A-Za-z][^>]*>/g, " ")
    if (/^\s*(import|export)\s/.test(stripped)) continue
    const text = inlineToText(stripped)
    // A paragraph break ends a sentence even when the author left no period.
    if (!text) {
      if (prose.length && !/[.!?:]$/.test(prose[prose.length - 1])) {
        prose[prose.length - 1] += "."
      }
      continue
    }
    prose.push(text)
  }
  flush()
  return chunks
}

let cached: CorpusChunk[] | null = null

export function loadCorpus(root: string = process.cwd()): CorpusChunk[] {
  if (cached) return cached
  const chunks: CorpusChunk[] = []
  for (const { source, dir, urlFor } of SOURCES) {
    const abs = path.join(root, dir)
    for (const file of fs.readdirSync(abs).sort()) {
      if (!file.endsWith(".mdx")) continue
      const slug = file.replace(/\.mdx$/, "")
      const raw = fs.readFileSync(path.join(abs, file), "utf8")
      chunks.push(...chunkMdx(raw, { source, pageUrl: urlFor(slug), fallbackTitle: slug }))
    }
  }
  cached = chunks
  return chunks
}

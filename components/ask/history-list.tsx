"use client"

import { ChevronDown, Lock, MessageCircleQuestion } from "lucide-react"
import { useState } from "react"

import { AnswerCard } from "@/components/ask/answer-card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AskHistoryItem } from "@/modules/ask/contracts"

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

function relativeTime(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit)
    }
  }
  return "just now"
}

export function HistoryList({
  history,
  canAnswer,
}: {
  history: AskHistoryItem[]
  canAnswer: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.02em]">
        Recent questions
      </h2>
      {history.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="No questions yet"
          description="Questions anyone in your organization asks show up here."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {history.map((item) => {
            const gated = item.answer === null
            const open = openId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={gated}
                  aria-expanded={gated ? undefined : open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left enabled:hover:bg-muted/40 disabled:cursor-default"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{item.question}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.askedBy.name} ·{" "}
                      <time dateTime={item.createdAt} suppressHydrationWarning>
                        {relativeTime(item.createdAt)}
                      </time>
                    </p>
                  </div>
                  {gated && canAnswer ? (
                    // Asked before the upgrade: no answer was stored, so
                    // pointing at the upgrade would be wrong now.
                    <Badge variant="outline" className="mt-0.5">
                      Asked on Free
                    </Badge>
                  ) : gated ? (
                    <Badge variant="secondary" className="mt-0.5">
                      <Lock />
                      <span className="max-sm:hidden">
                        Upgrade to see the answer
                      </span>
                      <span className="sm:hidden">Upgrade</span>
                    </Badge>
                  ) : (
                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  )}
                </button>
                {open && !gated && (
                  <div className="px-4 pb-4">
                    <AnswerCard item={item} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

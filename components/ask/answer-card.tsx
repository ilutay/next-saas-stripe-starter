import { SearchX } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AskHistoryItem } from "@/modules/ask/contracts"

// One grounded answer with its numbered sources. An ungrounded answer gets a
// neutral "not covered" look and never shows citations.
export function AnswerCard({
  item,
  className,
}: {
  item: Pick<AskHistoryItem, "answer" | "citations" | "grounded">
  className?: string
}) {
  if (!item.grounded) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-muted-foreground",
          className
        )}
      >
        <SearchX className="mt-0.5 size-4 shrink-0" />
        <p>{item.answer ?? "Your docs and blog don't cover this."}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border bg-card p-5", className)}>
      <p className="leading-relaxed whitespace-pre-line">{item.answer}</p>
      {item.citations.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Sources
          </h3>
          <ol className="flex flex-col gap-3">
            {item.citations.map((citation, index) => (
              <li key={`${citation.url}-${index}`} className="flex gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={citation.url}
                      className="font-medium break-words underline-offset-4 hover:underline"
                    >
                      {citation.title}
                    </Link>
                    <Badge variant="outline">
                      {citation.source === "docs" ? "Docs" : "Blog"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {citation.snippet}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AnswerCard } from "@/components/ask/answer-card"
import { UpgradePrompt } from "@/components/ask/upgrade-prompt"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { askQuestion } from "@/modules/ask/actions"
import {
  ASK_QUESTION_MAX,
  ASK_QUESTION_MIN,
  type AskHistoryItem,
} from "@/modules/ask/contracts"

type Outcome =
  | { kind: "answer"; item: AskHistoryItem }
  | { kind: "upgrade" }
  | null

export function AskForm({ billingEnabled }: { billingEnabled: boolean }) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [pending, startTransition] = useTransition()

  const length = question.trim().length
  const canSubmit = !pending && length >= ASK_QUESTION_MIN

  function submit() {
    if (!canSubmit) return
    startTransition(async () => {
      try {
        const result = await askQuestion({ question })
        if (result.ok) {
          setOutcome({ kind: "answer", item: result.item })
          setQuestion("")
        } else if (result.error === "upgrade_required") {
          setOutcome({ kind: "upgrade" })
        } else {
          setOutcome(null)
          toast.error(result.message)
        }
      } catch {
        toast.error("Couldn't get an answer. Try again.")
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Label htmlFor="ask-question" className="sr-only">
          Your question
        </Label>
        <Textarea
          id="ask-question"
          value={question}
          maxLength={ASK_QUESTION_MAX}
          rows={3}
          placeholder="How do I set up the Stripe webhook?"
          className="bg-card dark:bg-card"
          disabled={pending}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {question.length}/{ASK_QUESTION_MAX}
            <span className="max-sm:hidden"> · ⌘/Ctrl + Enter to ask</span>
          </span>
          <Button type="submit" disabled={!canSubmit}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Asking…" : "Ask"}
          </Button>
        </div>
      </form>

      {pending ? (
        <div
          aria-busy="true"
          aria-label="Looking through the docs"
          className="flex animate-pulse flex-col gap-3 rounded-lg border bg-card p-5"
        >
          <div className="h-3 w-11/12 rounded bg-muted" />
          <div className="h-3 w-9/12 rounded bg-muted" />
          <div className="h-3 w-10/12 rounded bg-muted" />
        </div>
      ) : outcome?.kind === "answer" ? (
        <AnswerCard item={outcome.item} />
      ) : outcome?.kind === "upgrade" ? (
        <UpgradePrompt billingEnabled={billingEnabled} />
      ) : null}
    </div>
  )
}

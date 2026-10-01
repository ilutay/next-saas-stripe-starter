import { Sparkles } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Shown when a free organization asks. The question is still saved to the
// history; the answer needs Pro. Never starts a checkout from here.
export function UpgradePrompt({
  billingEnabled,
  className,
}: {
  billingEnabled: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h3 className="font-semibold tracking-tight">
            Answers are part of the Pro plan
          </h3>
          <p className="mt-1 text-muted-foreground">
            Your question was saved. Upgrade to get answers grounded in your docs
            and blog, with links to the source.
          </p>
        </div>
      </div>
      {billingEnabled ? (
        <Link
          href="/dashboard/billing"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0")}
        >
          Upgrade to Pro
        </Link>
      ) : (
        <p className="shrink-0 text-sm text-muted-foreground">
          Ask an owner to upgrade
        </p>
      )}
    </div>
  )
}

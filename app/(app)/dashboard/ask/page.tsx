import { AskForm } from "@/components/ask/ask-form"
import { HistoryList } from "@/components/ask/history-list"
import { PageContent, PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { isFeatureEnabled } from "@/lib/features/resolve"
import { buildMetadata } from "@/lib/metadata"
import type { AskHistoryItem, AskPlanName } from "@/modules/ask/contracts"
import { loadAskPage } from "@/modules/ask/queries"

export const metadata = buildMetadata({
  title: "Ask",
  noIndex: true,
})

const planLabels: Record<AskPlanName, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
}

// DEV_SAMPLE: temporary paid-state preview until slice a merges. Remove before final commit.
const DEV_SAMPLE: AskHistoryItem[] = [
  {
    id: "sample-1",
    question: "How do I set up the Stripe webhook?",
    answer:
      "Point a Stripe webhook endpoint at /api/auth/stripe/webhook and copy its signing secret into STRIPE_WEBHOOK_SECRET. Locally, forward events with the Stripe CLI.",
    citations: [
      { title: "Stripe", url: "/docs/stripe#webhooks", source: "docs", snippet: "Create a webhook endpoint in the Stripe dashboard pointing at /api/auth/stripe/webhook, then set STRIPE_WEBHOOK_SECRET." },
      { title: "Stripe billing, from checkout to webhooks", url: "/blog/stripe-billing-from-checkout-to-webhooks", source: "blog", snippet: "The webhook is the source of truth: subscription status only changes when Stripe tells us." },
    ],
    grounded: true,
    askedBy: { name: "Sample User" },
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: "sample-2",
    question: "What's the capital of France?",
    answer: "Your docs and blog don't cover this.",
    citations: [],
    grounded: false,
    askedBy: { name: "Sample User" },
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    id: "sample-3",
    question: "Can members invite other people to the organization?",
    answer: null,
    citations: [],
    grounded: false,
    askedBy: { name: "Sample User" },
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string }>
}) {
  const sample = process.env.NODE_ENV === "development" && (await searchParams).sample === "1"
  const [data, billingEnabled] = await Promise.all([
    loadAskPage(),
    isFeatureEnabled("billing"),
  ])

  return (
    <PageContent>
      <PageHeader
        title="Ask your docs"
        description={`Answers from the published docs and blog of ${data.organizationName}, with links to the source.`}
      >
        {data.engineMode === "fixture" && (
          <Badge variant="outline">Fixture engine</Badge>
        )}
        <Badge variant={data.access.canAnswer ? "default" : "secondary"}>
          {planLabels[data.access.plan]}
        </Badge>
      </PageHeader>
      <div className="flex flex-col gap-8">
        <AskForm billingEnabled={billingEnabled} />
        <HistoryList history={sample ? DEV_SAMPLE : data.history} />
      </div>
    </PageContent>
  )
}

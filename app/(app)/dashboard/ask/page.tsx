import { AskForm } from "@/components/ask/ask-form"
import { HistoryList } from "@/components/ask/history-list"
import { PageContent, PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { isFeatureEnabled } from "@/lib/features/resolve"
import { buildMetadata } from "@/lib/metadata"
import type { AskPlanName } from "@/modules/ask/contracts"
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

export default async function AskPage() {
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
        <HistoryList
          history={data.history}
          canAnswer={data.access.canAnswer}
        />
      </div>
    </PageContent>
  )
}

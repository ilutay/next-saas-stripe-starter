import { PageContent, PageHeader } from "@/components/dashboard/page-header"

// Mirrors the page layout while loadAskPage reads the plan and history.
export default function AskLoading() {
  return (
    <PageContent>
      <PageHeader
        title="Ask your docs"
        description="Answers from your published docs and blog, with links to the source."
      />
      <div aria-busy="true" className="flex animate-pulse flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="h-[86px] rounded-md border bg-card" />
          <div className="ml-auto h-9 w-16 rounded-md bg-muted" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-48 rounded-lg border bg-card" />
        </div>
      </div>
    </PageContent>
  )
}

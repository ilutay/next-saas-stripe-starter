import { requireFeature } from "@/lib/features/guard"

export default async function AskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFeature("ask")
  return children
}

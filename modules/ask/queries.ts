import "server-only"

import { getActiveOrganization } from "@/lib/auth/session"
import type { AskPageData } from "@/modules/ask/contracts"

// STUB committed by main so slice b can build against the final signature.
// Slice a owns this file and replaces the body with the real plan lookup and
// the organization's history (ask_query where organization_id = active org).
export async function loadAskPage(): Promise<AskPageData> {
  const { organization } = await getActiveOrganization()
  return {
    organizationName: organization.name,
    access: { plan: "free", canAnswer: false },
    engineMode: "fixture",
    history: [],
  }
}

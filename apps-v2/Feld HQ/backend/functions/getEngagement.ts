import { getEngagement } from './hq'
import type { Engagement } from './types'

type Params = { engagementId: number }

export default async function(req: { params: Params }): Promise<Engagement | null> {
  return getEngagement(req.params.engagementId)
}

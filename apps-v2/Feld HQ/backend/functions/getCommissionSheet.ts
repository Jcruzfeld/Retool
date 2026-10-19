import { getCommissionSheet } from './hq'
import type { CommissionSheet } from './types'

type Params = { engagementId: number }

export default async function(req: { params: Params }): Promise<CommissionSheet | null> {
  return getCommissionSheet(req.params.engagementId)
}

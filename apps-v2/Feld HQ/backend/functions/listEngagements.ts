import { listEngagements } from './hq'
import type { Engagement } from './types'

type Params = { showCode: string; year: string }

export default async function(req: { params: Params }): Promise<Engagement[]> {
  return listEngagements(req.params.showCode, req.params.year)
}

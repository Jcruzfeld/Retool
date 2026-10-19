import { listShows } from './hq'
import type { Show } from './types'

type Params = {
  showStatus: 'active' | 'inactive'
  year: string
  showGroup: 'fms' | 'legacy'
}

export default async function(req: { params: Params }): Promise<Show[]> {
  const { showStatus, year, showGroup } = req.params

  return listShows(showStatus, year, showGroup)
}

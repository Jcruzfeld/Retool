import { listShowYears } from './hq'

type Params = { showStatus: 'active' | 'inactive' }

export default async function(req: { params: Params }): Promise<string[]> {
  return listShowYears(req.params.showStatus)
}

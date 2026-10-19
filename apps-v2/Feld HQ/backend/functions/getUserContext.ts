import { getUserContext } from './hq'

type Params = { personId: number }

export default async function(req: { params: Params }) {
  return getUserContext(req.params.personId)
}

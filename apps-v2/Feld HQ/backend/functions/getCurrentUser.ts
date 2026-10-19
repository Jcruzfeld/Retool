import { getCurrentUser as fetchCurrentUser } from './hq'
import type { CurrentUser } from './types'

type Params = { upn: string }

const DEMO_UPN = 'jcruz@feldinc.com'

export default async function(req: { params: Params }): Promise<CurrentUser | null> {
  const requestedUpn = (req.params.upn ?? '').trim()
  const upn = requestedUpn.length > 0 ? requestedUpn : DEMO_UPN

  return fetchCurrentUser(upn)
}

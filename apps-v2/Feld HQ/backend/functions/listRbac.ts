import { listRbac } from './hq'
import type { RbacSnapshot } from './types'

export default async function(): Promise<RbacSnapshot> {
  return listRbac()
}

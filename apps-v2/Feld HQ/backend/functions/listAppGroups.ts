import { listAppGroups } from './hq'
import type { AppGroup } from './types'

export default async function(): Promise<AppGroup[]> {
  return listAppGroups()
}

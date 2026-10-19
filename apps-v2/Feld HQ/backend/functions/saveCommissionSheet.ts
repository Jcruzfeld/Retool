import { saveCommissionSheet } from './hq'
import type { CommissionSaveResult, CommissionSheetInput } from './types'

type Params = { sheet: CommissionSheetInput }

export default async function(req: { params: Params }): Promise<CommissionSaveResult> {
  return saveCommissionSheet(req.params.sheet)
}

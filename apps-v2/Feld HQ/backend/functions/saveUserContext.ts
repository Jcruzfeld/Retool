import { saveUserContext } from './hq'

type Params = {
  personId: number
  moduleId: number | null
  showStatus: 'active' | 'inactive'
  showYear: string | null
  showGroup: 'fms' | 'legacy' | null
  showCode: string | null
  engagementId: number | null
}

export default async function(req: { params: Params }) {
  const p = req.params

  return saveUserContext(
    p.personId,
    p.moduleId,
    p.showStatus,
    p.showYear,
    p.showGroup,
    p.showCode,
    p.engagementId,
  )
}

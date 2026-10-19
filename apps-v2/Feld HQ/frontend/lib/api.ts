import { useMemo } from 'react'
import {
  useGetCurrentUser,
  useGetEngagement,
  useGetUserContext,
  useListAppGroups,
  useListEngagements,
  useListModules,
  useGetCommissionSheet,
  useListRbac,
  useListShows,
  useListShowYears,
  useSaveCommissionSheet,
  useSaveUserContext,
} from '../hooks/backend/functions'
import type {
  AppGroup,
  CommissionSaveResult,
  CommissionSheet,
  CommissionSheetInput,
  CurrentUser,
  EisContext,
  Engagement,
  Module,
  RbacSnapshot,
  Show,
} from './types'

/** The demo signs in as this person until Entra ID is wired through. */
export const DEMO_UPN = 'jcruz@feldinc.com'

type ShowStatus = EisContext['showStatus']
type ShowGroup = NonNullable<EisContext['showGroup']>

type UserContext = {
  module_id: number | null
  show_status: ShowStatus
  show_year: string | null
  show_group: ShowGroup | null
  show_code: string | null
  tour_id: number | null
  engagement_id: number | null
}

type SaveUserContextResult = { ok: true }

const freshRequestOptions = { skipCache: true } as const
const emptyParams: Record<string, never> = {}

export type ApiClient = {
  listModules: () => Promise<Module[]>
  listAppGroups: () => Promise<AppGroup[]>
  listShowYears: (showStatus: ShowStatus) => Promise<string[]>
  listShows: (showStatus: ShowStatus, year: string, showGroup: ShowGroup) => Promise<Show[]>
  listEngagements: (showCode: string, year: string) => Promise<Engagement[]>
  getEngagement: (engagementId: number) => Promise<Engagement | null>
  getCurrentUser: (upn: string) => Promise<CurrentUser | null>
  getUserContext: (personId: number) => Promise<UserContext | null>
  listRbac: () => Promise<RbacSnapshot>
  getCommissionSheet: (engagementId: number) => Promise<CommissionSheet | null>
  saveCommissionSheet: (sheet: CommissionSheetInput) => Promise<CommissionSaveResult>
  saveUserContext: (
    personId: number,
    moduleId: number | null,
    showStatus: ShowStatus,
    showYear: string | null,
    showGroup: ShowGroup | null,
    showCode: string | null,
    engagementId: number | null,
  ) => Promise<SaveUserContextResult>
}

export function useApi(): ApiClient {
  const { trigger: triggerListModules } = useListModules()
  const { trigger: triggerListAppGroups } = useListAppGroups()
  const { trigger: triggerListShowYears } = useListShowYears()
  const { trigger: triggerListShows } = useListShows()
  const { trigger: triggerListEngagements } = useListEngagements()
  const { trigger: triggerGetEngagement } = useGetEngagement()
  const { trigger: triggerGetCurrentUser } = useGetCurrentUser()
  const { trigger: triggerGetUserContext } = useGetUserContext()
  const { trigger: triggerListRbac } = useListRbac()
  const { trigger: triggerGetCommissionSheet } = useGetCommissionSheet()
  const { trigger: triggerSaveCommissionSheet } = useSaveCommissionSheet()
  const { trigger: triggerSaveUserContext } = useSaveUserContext()

  return useMemo<ApiClient>(
    () => ({
      listModules: () =>
        triggerListModules(emptyParams, freshRequestOptions).result as Promise<Module[]>,
      listAppGroups: () =>
        triggerListAppGroups(emptyParams, freshRequestOptions).result as Promise<AppGroup[]>,
      listShowYears: (showStatus) =>
        triggerListShowYears({ showStatus }, freshRequestOptions).result as Promise<string[]>,
      listShows: (showStatus, year, showGroup) =>
        triggerListShows({ showStatus, year, showGroup }, freshRequestOptions).result as Promise<Show[]>,
      listEngagements: (showCode, year) =>
        triggerListEngagements({ showCode, year }, freshRequestOptions).result as Promise<Engagement[]>,
      getEngagement: (engagementId) =>
        triggerGetEngagement({ engagementId }, freshRequestOptions).result as Promise<Engagement | null>,
      getCurrentUser: (upn) =>
        triggerGetCurrentUser({ upn }, freshRequestOptions).result as Promise<CurrentUser | null>,
      getUserContext: (personId) =>
        triggerGetUserContext({ personId }, freshRequestOptions).result as Promise<UserContext | null>,
      listRbac: () =>
        triggerListRbac(emptyParams, freshRequestOptions).result as Promise<RbacSnapshot>,
      getCommissionSheet: (engagementId) =>
        triggerGetCommissionSheet({ engagementId }, freshRequestOptions)
          .result as Promise<CommissionSheet | null>,
      saveCommissionSheet: (sheet) =>
        triggerSaveCommissionSheet({ sheet }, freshRequestOptions)
          .result as Promise<CommissionSaveResult>,
      saveUserContext: (
        personId,
        moduleId,
        showStatus,
        showYear,
        showGroup,
        showCode,
        engagementId,
      ) =>
        triggerSaveUserContext(
          { personId, moduleId, showStatus, showYear, showGroup, showCode, engagementId },
          freshRequestOptions,
        ).result as Promise<SaveUserContextResult>,
    }),
    [
      triggerGetCommissionSheet,
      triggerGetCurrentUser,
      triggerGetEngagement,
      triggerGetUserContext,
      triggerListAppGroups,
      triggerListEngagements,
      triggerListModules,
      triggerListRbac,
      triggerListShows,
      triggerListShowYears,
      triggerSaveCommissionSheet,
      triggerSaveUserContext,
    ],
  )
}

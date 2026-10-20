import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiClient } from './api'
import type { Engagement, Show } from './types'

/** The EIS cascade.
 *
 *  Filter order is deliberate and was specified in the Event Ops app: broadest
 *  scope first, then year, then progressively narrower —
 *    status -> year -> show group -> show -> engagement.
 *  Do not reorder to match state-key order.
 *
 *  Each level clears everything downstream of it, so the header can never hold a
 *  show that is not routed in the selected year, or an engagement from a show the
 *  user has since changed away from. */
export function useEis(api: ApiClient, initial?: {
  showStatus?: 'active' | 'inactive'
  year?: string | null
  showGroup?: 'fms' | 'legacy' | null
  showCode?: string | null
  engagementId?: number | null
}) {
  const [showStatus, setShowStatusRaw] = useState<'active' | 'inactive'>(initial?.showStatus ?? 'active')
  const [year, setYearRaw] = useState<string | null>(initial?.year ?? null)
  const [showGroup, setShowGroupRaw] = useState<'fms' | 'legacy' | null>(initial?.showGroup ?? null)
  const [showCode, setShowCodeRaw] = useState<string | null>(initial?.showCode ?? null)
  const [engagementId, setEngagementId] = useState<number | null>(initial?.engagementId ?? null)

  const [years, setYears] = useState<string[]>([])
  const [shows, setShows] = useState<Show[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [loading, setLoading] = useState(true)
  // The last EIS query failure, surfaced in the bar instead of leaving the
  // selectors silently empty. Cleared by the next successful read.
  const [error, setError] = useState<string | null>(null)
  const fail = useCallback((what: string, err: unknown) => {
    console.error(`EIS ${what} failed`, err)
    setError(`Could not load ${what} from EIS: ${err instanceof Error ? err.message : String(err)}`)
  }, [])

  // status -> years
  useEffect(() => {
    let cancelled = false
    api.listShowYears(showStatus).then((next) => {
      if (cancelled) return
      setError(null)
      setYears(next)
      // Keep the current year if it survives the status change, else fall back.
      setYearRaw((prev) => (prev && next.includes(prev) ? prev : (next[0] ?? null)))
    }, (err) => {
      if (cancelled) return
      setYears([])
      fail('years', err)
    })
    return () => {
      cancelled = true
    }
  }, [api, showStatus, fail])

  // year + group -> shows
  useEffect(() => {
    let cancelled = false
    if (!year || !showGroup) {
      setShows([])
      return
    }
    api.listShows(showStatus, year, showGroup).then((next) => {
      if (cancelled) return
      setError(null)
      setShows(next)
      setShowCodeRaw((prev) => (prev && next.some((s) => s.show_code === prev) ? prev : null))
    }, (err) => {
      if (cancelled) return
      setShows([])
      fail('shows', err)
    })
    return () => {
      cancelled = true
    }
  }, [api, showStatus, year, showGroup, fail])

  // show + year -> engagements
  useEffect(() => {
    let cancelled = false
    if (!showCode || !year) {
      setEngagements([])
      setLoading(false)
      return
    }
    setLoading(true)
    api.listEngagements(showCode, year).then((next) => {
      if (cancelled) return
      setError(null)
      setEngagements(next)
      setEngagementId((prev) =>
        prev && next.some((e) => e.engagement_id === prev) ? prev : (next[0]?.engagement_id ?? null),
      )
      setLoading(false)
    }, (err) => {
      if (cancelled) return
      setEngagements([])
      setLoading(false)
      fail('engagements', err)
    })
    return () => {
      cancelled = true
    }
  }, [api, showCode, year, fail])

  // Each setter clears what sits below it in the cascade.
  const setShowStatus = useCallback((next: 'active' | 'inactive') => {
    setShowStatusRaw(next)
    setShowGroupRaw(null)
    setShowCodeRaw(null)
    setEngagementId(null)
  }, [])

  const setYear = useCallback((next: string | null) => {
    setYearRaw(next)
    setShowCodeRaw(null)
    setEngagementId(null)
  }, [])

  const setShowGroup = useCallback((next: 'fms' | 'legacy' | null) => {
    setShowGroupRaw(next)
    setShowCodeRaw(null)
    setEngagementId(null)
  }, [])

  const setShowCode = useCallback((next: string | null) => {
    setShowCodeRaw(next)
    setEngagementId(null)
  }, [])

  const engagement = useMemo(
    () => engagements.find((e) => e.engagement_id === engagementId) ?? null,
    [engagements, engagementId],
  )

  const show = useMemo(() => shows.find((s) => s.show_code === showCode) ?? null, [shows, showCode])

  return {
    showStatus,
    year,
    showGroup,
    showCode,
    engagementId,
    years,
    shows,
    engagements,
    engagement,
    show,
    loading,
    error,
    setShowStatus,
    setYear,
    setShowGroup,
    setShowCode,
    setEngagementId,
  }
}

export type EisState = ReturnType<typeof useEis>

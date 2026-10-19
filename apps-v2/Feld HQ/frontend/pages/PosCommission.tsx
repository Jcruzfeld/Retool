import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiClient } from '../lib/api'
import type { CommissionLine, CurrentUser, Engagement } from '../lib/types'

/** POS Commission — a working version of FCP's paper commission sheet.
 *
 *  The layout follows the form: Period From / Period To / Salesperson Name at
 *  the top, the Date / Order # / Client / Amount / Commission % grid in the
 *  middle, and the totals ladder ending in Amount Payable. Unlike the paper
 *  version it saves: one sheet per engagement in fcp_commission_sheet, its rows
 *  in fcp_commission_line.
 *
 *  Totals shown while typing are computed in the browser; the ones shown after a
 *  save come back from v_fcp_commission_totals, so what you end up looking at is
 *  the database's arithmetic, not the form's.
 *
 *  There is deliberately no KPI strip here — the engagement facts already sit in
 *  the EIS bar at the top of the shell. */

const BLANK_ROWS = 4
const DEFAULT_PCT = 12

const money = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function emptyLine(lineNo: number): CommissionLine {
  return { line_no: lineNo, line_date: null, order_no: '', client: '', amount: 0, commission_pct: DEFAULT_PCT }
}

function blankGrid(): CommissionLine[] {
  return Array.from({ length: BLANK_ROWS }, (_, i) => emptyLine(i + 1))
}

export function PosCommission({
  api,
  engagement,
  user,
}: {
  api: ApiClient
  engagement: Engagement | null
  user: CurrentUser | null
}) {
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [salesperson, setSalesperson] = useState('')
  const [lessAdvance, setLessAdvance] = useState(0)
  const [otherDeductions, setOtherDeductions] = useState(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<CommissionLine[]>(blankGrid)
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<null | 'draft' | 'submitted'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const engagementId = engagement?.engagement_id ?? null

  // Load whatever is already saved for this engagement; otherwise start the
  // sheet blank with the period pre-filled from the engagement run.
  useEffect(() => {
    let cancelled = false
    setMessage(null)
    setError(null)
    if (!engagementId || !engagement) {
      setLines(blankGrid())
      return
    }
    setLoading(true)
    api
      .getCommissionSheet(engagementId)
      .then((sheet) => {
        if (cancelled) return
        if (sheet) {
          setPeriodFrom(sheet.period_from?.slice(0, 10) ?? '')
          setPeriodTo(sheet.period_to?.slice(0, 10) ?? '')
          setSalesperson(sheet.salesperson_name ?? '')
          setLessAdvance(Number(sheet.less_advance) || 0)
          setOtherDeductions(Number(sheet.other_deductions) || 0)
          setNotes(sheet.notes ?? '')
          setStatus(sheet.status)
          const saved = sheet.lines.length ? sheet.lines : []
          const padding = Array.from({ length: Math.max(0, BLANK_ROWS - saved.length) }, (_, i) =>
            emptyLine(saved.length + i + 1),
          )
          setLines([...saved, ...padding])
        } else {
          setPeriodFrom(engagement.start_date?.slice(0, 10) ?? '')
          setPeriodTo(engagement.end_date?.slice(0, 10) ?? '')
          setSalesperson('')
          setLessAdvance(0)
          setOtherDeductions(0)
          setNotes('')
          setStatus('draft')
          setLines(blankGrid())
        }
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e?.message ?? e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, engagementId, engagement])

  const updateLine = useCallback((index: number, patch: Partial<CommissionLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
    setMessage(null)
  }, [])

  const addRow = useCallback(() => {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)])
  }, [])

  const removeRow = useCallback((index: number) => {
    setLines((prev) =>
      prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, line_no: i + 1 })),
    )
    setMessage(null)
  }, [])

  const totals = useMemo(() => {
    const totalInvoiced = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    const gross = lines.reduce(
      (sum, l) => sum + ((Number(l.amount) || 0) * (Number(l.commission_pct) || 0)) / 100,
      0,
    )
    return {
      totalInvoiced,
      gross,
      payable: gross - (Number(lessAdvance) || 0) - (Number(otherDeductions) || 0),
    }
  }, [lines, lessAdvance, otherDeductions])

  const save = async (nextStatus: 'draft' | 'submitted') => {
    if (!engagement || !engagementId) return
    setSaving(nextStatus)
    setMessage(null)
    setError(null)
    try {
      const result = await api.saveCommissionSheet({
        engagement_id: engagementId,
        show_code: engagement.show_code,
        tour_year: engagement.tour_year,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        salesperson_name: salesperson || null,
        less_advance: Number(lessAdvance) || 0,
        other_deductions: Number(otherDeductions) || 0,
        notes: notes || null,
        status: nextStatus,
        person_id: user?.person_id ?? null,
        lines,
      })
      setStatus(result.status)
      setMessage(
        nextStatus === 'submitted'
          ? `Submitted. Amount payable ${money(result.amount_payable)}.`
          : `Draft saved. Amount payable ${money(result.amount_payable)}.`,
      )
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setSaving(null)
    }
  }

  if (!engagement) {
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <h2>POS Commission · FCP</h2>
            <p>No engagement selected</p>
          </div>
        </div>
        <div className="panel">
          <div className="placeholder-body">
            <span className="empty-mark" aria-hidden="true">
              ◎
            </span>
            <h3>No engagement selected</h3>
            <p>
              Use the EIS fields above — status, year, show group, show — to pick an engagement. The
              commission sheet is saved against whichever one you select.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>POS Commission · FCP</h2>
          <p>
            {engagement.show_name} — {engagement.city_label}
          </p>
        </div>
        <span className={`soon-chip${status === 'submitted' ? ' submitted' : ''}`}>
          <i aria-hidden="true" />
          {status === 'submitted' ? 'Submitted' : 'Draft'}
        </span>
      </div>

      <div className="panel">
        <div className="comm-sheet">
          <h3 className="comm-title">Commission Sheet</h3>

          <table className="comm-head">
            <tbody>
              <tr>
                <th>Period From</th>
                <td>
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    aria-label="Period from"
                  />
                </td>
              </tr>
              <tr>
                <th>Period To</th>
                <td>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    aria-label="Period to"
                  />
                </td>
              </tr>
              <tr>
                <th>Salesperson Name</th>
                <td>
                  <input
                    type="text"
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value)}
                    placeholder="Full name"
                    aria-label="Salesperson name"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="table-scroll">
            <table className="comm-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order #</th>
                  <th>Client</th>
                  <th className="num">Amount</th>
                  <th className="num">Commission %</th>
                  <th className="num">Commission Amount</th>
                  <th className="rowtools" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={`${line.line_id ?? 'new'}-${i}`}>
                    <td>
                      <input
                        type="date"
                        value={line.line_date?.slice(0, 10) ?? ''}
                        onChange={(e) => updateLine(i, { line_date: e.target.value || null })}
                        aria-label={`Date, row ${i + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.order_no ?? ''}
                        onChange={(e) => updateLine(i, { order_no: e.target.value })}
                        aria-label={`Order number, row ${i + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.client ?? ''}
                        onChange={(e) => updateLine(i, { client: e.target.value })}
                        aria-label={`Client, row ${i + 1}`}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="num"
                        value={line.amount || ''}
                        onChange={(e) => updateLine(i, { amount: Number(e.target.value) })}
                        aria-label={`Amount, row ${i + 1}`}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="num"
                        value={line.commission_pct}
                        onChange={(e) => updateLine(i, { commission_pct: Number(e.target.value) })}
                        aria-label={`Commission percent, row ${i + 1}`}
                      />
                    </td>
                    <td className="num computed">
                      {money(((Number(line.amount) || 0) * (Number(line.commission_pct) || 0)) / 100)}
                    </td>
                    <td className="rowtools">
                      <button
                        type="button"
                        className="row-remove"
                        onClick={() => removeRow(i)}
                        aria-label={`Remove row ${i + 1}`}
                        title="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="spacer" colSpan={3}>
                    <button type="button" className="ghost-btn add-row" onClick={addRow}>
                      + Add line
                    </button>
                  </td>
                  <th colSpan={2}>Total Invoiced</th>
                  <td className="num">{money(totals.totalInvoiced)}</td>
                  <td className="rowtools" />
                </tr>
                <tr>
                  <td className="spacer" colSpan={3} />
                  <th colSpan={2}>Gross Commissions Earned</th>
                  <td className="num">{money(totals.gross)}</td>
                  <td className="rowtools" />
                </tr>
                <tr>
                  <td className="spacer" colSpan={3} />
                  <th colSpan={2}>Less Advance</th>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      value={lessAdvance || ''}
                      onChange={(e) => setLessAdvance(Number(e.target.value))}
                      aria-label="Less advance"
                    />
                  </td>
                  <td className="rowtools" />
                </tr>
                <tr>
                  <td className="spacer" colSpan={3} />
                  <th colSpan={2}>Other Deductions</th>
                  <td className="num">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      value={otherDeductions || ''}
                      onChange={(e) => setOtherDeductions(Number(e.target.value))}
                      aria-label="Other deductions"
                    />
                  </td>
                  <td className="rowtools" />
                </tr>
                <tr className="payable">
                  <td className="spacer" colSpan={3} />
                  <th colSpan={2}>Amount Payable</th>
                  <td className="num">{money(totals.payable)}</td>
                  <td className="rowtools" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="comm-notes">
            <label>
              <span>Notes</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything settlement needs to know about this sheet"
              />
            </label>
          </div>

          <div className="comm-actions">
            <div className="comm-status" role="status">
              {loading ? 'Loading saved sheet…' : null}
              {error ? <span className="err">{error}</span> : null}
              {message && !error ? <span className="ok">{message}</span> : null}
            </div>
            <div className="comm-buttons">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => save('draft')}
                disabled={!!saving || loading}
              >
                {saving === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => save('submitted')}
                disabled={!!saving || loading}
              >
                {saving === 'submitted' ? 'Submitting…' : 'Submit sheet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { formatDate, formatNumber, formatRange } from '../lib/format'
import type { EisState } from '../lib/useEis'

/** The EIS field bar.
 *
 *  Five filters on one row, in the order Event Ops specifies: broadest scope
 *  first, then year, then progressively narrower. Engagement carries the longest
 *  labels ("Salt Lake City, UT · Jan 2, 2026"), so the grid gives it 1.5fr. */
export function EisContextBar({ eis }: { eis: EisState }) {
  const engagement = eis.engagement

  return (
    <section className="event-hero">
      <div className="event-identity">
        <p className="eyebrow">Event context</p>
        <h2>{engagement?.city_label ?? 'Select an engagement'}</h2>
        <p>
          {engagement
            ? `${engagement.show_name} · ${engagement.tour_name} · ${engagement.venue_name ?? 'Venue TBD'}`
            : 'Pick a status, year, show group and show to load the engagements routed for that season.'}
        </p>
      </div>

      <div className="event-controls">
        <label>
          <span>Status</span>
          <select
            value={eis.showStatus}
            onChange={(e) => eis.setShowStatus(e.target.value as 'active' | 'inactive')}
          >
            <option value="active">Active</option>
            <option value="inactive">Non-active</option>
          </select>
        </label>

        <label>
          <span>Year</span>
          <select
            value={eis.year ?? ''}
            onChange={(e) => eis.setYear(e.target.value || null)}
          >
            <option value="">Select year</option>
            {eis.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Show group</span>
          <select
            value={eis.showGroup ?? ''}
            disabled={!eis.year}
            onChange={(e) => eis.setShowGroup((e.target.value || null) as 'fms' | 'legacy' | null)}
          >
            <option value="">{eis.year ? 'Select group' : 'Year first'}</option>
            <option value="fms">FMS</option>
            <option value="legacy">Legacy</option>
          </select>
        </label>

        <label>
          <span>Show</span>
          <select
            value={eis.showCode ?? ''}
            disabled={!eis.showGroup}
            onChange={(e) => eis.setShowCode(e.target.value || null)}
          >
            <option value="">
              {!eis.showGroup
                ? 'Group first'
                : eis.shows.length
                  ? 'Select show'
                  : 'None routed this year'}
            </option>
            {eis.shows.map((show) => (
              <option key={show.show_code} value={show.show_code}>
                {show.show_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Engagement</span>
          <select
            value={eis.engagementId ?? ''}
            disabled={!eis.showCode}
            onChange={(e) => eis.setEngagementId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">
              {!eis.showCode
                ? 'Show first'
                : eis.engagements.length
                  ? 'Select engagement'
                  : 'None found'}
            </option>
            {eis.engagements.map((item) => (
              <option key={item.engagement_id} value={item.engagement_id}>
                {`${item.city_label} · ${formatDate(item.start_date)}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <dl className="event-facts">
        <div>
          <dt>Engagement</dt>
          <dd>{engagement ? `#${engagement.engagement_id}` : '—'}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{engagement ? formatRange(engagement.start_date, engagement.end_date) : '—'}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{engagement?.venue_name ?? '—'}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{formatNumber(engagement?.venue_capacity)}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>{engagement?.contract_status_label ?? engagement?.contract_status ?? '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{engagement?.engagement_status_label ?? engagement?.engagement_status ?? '—'}</dd>
        </div>
      </dl>
    </section>
  )
}

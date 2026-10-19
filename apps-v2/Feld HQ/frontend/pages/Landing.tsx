import type { Engagement } from '../lib/types'

/** What the shell opens on.
 *
 *  Deliberately does NOT preselect an app. The demo starts here and the app is
 *  chosen from the rail, so the first thing on screen explains the two moves the
 *  shell expects: pick an engagement in the EIS fields, pick an app in the rail. */
export function Landing({ engagement }: { engagement: Engagement | null }) {
  return (
    <div className="page">
      <div className="landing">
        <span className="landing-mark" aria-hidden="true" />
        <h2>Welcome to Feld HQ</h2>
        <p className="landing-lede">
          Feld's hub for operational apps. Everything here works against one
          engagement at a time.
        </p>

        <ol className="landing-steps">
          <li className={engagement ? 'done' : ''}>
            <strong>Set your event context</strong>
            <span>
              {engagement
                ? `${engagement.show_name} — ${engagement.city_label}`
                : 'Use the EIS fields above: status, year, show group, show, engagement.'}
            </span>
          </li>
          <li>
            <strong>Pick an app</strong>
            <span>Choose from Admin, Operations or Intelligence in the left rail.</span>
          </li>
        </ol>
      </div>
    </div>
  )
}

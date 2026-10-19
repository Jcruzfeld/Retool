import type { AppEntry } from '../lib/types'

/** Every app without its own screen yet.
 *
 *  Deliberately spare: the app name and "Coming soon", nothing else. Earlier
 *  versions restated the engagement here, which only made the screen look like a
 *  half-built dashboard. The engagement already sits in the EIS bar above. */
export function ModulePlaceholder({ app }: { app: AppEntry }) {
  return (
    <div className="page">
      <div className="coming-soon">
        <h2>{app.name}</h2>
        <span className="soon-chip">
          <i aria-hidden="true" />
          Coming soon
        </span>
      </div>
    </div>
  )
}

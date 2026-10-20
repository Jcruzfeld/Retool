import { useState } from 'react'
import type { AppEntry, AppGroup, Engagement } from '../lib/types'

type Props = {
  groups: AppGroup[]
  loading?: boolean
  activeAppCode: string | null
  engagement: Engagement | null
  onSelectApp: (app: AppEntry) => void
}

/** An app that has no destination yet is rendered the way Event Ops renders its
 *  unfinished nav items: dimmed, non-interactive, with a small pill saying so. */
function isDisabled(app: AppEntry) {
  return app.launch_type === 'placeholder' || app.status === 'planned'
}

function badgeFor(app: AppEntry): string | null {
  if (app.status === 'beta') return 'Beta'
  if (app.status === 'planned') return 'Soon'
  if (app.launch_type === 'placeholder') return 'Soon'
  return null
}

function AppButton({
  app,
  active,
  nested,
  onSelect,
}: {
  app: AppEntry
  active: boolean
  nested?: boolean
  onSelect: (app: AppEntry) => void
}) {
  const disabled = isDisabled(app)
  const badge = badgeFor(app)
  return (
    <button
      type="button"
      className={`nav-item${active ? ' active' : ''}${nested ? ' nested' : ''}`}
      onClick={() => onSelect(app)}
      title={app.description ?? app.name}
      aria-disabled={disabled && app.status !== 'beta' ? true : undefined}
    >
      <span>{app.name}</span>
      {badge ? <small>{badge}</small> : null}
    </button>
  )
}

function Group({
  group,
  activeAppCode,
  onSelectApp,
  defaultOpen,
}: {
  group: AppGroup
  activeAppCode: string | null
  onSelectApp: (app: AppEntry) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="nav-group">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{group.name}</span>
        <span className="caret" aria-hidden="true">
          ▼
        </span>
      </button>
      {open ? (
        <div className="nav-children">
          {group.apps.map((app) => (
            <AppButton
              key={app.app_id}
              app={app}
              active={app.code === activeAppCode}
              onSelect={onSelectApp}
            />
          ))}
          {group.children.map((child) => (
            <div key={child.app_group_id}>
              <Group
                group={child}
                activeAppCode={activeAppCode}
                onSelectApp={onSelectApp}
                defaultOpen={false}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Sidebar({ groups, loading, activeAppCode, engagement, onSelectApp }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-logo" role="img" aria-label="Feld Entertainment" />
        <span className="brand-copy">
          <strong>Feld HQ</strong>
          <small>Operational apps</small>
        </span>
      </div>

      <p className="apps-menu-label">Apps menu</p>
      <nav className="apps-menu" aria-label="Feld HQ applications" aria-busy={loading || undefined}>
        {loading && !groups.length ? <p className="apps-menu-label">Loading apps…</p> : null}
        {groups.map((group, i) => (
          <Group
            key={group.app_group_id}
            group={group}
            activeAppCode={activeAppCode}
            onSelectApp={onSelectApp}
            defaultOpen={i === 0}
          />
        ))}
      </nav>

      <div className="sidebar-context">
        <span>Current engagement</span>
        <strong>{engagement?.city_label ?? 'No engagement selected'}</strong>
        <small>{engagement?.show_name ?? 'Choose one in the header'}</small>
      </div>
    </aside>
  )
}

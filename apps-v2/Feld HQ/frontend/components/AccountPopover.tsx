import { useEffect, useRef, useState } from 'react'
import { initialsOf } from '../lib/format'
import type { CurrentUser } from '../lib/types'

/** The JC bubble in the header. Clicking it opens account details.
 *
 *  Roles come from org_person_role, so this doubles as a quick check of what the
 *  signed-in person is actually entitled to. Once Entra ID is wired through, the
 *  identity block here is what changes — the layout does not. */
export function AccountPopover({ user }: { user: CurrentUser | null }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="account-wrap" ref={wrapRef}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={user?.display_name ?? 'Signed out'}
      >
        {user ? initialsOf(user.display_name) : '—'}
      </button>

      {open ? (
        <div className="account-popover" role="dialog" aria-label="Account details">
          <div className="account-head">
            <span className="avatar lg">{user ? initialsOf(user.display_name) : '—'}</span>
            <div className="account-id">
              <strong>{user?.display_name ?? 'Signed out'}</strong>
              <small>{user?.job_title ?? '—'}</small>
              <small className="muted">{user?.upn ?? '—'}</small>
            </div>
          </div>

          <dl className="account-facts">
            <div>
              <dt>Division</dt>
              <dd>{user?.division_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{user?.department_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Directory</dt>
              <dd>Entra ID · not yet linked</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Retool DB · demo data</dd>
            </div>
          </dl>

          <div className="account-roles">
            <span className="eyebrow">Roles</span>
            <div className="role-chips">
              {user?.roles?.length ? (
                user.roles.map((role) => (
                  <span key={role} className="role-chip">
                    {role}
                  </span>
                ))
              ) : (
                <span className="role-chip muted">No roles granted</span>
              )}
            </div>
          </div>

          <div className="account-actions">
            <button type="button" className="ghost-btn" disabled>
              Manage account
            </button>
            <button type="button" className="ghost-btn" disabled>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

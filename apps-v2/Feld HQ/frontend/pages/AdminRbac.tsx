import { useEffect, useMemo, useState } from 'react'
import type { ApiClient } from '../lib/api'
import type { RbacSnapshot } from '../lib/types'

/** Admin > Admin — role-based access control.
 *
 *  A mock-up in the sense that nothing here is editable yet, but the rows are
 *  real: they come from org_division / org_department / org_person /
 *  org_person_role and hq_app_role. That makes the screen useful as a check that
 *  the Entra ID hierarchy loaded the way it should, rather than a pretty fiction. */
export function AdminRbac({ api }: { api: ApiClient }) {
  const [data, setData] = useState<RbacSnapshot | null>(null)
  const [tab, setTab] = useState<'departments' | 'roles' | 'people'>('departments')

  useEffect(() => {
    let cancelled = false
    api.listRbac().then((snapshot) => {
      if (!cancelled) setData(snapshot)
    })
    return () => {
      cancelled = true
    }
  }, [api])

  // role code -> the apps that role can reach, for the Roles tab.
  const appsByRole = useMemo(() => {
    const map = new Map<string, { app_name: string; access_level: string }[]>()
    for (const e of data?.entitlements ?? []) {
      const list = map.get(e.role_code) ?? []
      list.push({ app_name: e.app_name, access_level: e.access_level })
      map.set(e.role_code, list)
    }
    return map
  }, [data])

  if (!data) {
    return (
      <div className="page">
        <div className="panel">
          <div className="placeholder-body">
            <span className="empty-mark" aria-hidden="true">
              ◎
            </span>
            <h3>Loading access model…</h3>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Admin · IT</h2>
          <p>Role-based access control across divisions, departments and apps</p>
        </div>
        <span className="soon-chip">
          <i aria-hidden="true" />
          Read-only mock · Entra ID not yet linked
        </span>
      </div>

      <div className="metric-grid">
        <div className="mini-metric">
          <span>Departments</span>
          <strong>{data.departments.length}</strong>
          <small>across {new Set(data.departments.map((d) => d.division_name)).size} divisions</small>
        </div>
        <div className="mini-metric">
          <span>Roles</span>
          <strong>{data.roles.length}</strong>
          <small>{data.roles.filter((r) => r.scope_level !== 'global').length} scoped</small>
        </div>
        <div className="mini-metric">
          <span>People</span>
          <strong>{data.people.length}</strong>
          <small>active directory members</small>
        </div>
        <div className="mini-metric">
          <span>Entitlements</span>
          <strong>{data.entitlements.length}</strong>
          <small>role → app grants</small>
        </div>
      </div>

      <div className="subtabs">
        <button type="button" className={tab === 'departments' ? 'active' : ''} onClick={() => setTab('departments')}>
          Departments<span>{data.departments.length}</span>
        </button>
        <button type="button" className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>
          Roles<span>{data.roles.length}</span>
        </button>
        <button type="button" className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          People<span>{data.people.length}</span>
        </button>
      </div>

      {tab === 'departments' ? (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Departments</h3>
              <p>Feld → Division → Department → People, mirroring the Entra ID tree</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="hq-table">
              <thead>
                <tr>
                  <th>Division</th>
                  <th>Department</th>
                  <th>Code</th>
                  <th className="num">Headcount</th>
                  <th>Roles present</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.department_code}>
                    <td>{d.division_name}</td>
                    <td className="strong">{d.department_name}</td>
                    <td className="mono">{d.department_code}</td>
                    <td className="num">{d.headcount}</td>
                    <td>
                      <div className="role-chips">
                        {d.roles.length ? (
                          d.roles.map((r) => (
                            <span key={r} className="role-chip">
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="role-chip muted">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'roles' ? (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Roles and entitlements</h3>
              <p>What each role can reach. Scope determines how far a grant carries.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="hq-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Scope</th>
                  <th className="num">People</th>
                  <th>Apps</th>
                </tr>
              </thead>
              <tbody>
                {data.roles.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <span className="strong">{r.name}</span>
                      <br />
                      <span className="mono subtle">{r.code}</span>
                    </td>
                    <td>
                      <span className="scope-pill">{r.scope_level}</span>
                    </td>
                    <td className="num">{r.people_count}</td>
                    <td>
                      <div className="role-chips">
                        {(appsByRole.get(r.code) ?? []).length ? (
                          (appsByRole.get(r.code) ?? []).map((a) => (
                            <span key={a.app_name} className={`role-chip access-${a.access_level}`}>
                              {a.app_name}
                              <em>{a.access_level}</em>
                            </span>
                          ))
                        ) : (
                          <span className="role-chip muted">No app grants</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'people' ? (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>People</h3>
              <p>Directory members and the roles granted to each</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="hq-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Roles</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.upn}>
                    <td>
                      <span className="strong">{p.display_name}</span>
                      <br />
                      <span className="subtle">{p.upn}</span>
                    </td>
                    <td>{p.job_title ?? '—'}</td>
                    <td>
                      {p.department_name ?? '—'}
                      <br />
                      <span className="subtle">{p.division_name ?? ''}</span>
                    </td>
                    <td>
                      <div className="role-chips">
                        {p.roles.length ? (
                          p.roles.map((r) => (
                            <span key={r} className="role-chip">
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="role-chip muted">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

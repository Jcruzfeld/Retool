/** @jsxRuntime automatic */

import { useEffect, useMemo, useState } from 'react'
import './feldhq.css'
import { AccountPopover } from './components/AccountPopover'
import { EisContextBar } from './components/EisContextBar'
import { Sidebar } from './components/Sidebar'
import { AdminRbac } from './pages/AdminRbac'
import { Landing } from './pages/Landing'
import { ModulePlaceholder } from './pages/ModulePlaceholder'
import { PosCommission } from './pages/PosCommission'
import { DEMO_UPN, useApi } from './lib/api'
import type { ApiClient } from './lib/api'
import type { AppEntry, AppGroup, CurrentUser, Module } from './lib/types'
import { useEis } from './lib/useEis'

export default function App() {
  const api = useApi()
  const [modules, setModules] = useState<Module[]>([])
  const [groups, setGroups] = useState<AppGroup[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeAppCode, setActiveAppCode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [booting, setBooting] = useState(true)
  const [savedContext, setSavedContext] = useState<any>(null)
  const [contextLoaded, setContextLoaded] = useState(false)

  // Boot: nav + identity + the EIS selection this person left off on.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [mods, grps, me] = await Promise.all([
        api.listModules(),
        api.listAppGroups(),
        api.getCurrentUser(DEMO_UPN),
      ])
      if (cancelled) return
      setModules(mods)
      setGroups(grps)
      setUser(me)

      if (me) {
        const ctx = await api.getUserContext(me.person_id)
        if (!cancelled) setSavedContext(ctx)
      }
      if (!cancelled) {
        setContextLoaded(true)
        setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  if (booting || !contextLoaded) {
    return <BootScreen />
  }
  return (
    <Shell
      modules={modules}
      groups={groups}
      user={user}
      savedContext={savedContext}
      api={api}
      activeAppCode={activeAppCode}
      setActiveAppCode={setActiveAppCode}
      search={search}
      setSearch={setSearch}
    />
  )
}

function BootScreen() {
  return (
    <div
      className="boot-screen"
      style={{ display: 'grid', placeContent: 'center', minHeight: '100vh', gap: 10, justifyItems: 'center' }}
    >
      <span style={{ background: '#fc0', borderRadius: 3, height: 34, width: 8 }} />
      <strong
        style={{
          fontFamily: '"Arial Narrow", Arial, sans-serif',
          fontStretch: '75%',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
        }}
      >
        Feld HQ
      </strong>
      <span style={{ color: '#5d5d59', fontSize: 12 }}>Loading apps and EIS context…</span>
    </div>
  )
}

/** Flatten the group tree so an app can be found by code regardless of nesting. */
function flattenApps(groups: AppGroup[]): { app: AppEntry; moduleId: number | null }[] {
  const out: { app: AppEntry; moduleId: number | null }[] = []
  const walk = (group: AppGroup) => {
    for (const app of group.apps) out.push({ app, moduleId: group.module_id })
    for (const child of group.children) walk(child)
  }
  groups.forEach(walk)
  return out
}

/** Split out so the EIS hook can be seeded from the saved context exactly once,
 *  on first render, rather than fought with in an effect. */
function Shell({
  modules,
  groups,
  user,
  savedContext,
  api,
  activeAppCode,
  setActiveAppCode,
  search,
  setSearch,
}: {
  modules: Module[]
  groups: AppGroup[]
  user: CurrentUser | null
  savedContext: any
  api: ApiClient
  activeAppCode: string | null
  setActiveAppCode: (code: string | null) => void
  search: string
  setSearch: (v: string) => void
}) {
  const eis = useEis(api, {
    showStatus: savedContext?.show_status ?? 'active',
    year: savedContext?.show_year ?? null,
    showGroup: savedContext?.show_group ?? null,
    showCode: savedContext?.show_code ?? null,
    engagementId: savedContext?.engagement_id ?? null,
  })

  const allApps = useMemo(() => flattenApps(groups), [groups])

  // Navigation lives entirely in the left rail. Nothing is preselected: the shell
  // opens on the landing screen until the user picks an app there.
  const active = useMemo(
    () => allApps.find((a) => a.app.code === activeAppCode) ?? null,
    [allApps, activeAppCode],
  )

  const activeModule = useMemo(
    () => modules.find((m) => m.module_id === active?.moduleId) ?? null,
    [modules, active],
  )

  // Persist the cascade so the header comes back where the user left it.
  useEffect(() => {
    if (!user) return
    const handle = setTimeout(() => {
      void api.saveUserContext(
        user.person_id,
        activeModule?.module_id ?? null,
        eis.showStatus,
        eis.year,
        eis.showGroup,
        eis.showCode,
        eis.engagementId,
      )
    }, 600)
    return () => clearTimeout(handle)
  }, [api, user, activeModule, eis.showStatus, eis.year, eis.showGroup, eis.showCode, eis.engagementId])

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return groups
    const filterGroup = (group: AppGroup): AppGroup | null => {
      const apps = group.apps.filter(
        (a) =>
          a.name.toLowerCase().includes(needle) ||
          (a.description ?? '').toLowerCase().includes(needle),
      )
      const children = group.children.map(filterGroup).filter(Boolean) as AppGroup[]
      if (!apps.length && !children.length) return null
      return { ...group, apps, children }
    }
    return groups.map(filterGroup).filter(Boolean) as AppGroup[]
  }, [groups, search])

  const renderContent = () => {
    if (!active) return <Landing engagement={eis.engagement} />
    switch (active.app.code) {
      case 'APP_POS_COMMISSION':
        return <PosCommission api={api} engagement={eis.engagement} user={user} />
      case 'APP_ADMIN':
        return <AdminRbac api={api} />
      default:
        return <ModulePlaceholder app={active.app} />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        groups={filteredGroups}
        activeAppCode={active?.app.code ?? null}
        engagement={eis.engagement}
        onSelectApp={(app) => setActiveAppCode(app.code)}
      />

      <section className="workspace">
        <header className="app-header">
          <h1>{active?.app.name ?? 'Feld HQ'}</h1>
          <div className="header-tools">
            <input
              className="header-search"
              type="search"
              placeholder="Search apps…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search apps"
            />
            <span className="env-badge">
              <i aria-hidden="true" />
              EIS live · Domo
            </span>
            <AccountPopover user={user} />
          </div>
        </header>

        <EisContextBar eis={eis} />

        {renderContent()}
      </section>
    </div>
  )
}

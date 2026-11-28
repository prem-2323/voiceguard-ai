import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useWorkflow } from '../contexts/WorkflowContext'
import { PwaInstallButton } from './PwaInstallButton'

const workerLinks = [
  { to: '/worker/home', label: 'Home', icon: LayoutDashboard },
  { to: '/worker/briefing', label: 'Briefing', icon: BookOpenCheck },
  { to: '/worker/hazard', label: 'Report hazard', icon: FileWarning },
]

const supervisorLinks = [
  { to: '/supervisor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/supervisor/workers', label: 'Workers', icon: Users },
  { to: '/supervisor/permits', label: 'Permits', icon: ClipboardList },
  { to: '/supervisor/hazards', label: 'Hazard reports', icon: FileWarning },
  { to: '/supervisor/briefings', label: 'Briefing sessions', icon: BookOpenCheck },
  { to: '/supervisor/assessments', label: 'Assessments', icon: BookOpenCheck },
  { to: '/supervisor/sos', label: 'SOS monitoring', icon: ShieldAlert },
  { to: '/supervisor/instructions', label: 'Safety instructions', icon: ScrollText },
  { to: '/supervisor/audit', label: 'Audit history', icon: Activity },
]

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} aria-label="VoiceGuard AI home">
      <span className="brand-mark">V</span>
      <span>VoiceGuard <span className="brand-light">AI</span></span>
    </Link>
  )
}

export function WorkerLayout() {
  const { workerId, workerName, language } = useWorkflow()
  const languageLabel = { ta: 'தமிழ்', en: 'English', hi: 'हिन्दी' }[language]

  return (
    <div className="worker-shell">
      <header className="worker-header">
        <Brand />
        <div className="worker-header-right">
          <PwaInstallButton />
          {workerId && <span className="worker-identity"><span className="online-dot" />{workerName || workerId}</span>}
          {workerId && <Link className="language-chip" to="/worker/language">{languageLabel}<span aria-hidden="true">⌄</span></Link>}
          <Link to="/worker/sos" className="sos-button"><LifeBuoy size={18} /> SOS <span className="sos-button-caption">Help</span></Link>
        </div>
      </header>
      <nav className="worker-nav" aria-label="Worker navigation">
        {workerId ? workerLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `worker-nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={17} />{label}
          </NavLink>
        )) : <span className="worker-nav-hint">Sign in to see assigned work</span>}
      </nav>
      <main className="worker-content"><Outlet /></main>
      <footer className="worker-footer"><span>VoiceGuard AI · Worker workspace</span><span>Follow site procedures in an actual emergency.</span></footer>
    </div>
  )
}

export function SupervisorLayout() {
  const { supervisorName, supervisorWorkerId, setSupervisorAuthenticated } = useWorkflow()

  return (
    <div className="supervisor-shell">
      <aside className="supervisor-sidebar">
        <Brand inverse />
        <p className="sidebar-kicker">SUPERVISOR CONSOLE</p>
        <nav className="supervisor-nav" aria-label="Supervisor navigation">
          {supervisorLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `supervisor-nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="supervisor-avatar">{(supervisorName || 'SU').slice(0, 2).toUpperCase()}</div>
          <div><strong>{supervisorName || 'Supervisor'}</strong><span>{supervisorWorkerId || 'Account not loaded'}</span></div>
        </div>
      </aside>
      <div className="supervisor-main">
        <header className="supervisor-topbar">
          <div className="mobile-brand"><Brand /></div>
          <PwaInstallButton />
          <span className="demo-banner">Site records</span>
          <button className="topbar-exit" type="button" onClick={() => setSupervisorAuthenticated(false)}>Sign out</button>
        </header>
        <main className="supervisor-content"><Outlet /></main>
      </div>
    </div>
  )
}

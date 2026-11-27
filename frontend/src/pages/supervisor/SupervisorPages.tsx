import { useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  FileWarning,
  LifeBuoy,
  ScrollText,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Badge, EmptyState, PageHeading, Panel } from '../../components/ui'
import { useWorkflow } from '../../contexts/WorkflowContext'

export function SupervisorLoginPage() {
  const navigate = useNavigate()
  const { setSupervisorAuthenticated } = useWorkflow()
  const [supervisorId, setSupervisorId] = useState('SUP-1001')
  const [password, setPassword] = useState('demo123')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSupervisorAuthenticated(true)
    navigate('/supervisor')
  }

  return (
    <div className="supervisor-login-shell">
      <header className="welcome-header"><Link to="/" className="brand"><span className="brand-mark">V</span><span>VoiceGuard <span className="brand-light">AI</span></span></Link><Badge tone="info">Supervisor demo</Badge></header>
      <main className="supervisor-login-main">
        <div className="supervisor-login-art"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><div className="login-art-mark"><ShieldAlert size={42} /></div><p>Human review<br />at every critical step.</p></div>
        <section className="supervisor-login-form">
          <p className="eyebrow">SUPERVISOR ACCESS</p>
          <h1>Welcome to<br />your console.</h1>
          <p className="page-description">Sign in with the fictional supervisor account to preview the monitoring screens.</p>
          <form className="stack-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="supervisor-id">Supervisor ID</label>
            <input id="supervisor-id" className="text-field" value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} required autoComplete="username" />
            <label className="field-label" htmlFor="supervisor-password">Demo password</label>
            <input id="supervisor-password" className="text-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            <p className="field-hint">Preview only · demo authentication is not connected yet.</p>
            <button className="button button-primary button-full" type="submit">Open supervisor console <ArrowRight size={17} /></button>
          </form>
          <Link to="/" className="back-link"><span aria-hidden="true">←</span> Back to workspace selection</Link>
        </section>
      </main>
    </div>
  )
}

const sectionData: Record<string, {
  title: string
  description: string
  icon: typeof Users
  columns: string[]
  rows: string[][]
  emptyTitle: string
  emptyDetail: string
}> = {
  workers: {
    title: 'Worker management',
    description: 'View fictional workers in the current demonstration dataset.',
    icon: Users,
    columns: ['Worker', 'Worker ID', 'Permit', 'Language', 'Status'],
    rows: [['Prem Demo Worker', 'WRK-1001', 'PTW-1001', 'Tamil', 'Demo account']],
    emptyTitle: 'No workers to show',
    emptyDetail: 'Demo workers will appear here when sample records are loaded.',
  },
  permits: {
    title: 'Permit monitoring',
    description: 'Review the fictional permits associated with demo workers.',
    icon: ClipboardList,
    columns: ['Permit', 'Task', 'Location', 'Worker', 'Status'],
    rows: [['PTW-1001', 'Equipment Maintenance', 'Pump House 04', 'WRK-1001', 'Demo active']],
    emptyTitle: 'No permits to show',
    emptyDetail: 'Demo permits will appear here when sample records are loaded.',
  },
  hazards: {
    title: 'Hazard reports',
    description: 'Review worker reports and acknowledge them after review.',
    icon: FileWarning,
    columns: ['Worker', 'Hazard', 'Location', 'Status', 'Received'],
    rows: [],
    emptyTitle: 'No live reports yet',
    emptyDetail: 'Reports will appear here after the worker workflow is connected to the backend.',
  },
  assessments: {
    title: 'Assessment review',
    description: 'Review unclear answers or attempts that need supervisor follow-up.',
    icon: BookOpenCheck,
    columns: ['Worker', 'Permit', 'Question', 'Result', 'Attempts'],
    rows: [],
    emptyTitle: 'No reviews waiting',
    emptyDetail: 'Assessment review items will appear here after approved questions and backend scoring are connected.',
  },
  sos: {
    title: 'SOS monitoring',
    description: 'Monitor simulated SOS events from the demonstration workflow.',
    icon: ShieldAlert,
    columns: ['Worker', 'Permit', 'Event', 'Status', 'Time'],
    rows: [],
    emptyTitle: 'No demo SOS events',
    emptyDetail: 'Simulated events will appear here after SOS workflow integration.',
  },
  instructions: {
    title: 'Safety instructions',
    description: 'Review draft and published content versions for the demonstration.',
    icon: ScrollText,
    columns: ['Instruction', 'Task', 'Language', 'Version', 'Approval'],
    rows: [['Maintenance briefing candidate', 'Equipment Maintenance', 'Tamil', 'Draft', 'Approval required']],
    emptyTitle: 'No instructions to show',
    emptyDetail: 'Versioned instruction records will appear here when content is added.',
  },
  audit: {
    title: 'Audit history',
    description: 'Review supervisor actions and workflow events after integration.',
    icon: Activity,
    columns: ['Time', 'Actor', 'Action', 'Record', 'Details'],
    rows: [],
    emptyTitle: 'No audit entries yet',
    emptyDetail: 'Persisted workflow and supervisor actions will appear here after backend integration.',
  },
}

export function SupervisorOverviewPage() {
  const metrics = [
    { label: 'Demo workers', value: '01', hint: 'Synthetic account', icon: Users },
    { label: 'Active permits', value: '01', hint: 'Sample permit', icon: ClipboardList },
    { label: 'Hazard reports', value: '—', hint: 'Backend not connected', icon: FileWarning },
    { label: 'Reviews waiting', value: '—', hint: 'Backend not connected', icon: BookOpenCheck },
  ]

  return (
    <div>
      <PageHeading eyebrow="SUPERVISOR CONSOLE" title="Overview" description="A clear view of the worker safety workflow." action={<Badge tone="info">Preview data only</Badge>} />
      <div className="metric-grid">
        {metrics.map(({ label, value, hint, icon: Icon }) => <Panel className="metric-card" key={label}><span className="metric-icon"><Icon size={19} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></Panel>)}
      </div>
      <div className="overview-grid">
        <Panel className="overview-panel"><div className="panel-heading"><div><p className="eyebrow">WORKER FLOW</p><h2>Demonstration status</h2></div><Badge tone="neutral">Phase 2 preview</Badge></div><div className="overview-empty"><span className="overview-empty-icon"><Activity size={20} /></span><div><strong>Live workflow data is not connected.</strong><p>This console shows the final screen structure. Reports, assessments, and SOS activity will populate in later phases.</p></div></div></Panel>
        <Panel className="overview-panel quick-links"><div className="panel-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>Review workspace</h2></div></div><Link to="/supervisor/hazards" className="quick-link"><span className="quick-link-icon"><FileWarning size={17} /></span><span><strong>Hazard reports</strong><small>Review and acknowledge</small></span><ArrowRight size={16} /></Link><Link to="/supervisor/assessments" className="quick-link"><span className="quick-link-icon"><BookOpenCheck size={17} /></span><span><strong>Assessment review</strong><small>Follow up unclear answers</small></span><ArrowRight size={16} /></Link><Link to="/supervisor/sos" className="quick-link"><span className="quick-link-icon warm"><LifeBuoy size={17} /></span><span><strong>SOS monitoring</strong><small>Simulated emergency events</small></span><ArrowRight size={16} /></Link></Panel>
      </div>
      <div className="supervisor-safety-note"><ShieldAlert size={17} /><span>All records in this screen are synthetic. This console does not contact emergency services or authorize work.</span></div>
    </div>
  )
}

export function SupervisorSectionPage() {
  const { section } = useParams()
  const data = section ? sectionData[section] : undefined
  if (!data) return <Navigate to="/supervisor" replace />
  const Icon = data.icon

  return (
    <div>
      <PageHeading eyebrow="SUPERVISOR WORKSPACE" title={data.title} description={data.description} action={<span className="section-page-icon"><Icon size={20} /></span>} />
      <Panel className="table-panel">
        <div className="panel-heading"><div><p className="eyebrow">{section === 'instructions' ? 'CONTENT CONTROL' : 'DEMO DATA'}</p><h2>{data.rows.length ? 'Sample records' : 'Workspace queue'}</h2></div><Badge tone={section === 'instructions' ? 'warning' : 'info'}>{section === 'instructions' ? 'Approval required' : 'Preview only'}</Badge></div>
        {data.rows.length ? (
          <div className="table-scroll"><table className="data-table"><thead><tr>{data.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map((row, rowIndex) => <tr key={`${section}-${rowIndex}`}>{row.map((value, index) => <td key={`${section}-${rowIndex}-${index}`} data-label={data.columns[index]}>{index === row.length - 1 ? <Badge tone={section === 'instructions' ? 'warning' : 'neutral'}>{value}</Badge> : value}</td>)}</tr>)}</tbody></table></div>
        ) : (
          <EmptyState icon={<Icon size={22} />} title={data.emptyTitle} detail={data.emptyDetail} />
        )}
      </Panel>
      {section === 'instructions' && <div className="supervisor-safety-note"><ShieldAlert size={17} /><span>Candidate safety content remains draft until a designated reviewer approves the exact wording and translations.</span></div>}
    </div>
  )
}

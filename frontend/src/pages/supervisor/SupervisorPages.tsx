import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import { useLiveUpdates } from '../../services/realtime'
import {
  acknowledgeEmergency,
  acknowledgeHazard,
  ApiError,
  fetchAuditEntries,
  fetchHazards,
  fetchSupervisorAssessments,
  fetchSupervisorBriefings,
  fetchSupervisorEmergencies,
  fetchSupervisorInstructions,
  fetchSupervisorOverview,
  fetchSupervisorPermits,
  fetchSupervisorWorkers,
  loginDemo,
  reviewAssessment,
  type AssessmentReviewRecord,
  type AuditEntry,
  type EmergencyRecord,
  type HazardReport,
  type InstructionRecord,
  type SupervisorOverview,
  type SupervisorBriefing,
  type SupervisorPermit,
  type SupervisorWorker,
} from '../../services/api'

export function SupervisorLoginPage() {
  const navigate = useNavigate()
  const { setSupervisorSession } = useWorkflow()
  const [supervisorId, setSupervisorId] = useState('SUP-1001')
  const [password, setPassword] = useState('demo123')
  const [signingIn, setSigningIn] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSigningIn(true)
    setFormError('')
    try {
      const response = await loginDemo(supervisorId.trim(), password, 'supervisor')
      if (!response.success || !response.data || response.data.user.role !== 'supervisor') throw new Error('The supervisor account was not returned.')
      setSupervisorSession(response.data.user.id, response.data.user.worker_id, response.data.user.name, response.data.access_token)
      navigate('/supervisor')
    } catch (error) {
      setFormError(error instanceof ApiError && error.status === 401
        ? 'Check the demo supervisor ID and password, then try again.'
        : error instanceof ApiError ? error.message : 'The supervisor backend could not be reached. Try again when it is available.')
    } finally {
      setSigningIn(false)
    }
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
          <p className="field-hint">Use the fictional supervisor account. Access is limited to assigned demo workers.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="button button-primary button-full" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Open supervisor console'} <ArrowRight size={17} /></button>
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
}> = {
  workers: {
    title: 'Worker management',
    description: 'View fictional workers in the current demonstration dataset.',
    icon: Users,
  },
  permits: {
    title: 'Permit monitoring',
    description: 'Review the fictional permits associated with demo workers.',
    icon: ClipboardList,
  },
  hazards: {
    title: 'Hazard reports',
    description: 'Review worker reports and acknowledge them after review.',
    icon: FileWarning,
  },
  assessments: {
    title: 'Assessment review',
    description: 'Review unclear answers or attempts that need supervisor follow-up.',
    icon: BookOpenCheck,
  },
  sos: {
    title: 'SOS monitoring',
    description: 'Monitor simulated SOS events from the demonstration workflow.',
    icon: ShieldAlert,
  },
  instructions: {
    title: 'Safety instructions',
    description: 'Review draft and published content versions for the demonstration.',
    icon: ScrollText,
  },
  briefings: {
    title: 'Briefing sessions',
    description: 'Review saved permit-linked briefing sessions and measured completion times.',
    icon: BookOpenCheck,
  },
  audit: {
    title: 'Audit history',
    description: 'Review supervisor actions and workflow events after integration.',
    icon: Activity,
  },
}

function requireData<T>(response: { success: boolean; data: T | null }, label: string): T {
  if (!response.success || response.data === null) throw new Error(`${label} could not be loaded.`)
  return response.data
}

function LiveBadge({ state }: { state: 'connecting' | 'live' | 'polling' | 'offline' }) {
  const label = state === 'live' ? 'Live updates' : state === 'polling' ? 'Polling fallback' : state === 'connecting' ? 'Connecting…' : 'Updates offline'
  const tone = state === 'live' ? 'success' : state === 'polling' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{label}</Badge>
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString()
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`
}

function activityPath(entry: AuditEntry) {
  if (entry.entity_type === 'hazard') return '/supervisor/hazards'
  if (entry.entity_type === 'emergency') return '/supervisor/sos'
  if (entry.entity_type === 'assessment') return '/supervisor/assessments'
  if (entry.entity_type === 'briefing') return '/supervisor/briefings'
  if (entry.entity_type === 'instruction') return '/supervisor/instructions'
  return '/supervisor/audit'
}

function BriefingSessionList({ sessions }: { sessions: SupervisorBriefing[] }) {
  if (sessions.length === 0) return <p className="field-hint">No saved briefing sessions yet.</p>
  return <div className="briefing-session-list">{sessions.map((session) => (
    <details className="briefing-session-detail" key={session.id}>
      <summary>
        <span><strong>Session #{session.id} · {session.worker_name}</strong><small>{session.permit_number} · {session.language.toUpperCase()} · {formatTime(session.started_at)}</small></span>
        <Badge tone={statusTone(session.status)}>{session.status.replaceAll('_', ' ')}</Badge>
      </summary>
      <dl className="supervisor-record-details">
        <div><dt>Instruction</dt><dd>{session.instruction_title} · version {session.instruction_version}</dd></div>
        <div><dt>Permit</dt><dd>{session.permit_number} · {session.permit_id}</dd></div>
        <div><dt>Progress</dt><dd>{session.current_step}%</dd></div>
        <div><dt>Started</dt><dd>{formatTime(session.started_at)}</dd></div>
        <div><dt>Completed</dt><dd>{formatTime(session.completed_at)}</dd></div>
        <div><dt>Completion time</dt><dd>{formatDuration(session.duration_seconds)}</dd></div>
      </dl>
    </details>
  ))}</div>
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'acknowledged' || status === 'completed' || status === 'published' || status === 'correct' || status === 'active') return 'success'
  if (status === 'submitted' || status === 'supervisor_review' || status === 'draft' || status === 'in_progress' || status === 'incorrect' || status === 'unclear') return 'warning'
  if (status === 'closed' || status === 'suspended') return 'danger'
  return 'info'
}

export function SupervisorOverviewPage() {
  const { supervisorAccessToken } = useWorkflow()
  const [overview, setOverview] = useState<SupervisorOverview | null>(null)
  const [activePermits, setActivePermits] = useState(0)
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
  const [recentBriefings, setRecentBriefings] = useState<SupervisorBriefing[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!supervisorAccessToken) return
    try {
      const [summaryResponse, permitResponse, activityResponse, briefingResponse] = await Promise.all([
        fetchSupervisorOverview(supervisorAccessToken),
        fetchSupervisorPermits(supervisorAccessToken),
        fetchAuditEntries(supervisorAccessToken),
        fetchSupervisorBriefings(supervisorAccessToken, 8),
      ])
      const summary = requireData(summaryResponse, 'Supervisor overview')
      const permits = requireData(permitResponse, 'Permit list')
      const activity = requireData(activityResponse, 'Recent activity')
      const briefings = requireData(briefingResponse, 'Briefing sessions')
      setOverview(summary)
      setRecentActivity(activity.slice(0, 6))
      setRecentBriefings(briefings)
      const now = Date.now()
      setActivePermits(permits.filter((permit) => permit.status === 'active'
        && new Date(permit.valid_from).getTime() <= now
        && (!permit.valid_until || new Date(permit.valid_until).getTime() >= now)).length)
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The supervisor overview could not be refreshed.')
    }
  }, [supervisorAccessToken])
  const connectionState = useLiveUpdates(supervisorAccessToken, refresh)

  useEffect(() => { void refresh() }, [refresh])

  const metrics = [
    { label: 'Assigned workers', value: overview ? String(overview.assigned_workers).padStart(2, '0') : '—', hint: 'Fictional accounts', icon: Users },
    { label: 'Active permits', value: overview ? String(activePermits).padStart(2, '0') : '—', hint: 'Currently in validity window', icon: ClipboardList },
    { label: 'Open hazard reports', value: overview ? String(overview.open_hazards).padStart(2, '0') : '—', hint: 'Awaiting acknowledgement', icon: FileWarning },
    { label: 'Reviews / SOS', value: overview ? `${overview.pending_assessments} / ${overview.open_simulated_sos}` : '—', hint: 'Supervisor attention', icon: BookOpenCheck },
    { label: 'Briefings completed', value: overview ? String(overview.completed_briefings) : '—', hint: 'Saved completed sessions', icon: Activity },
    { label: 'Average completion', value: overview ? formatDuration(overview.average_completion_seconds) : '—', hint: overview?.average_completion_seconds === null ? 'No completed sessions yet' : 'Calculated from saved timestamps', icon: ClipboardList },
  ]

  return (
    <div>
      <PageHeading eyebrow="SUPERVISOR CONSOLE" title="Overview" description="Current activity for workers assigned to this demo supervisor." action={<LiveBadge state={connectionState} />} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="metric-grid">
        {metrics.map(({ label, value, hint, icon: Icon }) => <Panel className="metric-card" key={label}><span className="metric-icon"><Icon size={19} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></Panel>)}
      </div>
      <Panel className="assessment-outcomes-panel">
        <div className="panel-heading"><div><p className="eyebrow">LATEST SAVED ANSWER PER QUESTION</p><h2>Assessment outcomes</h2></div><Badge tone="info">Assigned demo workers</Badge></div>
        <div className="assessment-outcome-strip">
          <span data-outcome="correct">Correct <strong>{overview?.correct_assessments ?? '—'}</strong></span>
          <span data-outcome="incorrect">Incorrect <strong>{overview?.incorrect_assessments ?? '—'}</strong></span>
          <span data-outcome="unclear">Unclear <strong>{overview?.unclear_assessments ?? '—'}</strong></span>
          <span data-outcome="assistance">Assistance required <strong>{overview?.assistance_required ?? '—'}</strong></span>
        </div>
      </Panel>
      <div className="overview-grid">
        <Panel className="overview-panel"><div className="panel-heading"><div><p className="eyebrow">WORKER FLOW</p><h2>Review queues</h2></div><Badge tone={overview ? 'success' : 'neutral'}>{overview ? 'Connected' : 'Loading'}</Badge></div><div className="overview-empty"><span className="overview-empty-icon"><Activity size={20} /></span><div><strong>Supervisor actions are recorded.</strong><p>Hazard reports, unresolved assessments, simulated SOS events, acknowledgements, and audit history are stored in the demo database.</p></div></div></Panel>
        <Panel className="overview-panel quick-links"><div className="panel-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>Review workspace</h2></div></div><Link to="/supervisor/hazards" className="quick-link"><span className="quick-link-icon"><FileWarning size={17} /></span><span><strong>Hazard reports</strong><small>Review and acknowledge</small></span><ArrowRight size={16} /></Link><Link to="/supervisor/assessments" className="quick-link"><span className="quick-link-icon"><BookOpenCheck size={17} /></span><span><strong>Assessment review</strong><small>Follow up unresolved attempts</small></span><ArrowRight size={16} /></Link><Link to="/supervisor/sos" className="quick-link"><span className="quick-link-icon warm"><LifeBuoy size={17} /></span><span><strong>SOS monitoring</strong><small>Simulated events only</small></span><ArrowRight size={16} /></Link></Panel>
      </div>
      <div className="overview-detail-grid">
        <Panel className="overview-panel recent-activity-panel">
          <div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>{recentActivity.length} saved event{recentActivity.length === 1 ? '' : 's'}</h2></div><Link to="/supervisor/audit" className="inline-action-link">Open audit history <ArrowRight size={14} /></Link></div>
          {recentActivity.length ? <div className="recent-activity-list">{recentActivity.map((entry) => <Link className="recent-activity-link" to={activityPath(entry)} key={entry.id}><span><strong>{entry.action.replaceAll('_', ' ')}</strong><small>{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''} · {formatTime(entry.created_at)}</small></span><ArrowRight size={16} /></Link>)}</div> : <p className="field-hint">No saved activity is available yet.</p>}
          <p className="field-hint">Activity links open the matching saved record queue. All records shown are fictional demo data.</p>
        </Panel>
        <Panel className="overview-panel recent-briefings-panel">
          <div className="panel-heading"><div><p className="eyebrow">SESSION HISTORY</p><h2>Recent briefing sessions</h2></div><Link to="/supervisor/briefings" className="inline-action-link">View all <ArrowRight size={14} /></Link></div>
          <BriefingSessionList sessions={recentBriefings} />
        </Panel>
      </div>
      <div className="supervisor-safety-note"><ShieldAlert size={17} /><span>All records in this screen are synthetic. This console does not contact emergency services or authorize work.</span></div>
    </div>
  )
}

export function SupervisorSectionPage() {
  const { section } = useParams()
  const data = section ? sectionData[section] : undefined
  const { supervisorAccessToken, supervisorRecordId, supervisorName } = useWorkflow()
  const [workers, setWorkers] = useState<SupervisorWorker[]>([])
  const [permits, setPermits] = useState<SupervisorPermit[]>([])
  const [hazards, setHazards] = useState<HazardReport[]>([])
  const [assessments, setAssessments] = useState<AssessmentReviewRecord[]>([])
  const [emergencies, setEmergencies] = useState<EmergencyRecord[]>([])
  const [briefingSessions, setBriefingSessions] = useState<SupervisorBriefing[]>([])
  const [instructions, setInstructions] = useState<InstructionRecord[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const loadSection = useCallback(async (showLoading = false) => {
    if (!supervisorAccessToken || !section) return
    if (showLoading) setLoading(true)
    try {
      if (section === 'workers') {
        setWorkers(requireData(await fetchSupervisorWorkers(supervisorAccessToken), 'Workers'))
      } else if (section === 'permits') {
        const [permitResponse, workerResponse] = await Promise.all([fetchSupervisorPermits(supervisorAccessToken), fetchSupervisorWorkers(supervisorAccessToken)])
        setPermits(requireData(permitResponse, 'Permits'))
        setWorkers(requireData(workerResponse, 'Workers'))
      } else if (section === 'hazards') {
        const [hazardResponse, workerResponse, permitResponse] = await Promise.all([fetchHazards(supervisorAccessToken), fetchSupervisorWorkers(supervisorAccessToken), fetchSupervisorPermits(supervisorAccessToken)])
        setHazards(requireData(hazardResponse, 'Hazard reports'))
        setWorkers(requireData(workerResponse, 'Workers'))
        setPermits(requireData(permitResponse, 'Permits'))
      } else if (section === 'assessments') {
        const [assessmentResponse, workerResponse, permitResponse] = await Promise.all([fetchSupervisorAssessments(supervisorAccessToken, true), fetchSupervisorWorkers(supervisorAccessToken), fetchSupervisorPermits(supervisorAccessToken)])
        setAssessments(requireData(assessmentResponse, 'Assessment queue'))
        setWorkers(requireData(workerResponse, 'Workers'))
        setPermits(requireData(permitResponse, 'Permits'))
      } else if (section === 'sos') {
        const [emergencyResponse, workerResponse, permitResponse] = await Promise.all([fetchSupervisorEmergencies(supervisorAccessToken), fetchSupervisorWorkers(supervisorAccessToken), fetchSupervisorPermits(supervisorAccessToken)])
        setEmergencies(requireData(emergencyResponse, 'Simulated SOS records'))
        setWorkers(requireData(workerResponse, 'Workers'))
        setPermits(requireData(permitResponse, 'Permits'))
      } else if (section === 'briefings') {
        setBriefingSessions(requireData(await fetchSupervisorBriefings(supervisorAccessToken, 100), 'Briefing sessions'))
      } else if (section === 'instructions') {
        setInstructions(requireData(await fetchSupervisorInstructions(supervisorAccessToken), 'Safety instructions'))
      } else if (section === 'audit') {
        setAuditEntries(requireData(await fetchAuditEntries(supervisorAccessToken), 'Audit history'))
      }
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'This workspace could not be refreshed.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [section, supervisorAccessToken])

  const refresh = useCallback(() => { void loadSection(false) }, [loadSection])
  const connectionState = useLiveUpdates(supervisorAccessToken, refresh)

  useEffect(() => { void loadSection(true) }, [loadSection])

  if (!data) return <Navigate to="/supervisor" replace />

  const workerName = (workerId: number) => workers.find((worker) => worker.id === workerId)?.name ?? `Worker #${workerId}`
  const permitNumber = (permitId: number | null) => permitId === null ? 'No permit' : permits.find((permit) => permit.id === permitId)?.permit_number ?? `Permit #${permitId}`

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setActionMessage('')
    setActionError('')
    try {
      await action()
      setActionMessage('Saved. The worker-facing status will update after refresh.')
      await loadSection(false)
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'The action could not be saved. Check the connection and retry.')
    } finally {
      setBusyKey('')
    }
  }

  const Icon = data.icon
  return (
    <div>
      <PageHeading eyebrow="SUPERVISOR WORKSPACE" title={data.title} description={data.description} action={<span className="section-page-icon"><Icon size={20} /></span>} />
      <div className="section-live-state"><LiveBadge state={connectionState} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {actionMessage && <p className="inline-note" role="status">{actionMessage}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {loading ? <Panel><p className="field-hint">Loading assigned records…</p></Panel> : (
        <>
          {section === 'workers' && <Panel className="table-panel"><div className="panel-heading"><div><p className="eyebrow">ASSIGNED ACCOUNTS</p><h2>{workers.length} worker{workers.length === 1 ? '' : 's'}</h2></div><Badge tone="info">Fictional demo data</Badge></div>{workers.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Worker</th><th>Worker ID</th><th>Language</th><th>Account</th><th>Added</th></tr></thead><tbody>{workers.map((worker) => <tr key={worker.id}><td data-label="Worker">{worker.name}</td><td data-label="Worker ID">{worker.worker_id}</td><td data-label="Language">{worker.preferred_language}</td><td data-label="Account"><Badge tone={worker.is_active ? 'success' : 'warning'}>{worker.is_active ? 'Active' : 'Inactive'}</Badge></td><td data-label="Added">{formatTime(worker.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Users size={22} />} title="No assigned workers" detail="Workers assigned to this supervisor will appear here." />}</Panel>}

          {section === 'permits' && <Panel className="table-panel"><div className="panel-heading"><div><p className="eyebrow">ASSIGNED PERMITS</p><h2>{permits.length} permit{permits.length === 1 ? '' : 's'}</h2></div><Badge tone="info">Read only</Badge></div>{permits.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Permit</th><th>Task</th><th>Location</th><th>Worker</th><th>Status</th><th>Valid until</th></tr></thead><tbody>{permits.map((permit) => <tr key={permit.id}><td data-label="Permit">{permit.permit_number}</td><td data-label="Task">{permit.task_type}</td><td data-label="Location">{permit.work_location}</td><td data-label="Worker">{workerName(permit.worker_id)}</td><td data-label="Status"><Badge tone={statusTone(permit.status)}>{permit.status}</Badge></td><td data-label="Valid until">{formatTime(permit.valid_until)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<ClipboardList size={22} />} title="No permits found" detail="Permits assigned to this supervisor's demo workers will appear here." />}</Panel>}

          {section === 'hazards' && <div className="supervisor-record-list">{hazards.length ? hazards.map((hazard) => <Panel className="supervisor-record-card" key={hazard.id}><div className="supervisor-record-header"><div><p className="eyebrow">REPORT #{hazard.id} · {workerName(hazard.worker_id)}</p><h2>{hazard.category.replaceAll('_', ' ')}</h2></div><Badge tone={statusTone(hazard.status)}>{hazard.status}</Badge></div><dl className="supervisor-record-details"><div><dt>Permit</dt><dd>{permitNumber(hazard.permit_id)}</dd></div><div><dt>Location</dt><dd>{hazard.location}</dd></div><div><dt>Description</dt><dd>{hazard.description}</dd></div><div><dt>Voice transcript</dt><dd>{hazard.transcript || 'Text report'}</dd></div><div><dt>Received</dt><dd>{formatTime(hazard.created_at)}</dd></div>{hazard.acknowledged_at && <div><dt>Acknowledged</dt><dd>{formatTime(hazard.acknowledged_at)}</dd></div>}</dl>{hazard.status === 'submitted' && <div className="supervisor-action-form"><label className="field-label" htmlFor={`hazard-note-${hazard.id}`}>Optional acknowledgement note</label><textarea id={`hazard-note-${hazard.id}`} className="text-field text-area" value={notes[`hazard-${hazard.id}`] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [`hazard-${hazard.id}`]: event.target.value }))} maxLength={2000} placeholder="Add a note for the audit trail" /><button className="button button-primary" type="button" disabled={busyKey === `hazard-${hazard.id}`} onClick={() => void runAction(`hazard-${hazard.id}`, async () => { const response = await acknowledgeHazard(hazard.id, supervisorAccessToken, notes[`hazard-${hazard.id}`]); setHazards((current) => current.map((item) => item.id === hazard.id ? requireData(response, 'Acknowledgement') : item)) })}>{busyKey === `hazard-${hazard.id}` ? 'Saving…' : 'Acknowledge report'}</button></div>}<p className="field-hint">Acknowledgement records receipt. It does not mean the hazard has been fixed or the permit cleared.</p></Panel>) : <Panel><EmptyState icon={<FileWarning size={22} />} title="No hazard reports" detail="Confirmed reports from assigned workers will appear here." /></Panel>}</div>}

          {section === 'assessments' && <div className="supervisor-record-list">{assessments.length ? assessments.map((assessment) => <Panel className="supervisor-record-card" key={assessment.id}><div className="supervisor-record-header"><div><p className="eyebrow">SESSION #{assessment.session_id} · {workerName(assessment.worker_id)}</p><h2>{assessment.question}</h2></div><Badge tone={statusTone(assessment.result)}>{assessment.result} · {assessment.attempt_count}/3</Badge></div><dl className="supervisor-record-details"><div><dt>Permit</dt><dd>{permitNumber(assessment.permit_id)}</dd></div><div><dt>Worker answer</dt><dd>{assessment.worker_answer || 'No answer understood'}</dd></div><div><dt>Approved answer</dt><dd>{assessment.expected_answer}</dd></div>{assessment.acceptable_answers.length > 0 && <div><dt>Accepted variants</dt><dd>{assessment.acceptable_answers.join(' · ')}</dd></div>}<div><dt>Recorded</dt><dd>{formatTime(assessment.created_at)}</dd></div></dl><div className="supervisor-action-form"><label className="field-label" htmlFor={`assessment-note-${assessment.id}`}>Review note</label><textarea id={`assessment-note-${assessment.id}`} className="text-field text-area" value={notes[`assessment-${assessment.id}`] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [`assessment-${assessment.id}`]: event.target.value }))} maxLength={2000} placeholder="Record the review outcome or follow-up needed" /><button className="button button-primary" type="button" disabled={busyKey === `assessment-${assessment.id}`} onClick={() => void runAction(`assessment-${assessment.id}`, async () => { const response = await reviewAssessment(assessment.id, notes[`assessment-${assessment.id}`] ?? '', supervisorAccessToken); requireData(response, 'Review') })}>{busyKey === `assessment-${assessment.id}` ? 'Saving…' : 'Record review'}</button></div><p className="field-hint">Reviewing this item does not pass the assessment or authorize work. The session remains on hold.</p></Panel>) : <Panel><EmptyState icon={<BookOpenCheck size={22} />} title="No assessment reviews waiting" detail="A worker's third incorrect or unclear answer appears here for supervisor review." /></Panel>}</div>}

          {section === 'sos' && <div className="supervisor-record-list">{emergencies.length ? emergencies.map((emergency) => <Panel className="supervisor-record-card" key={emergency.id}><div className="supervisor-record-header"><div><p className="eyebrow">SIMULATED EVENT #{emergency.id} · {workerName(emergency.worker_id)}</p><h2>{emergency.emergency_type.toUpperCase()}</h2></div><Badge tone={statusTone(emergency.status)}>{emergency.status}</Badge></div><dl className="supervisor-record-details"><div><dt>Permit</dt><dd>{permitNumber(emergency.permit_id)}</dd></div><div><dt>Location</dt><dd>{emergency.location || 'Not provided'}</dd></div><div><dt>Received</dt><dd>{formatTime(emergency.created_at)}</dd></div>{emergency.acknowledged_at && <div><dt>Acknowledged</dt><dd>{formatTime(emergency.acknowledged_at)}</dd></div>}</dl>{emergency.status === 'submitted' && <button className="button button-primary" type="button" disabled={busyKey === `sos-${emergency.id}`} onClick={() => void runAction(`sos-${emergency.id}`, async () => { const response = await acknowledgeEmergency(emergency.id, supervisorAccessToken); setEmergencies((current) => current.map((item) => item.id === emergency.id ? requireData(response, 'SOS acknowledgement') : item)) })}>{busyKey === `sos-${emergency.id}` ? 'Saving…' : 'Acknowledge simulated event'}</button>}<p className="field-hint">Simulation only. No emergency call or dispatch was placed.</p></Panel>) : <Panel><EmptyState icon={<LifeBuoy size={22} />} title="No simulated SOS events" detail="Worker-created demo events will appear here." /></Panel>}</div>}

          {section === 'briefings' && <Panel className="table-panel"><div className="panel-heading"><div><p className="eyebrow">PERMIT-LINKED SESSIONS</p><h2>{briefingSessions.length} saved session{briefingSessions.length === 1 ? '' : 's'}</h2></div><Badge tone="info">Fictional demo data</Badge></div><BriefingSessionList sessions={briefingSessions} /></Panel>}

          {section === 'instructions' && <Panel className="table-panel"><div className="panel-heading"><div><p className="eyebrow">ASSIGNED TASK CONTENT</p><h2>{instructions.length} version{instructions.length === 1 ? '' : 's'}</h2></div><Badge tone="warning">Approval gated</Badge></div>{instructions.length ? <div className="supervisor-record-list">{instructions.map((instruction) => <article className="instruction-record" key={instruction.id}><div className="supervisor-record-header"><div><p className="eyebrow">{instruction.language.toUpperCase()} · VERSION {instruction.version}</p><h2>{instruction.title}</h2></div><Badge tone={statusTone(instruction.approval_status)}>{instruction.approval_status}</Badge></div><p>{instruction.task_type}</p><div className="instruction-record-content">{instruction.content}</div><small>{instruction.questions.length} question{instruction.questions.length === 1 ? '' : 's'} · created {formatTime(instruction.created_at)}</small></article>)}</div> : <EmptyState icon={<ScrollText size={22} />} title="No instructions available" detail="Versioned content for assigned workers will appear here." />}<div className="supervisor-safety-note"><ShieldAlert size={17} /><span>Draft or approved content is not shown to workers. Only published, supervisor-approved versions can start a briefing.</span></div></Panel>}

          {section === 'audit' && <Panel className="table-panel"><div className="panel-heading"><div><p className="eyebrow">ASSIGNED WORKER ACTIVITY</p><h2>{auditEntries.length} recent entries</h2></div><Badge tone="info">Audit log</Badge></div>{auditEntries.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id}><td data-label="Time">{formatTime(entry.created_at)}</td><td data-label="Actor">{entry.user_id === null ? 'System' : entry.user_id === supervisorRecordId ? supervisorName : workerName(entry.user_id)}</td><td data-label="Action">{entry.action.replaceAll('_', ' ')}</td><td data-label="Record">{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}</td><td data-label="Details">{Object.keys(entry.details).length ? JSON.stringify(entry.details) : '—'}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Activity size={22} />} title="No audit entries yet" detail="Workflow and supervisor actions will appear here after they are recorded." />}</Panel>}
        </>
      )}
      <div className="supervisor-safety-note"><ShieldAlert size={17} /><span>All records are synthetic. The console does not contact emergency services, clear permits, or authorize work.</span></div>
    </div>
  )
}

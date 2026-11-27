import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileWarning,
  Languages,
  LifeBuoy,
  Mic,
  ShieldAlert,
  Volume2,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Badge, PageHeading, Panel, StepLabel } from '../../components/ui'
import { useWorkflow, type LanguageCode } from '../../contexts/WorkflowContext'

const languageOptions: { code: LanguageCode; label: string; native: string; locale: string }[] = [
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', locale: 'ta-IN' },
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
]

export function WorkerLoginPage() {
  const navigate = useNavigate()
  const { workerId: savedId, workerName: savedName, setWorker } = useWorkflow()
  const [workerId, setWorkerId] = useState(savedId || 'WRK-1001')
  const [workerName, setWorkerName] = useState(savedName || 'Prem Demo Worker')
  const [password, setPassword] = useState('demo123')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorker(workerId.trim(), workerName.trim())
    navigate('/worker/permit')
  }

  return (
    <div className="narrow-page">
      <StepLabel step={1} total={7} label="Worker identification" />
      <PageHeading eyebrow="WORKER ACCESS" title="Welcome back." description="Sign in with the fictional worker profile to preview the safety journey." />
      <Panel className="form-panel">
        <div className="panel-topline"><span className="panel-icon"><CircleHelp size={19} /></span><Badge tone="info">Demo login</Badge></div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="worker-id">Worker ID</label>
          <input id="worker-id" className="text-field" value={workerId} onChange={(event) => setWorkerId(event.target.value)} required autoComplete="username" />
          <label className="field-label" htmlFor="worker-name">Display name</label>
          <input id="worker-name" className="text-field" value={workerName} onChange={(event) => setWorkerName(event.target.value)} required />
          <label className="field-label" htmlFor="worker-password">Demo password</label>
          <input id="worker-password" className="text-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          <p className="field-hint">Preview only · authentication is not connected yet.</p>
          <button className="button button-primary button-full" type="submit">Continue <ArrowRight size={17} /></button>
        </form>
      </Panel>
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to workspace selection</Link>
    </div>
  )
}

export function PermitPage() {
  const navigate = useNavigate()
  const { permitId, setPermit } = useWorkflow()

  function choosePermit() {
    setPermit('PTW-1001')
    navigate('/worker/language')
  }

  return (
    <div className="narrow-page">
      <StepLabel step={2} total={7} label="Select permit" />
      <PageHeading eyebrow="YOUR ACTIVE WORK" title="Choose a permit." description="Only permits assigned to your demo worker appear here." />
      <button className={`permit-card ${permitId === 'PTW-1001' ? 'selected' : ''}`} onClick={choosePermit} type="button">
        <div className="permit-card-top"><Badge tone="success">Active</Badge><span className="permit-number">PTW-1001</span></div>
        <h2>Equipment Maintenance</h2>
        <div className="permit-details"><span>Location</span><strong>Pump House 04</strong><span>Worker</span><strong>WRK-1001 · Prem Demo Worker</strong></div>
        <span className="permit-select"><span>Select this permit</span><ArrowRight size={17} /></span>
      </button>
      <p className="privacy-note"><ShieldAlert size={15} /> Demo permit only · not valid for real work.</p>
      <Link to="/worker/login" className="back-link"><ArrowLeft size={16} /> Change worker</Link>
    </div>
  )
}

export function LanguagePage() {
  const navigate = useNavigate()
  const { language, setLanguage } = useWorkflow()

  return (
    <div className="narrow-page">
      <StepLabel step={3} total={7} label="Choose language" />
      <PageHeading eyebrow="LANGUAGE" title="Choose your language." description="Voice and written prompts will use this language where your device supports it." />
      <div className="language-grid" role="radiogroup" aria-label="Choose a language">
        {languageOptions.map((option) => (
          <button key={option.code} type="button" role="radio" aria-checked={language === option.code} className={`language-card ${language === option.code ? 'selected' : ''}`} onClick={() => setLanguage(option.code)}>
            <span className="language-native">{option.native}</span>
            <span className="language-label">{option.label}</span>
            <span className="language-locale">Speech locale · {option.locale}</span>
            {language === option.code && <Check size={18} className="language-check" />}
          </button>
        ))}
      </div>
      <div className="inline-note"><Languages size={17} /><span>If voice recognition is unavailable, the app will keep text entry available.</span></div>
      <button className="button button-primary button-full" type="button" onClick={() => { setLanguage(language); navigate('/worker/home') }}>Continue to worker home <ArrowRight size={17} /></button>
      <Link to="/worker/permit" className="back-link"><ArrowLeft size={16} /> Back to permit</Link>
    </div>
  )
}

export function WorkerHomePage() {
  const { workerName, workerId, permitId, language, reportPreviewed } = useWorkflow()
  const firstName = workerName.split(' ')[0] || 'Worker'

  return (
    <div className="worker-home-page">
      <div className="home-welcome-row">
        <div>
          <p className="eyebrow">WORKER HOME · {workerId}</p>
          <h1>Good day, {firstName}.</h1>
          <p className="page-description">Your safety journey starts with the instructions linked to your active work permit.</p>
        </div>
        <div className="language-summary"><Languages size={16} />{languageOptions.find((item) => item.code === language)?.label}</div>
      </div>

      <Panel className="active-permit-panel">
        <div className="active-permit-icon"><ClipboardCheck size={20} /></div>
        <div className="active-permit-copy"><span>ACTIVE DEMO PERMIT</span><strong>{permitId || 'PTW-1001'} · Equipment Maintenance</strong><small>Pump House 04</small></div>
        <Badge tone="success">Active</Badge>
      </Panel>

      <div className="journey-heading"><div><p className="eyebrow">YOUR CHECKLIST</p><h2>Before work begins</h2></div><span className="checklist-count">{reportPreviewed ? '1 of 3' : '0 of 3'} steps previewed</span></div>
      <div className="journey-cards">
        <Link to="/worker/briefing" className="journey-card">
          <span className="journey-card-icon"><BookOpenCheck size={21} /></span><span className="journey-card-copy"><strong>Safety briefing</strong><small>Read the approved instructions for this task.</small></span><ArrowRight size={18} className="journey-arrow" />
        </Link>
        <Link to="/worker/assessment" className="journey-card">
          <span className="journey-card-icon warm"><CircleHelp size={21} /></span><span className="journey-card-copy"><strong>Understanding check</strong><small>Answer a short question in your own words.</small></span><ArrowRight size={18} className="journey-arrow" />
        </Link>
        <Link to="/worker/hazard" className="journey-card">
          <span className="journey-card-icon orange"><FileWarning size={21} /></span><span className="journey-card-copy"><strong>Report a hazard</strong><small>Share a concern by voice or text.</small></span><ArrowRight size={18} className="journey-arrow" />
        </Link>
      </div>
      <div className="safety-reminder"><ShieldAlert size={17} /><span>For an actual emergency, follow your site's emergency procedures immediately.</span></div>
    </div>
  )
}

export function BriefingPage() {
  const { language } = useWorkflow()
  const [previewing, setPreviewing] = useState(false)

  return (
    <div className="narrow-page">
      <StepLabel step={4} total={7} label="Safety briefing" />
      <PageHeading eyebrow="PTW-1001 · EQUIPMENT MAINTENANCE" title="Your safety briefing." description="This screen will present the published instruction for your task." />
      <Panel className="briefing-panel">
        <div className="briefing-panel-header"><div className="panel-icon"><BookOpenCheck size={20} /></div><div><strong>Task-specific instruction</strong><span>Language · {languageOptions.find((item) => item.code === language)?.label}</span></div><Badge tone="warning">Awaiting approval</Badge></div>
        <div className="approval-notice"><ShieldAlert size={19} /><div><strong>Approved content is not published yet.</strong><p>This preview contains no operational safety instructions. Reviewed site content will appear here when it is approved.</p></div></div>
        <div className={`voice-preview ${previewing ? 'is-previewing' : ''}`}>
          <button type="button" className="voice-preview-button" aria-label="Preview the listening state" onClick={() => setPreviewing((value) => !value)}><Volume2 size={20} /></button>
          <div><strong>{previewing ? 'Speaking state preview' : 'Voice playback preview'}</strong><span>Speech output will be connected in the voice-engine phase.</span></div>
          <span className="voice-state-dot" />
        </div>
        <div className="briefing-footer-note">Text remains visible if speech output is unavailable.</div>
      </Panel>
      <div className="action-row"><Link className="button button-secondary" to="/worker/home"><ArrowLeft size={16} /> Home</Link><Link className="button button-primary" to="/worker/assessment">Continue <ArrowRight size={17} /></Link></div>
    </div>
  )
}

export function AssessmentPage() {
  const { language } = useWorkflow()
  return (
    <div className="narrow-page">
      <StepLabel step={5} total={7} label="Understanding check" />
      <PageHeading eyebrow="ASSESSMENT" title="Check your understanding." description="Questions and scoring will use approved, versioned content." />
      <Panel className="assessment-preview-panel">
        <div className="assessment-preview-icon"><CircleHelp size={24} /></div>
        <Badge tone="warning">Question set pending approval</Badge>
        <h2>No approved question is available yet.</h2>
        <p>This screen preview will show one question at a time, accept a spoken or typed answer, and ask for supervisor review when the answer is unclear.</p>
        <div className="assessment-metadata"><span>Selected language</span><strong>{languageOptions.find((item) => item.code === language)?.label}</strong><span>Attempts available</span><strong>Up to 3</strong></div>
      </Panel>
      <div className="action-row"><Link className="button button-secondary" to="/worker/briefing"><ArrowLeft size={16} /> Briefing</Link><Link className="button button-primary" to="/worker/hazard">Continue to hazard report <ArrowRight size={17} /></Link></div>
    </div>
  )
}

export function HazardReportPage() {
  const navigate = useNavigate()
  const { hazardDraft, updateHazardDraft } = useWorkflow()
  const [voicePreview, setVoicePreview] = useState(false)
  const [formError, setFormError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!hazardDraft.category || !hazardDraft.location.trim() || !hazardDraft.description.trim()) {
      setFormError('Choose a category and add a location and description before reviewing.')
      return
    }
    setFormError('')
    navigate('/worker/hazard/confirmation')
  }

  return (
    <div className="narrow-page">
      <StepLabel step={6} total={7} label="Report a hazard" />
      <PageHeading eyebrow="HAZARD REPORT" title="What did you notice?" description="Use voice or text. Review the details before a report is submitted." />
      <Panel className="hazard-form-panel">
        <div className="voice-capture-preview">
          <button type="button" className={`mic-button ${voicePreview ? 'mic-preview-active' : ''}`} aria-label="Preview voice capture state" aria-pressed={voicePreview} onClick={() => setVoicePreview((value) => !value)}><Mic size={27} /></button>
          <div className="mic-copy"><strong>{voicePreview ? 'Listening state preview' : 'Voice capture preview'}</strong><span>{voicePreview ? 'No microphone is active in this screen preview.' : 'Voice capture will be connected in the voice-engine phase.'}</span></div>
          <span className={`recording-indicator ${voicePreview ? 'active' : ''}`} />
        </div>
        <div className="form-divider"><span>OR ENTER DETAILS</span></div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="hazard-category">Hazard category</label>
          <select id="hazard-category" className="text-field" value={hazardDraft.category} onChange={(event) => updateHazardDraft({ category: event.target.value })} required>
            <option value="">Choose a category</option>
            <option value="oil_leak">Oil leak</option>
            <option value="gas_alarm">Gas alarm</option>
            <option value="unsafe_scaffold">Unsafe scaffold</option>
            <option value="other">Other / unsure</option>
          </select>
          <label className="field-label" htmlFor="hazard-location">Location</label>
          <input id="hazard-location" className="text-field" value={hazardDraft.location} onChange={(event) => updateHazardDraft({ location: event.target.value })} placeholder="For example, Pump 4" required />
          <label className="field-label" htmlFor="hazard-description">Describe what you noticed</label>
          <textarea id="hazard-description" className="text-field text-area" value={hazardDraft.description} onChange={(event) => updateHazardDraft({ description: event.target.value })} placeholder="Share only what you observed. You can add details in your own words." required />
          <p className="field-hint">If a detail is uncertain, say so. The app will ask you to confirm the report.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="button button-primary button-full" type="submit">Review report details <ArrowRight size={17} /></button>
        </form>
      </Panel>
      <p className="privacy-note"><ShieldAlert size={15} /> This screen is a UI preview. The report will not be saved until backend integration is added.</p>
    </div>
  )
}

export function HazardConfirmationPage() {
  const navigate = useNavigate()
  const { hazardDraft, setReportPreviewed } = useWorkflow()
  if (!hazardDraft.category || !hazardDraft.location || !hazardDraft.description) return <Navigate to="/worker/hazard" replace />

  const categoryLabel = {
    oil_leak: 'Oil leak',
    gas_alarm: 'Gas alarm',
    unsafe_scaffold: 'Unsafe scaffold',
    other: 'Other / unsure',
  }[hazardDraft.category] || hazardDraft.category

  return (
    <div className="narrow-page">
      <StepLabel step={7} total={7} label="Confirm details" />
      <PageHeading eyebrow="REVIEW BEFORE SUBMITTING" title="Does this look right?" description="Check the category and location before the report is sent." />
      <Panel className="confirmation-panel">
        <div className="confirmation-title"><span className="confirm-icon"><CheckCircle2 size={21} /></span><div><strong>Hazard report draft</strong><span>Permit PTW-1001 · Worker WRK-1001</span></div><Badge tone="warning">Preview only</Badge></div>
        <dl className="confirmation-list"><div><dt>Category</dt><dd>{categoryLabel}</dd></div><div><dt>Location</dt><dd>{hazardDraft.location}</dd></div><div><dt>Description</dt><dd>{hazardDraft.description}</dd></div></dl>
        <div className="preview-warning"><ShieldAlert size={17} /><span>This review stays in this browser. It is not saved or sent to a supervisor in Phase 2.</span></div>
      </Panel>
      <div className="action-row"><Link className="button button-secondary" to="/worker/hazard"><ArrowLeft size={16} /> Edit details</Link><button className="button button-primary" type="button" onClick={() => { setReportPreviewed(true); navigate('/worker/home') }}>Finish screen preview <Check size={17} /></button></div>
    </div>
  )
}

export function WorkerSosPage() {
  const { workerId, sosPreviewed, setSosPreviewed } = useWorkflow()
  return (
    <div className="narrow-page sos-page">
      <PageHeading eyebrow="EMERGENCY SUPPORT" title="SOS preview." description="The SOS control is designed to stay available throughout the worker journey." />
      <Panel className="sos-panel">
        <div className="sos-emblem"><LifeBuoy size={34} /></div>
        <Badge tone="danger">Simulation only</Badge>
        <h2>{sosPreviewed ? 'Demo SOS preview is active.' : 'Use site emergency procedures now.'}</h2>
        <p>This prototype does not contact emergency services or site responders. For an actual emergency, follow your site's emergency procedure immediately.</p>
        {!workerId && <p className="form-error">Sign in to preview an SOS linked to a demo worker.</p>}
        <button className="button button-danger button-full" type="button" disabled={!workerId} onClick={() => setSosPreviewed(true)}>
          <ShieldAlert size={18} />{sosPreviewed ? 'Preview active · not sent' : 'Preview simulated SOS'}
        </button>
        {sosPreviewed && <div className="inline-note"><CheckCircle2 size={17} /><span>Local screen preview only · no alert was sent or stored.</span></div>}
      </Panel>
      <Link className="back-link" to={workerId ? '/worker/home' : '/worker/login'}><ArrowLeft size={16} /> Return to worker journey</Link>
    </div>
  )
}

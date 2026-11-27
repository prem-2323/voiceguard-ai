import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  MicOff,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Badge, PageHeading, Panel, StepLabel } from '../../components/ui'
import { VoiceCapture, VoicePlayback } from '../../components/voice/VoiceControls'
import { VoiceCommandPanel } from '../../components/voice/VoiceCommandPanel'
import { useWorkflow, type HazardDraft, type LanguageCode } from '../../contexts/WorkflowContext'
import { useSpeechRecognition } from '../../services/speech'
import {
  ApiError,
  createHazardReport,
  fetchBriefingAssessments,
  fetchBriefingSession,
  fetchCurrentBriefing,
  fetchPublishedInstructions,
  fetchWorkerPermits,
  interpretVoice,
  loginDemo,
  saveBriefingProgress,
  submitAssessmentAnswer,
  startBriefing,
  type AssessmentResult,
  type BriefingBundle,
  type HazardReport,
  type IntelligenceResult,
  type PublishedInstruction,
  type WorkerPermit,
} from '../../services/api'

const languageOptions: { code: LanguageCode; label: string; native: string; locale: string }[] = [
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', locale: 'ta-IN' },
  { code: 'en', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', locale: 'hi-IN' },
]

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function WorkerLoginPage() {
  const navigate = useNavigate()
  const { workerId: savedId, workerName: savedName, setWorker } = useWorkflow()
  const [workerId, setWorkerId] = useState(savedId || 'WRK-1001')
  const [workerName, setWorkerName] = useState(savedName || 'Prem Demo Worker')
  const [password, setPassword] = useState('demo123')
  const [formError, setFormError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSigningIn(true)
    try {
      const response = await loginDemo(workerId.trim(), password)
      if (!response.success || !response.data) throw new Error('The demo login did not return an account.')
      setWorker(response.data.user.worker_id, response.data.user.name, response.data.access_token)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError('Check the demo worker ID and password, then try again.')
        setSigningIn(false)
        return
      }
      setWorker(workerId.trim(), workerName.trim())
    }
    navigate('/worker/permit')
    setSigningIn(false)
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
          <p className="field-hint">Use the fictional demo account. Browser voice can run locally; Whisper needs a signed-in backend.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="button button-primary button-full" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Continue'} <ArrowRight size={17} /></button>
        </form>
      </Panel>
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to workspace selection</Link>
    </div>
  )
}

export function PermitPage() {
  const navigate = useNavigate()
  const { permitId, workerAccessToken, workerId: savedWorkerId, workerName: savedName, setPermit } = useWorkflow()
  const [permits, setPermits] = useState<WorkerPermit[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')

  useEffect(() => {
    let mounted = true
    if (!workerAccessToken) {
      setLoadState('offline')
      return () => { mounted = false }
    }
    setLoadState('loading')
    void fetchWorkerPermits(workerAccessToken)
      .then((response) => {
        if (!response.success || !response.data) throw new Error('Permit list could not be loaded.')
        if (mounted) {
          setPermits(response.data)
          setLoadState('ready')
        }
      })
      .catch(() => {
        if (mounted) setLoadState('error')
      })
    return () => { mounted = false }
  }, [workerAccessToken])

  function choosePermit(permitNumber: string, recordId: number | null, taskType: string, workLocation: string) {
    setPermit(permitNumber, recordId, taskType, workLocation)
    navigate('/worker/language')
  }

  return (
    <div className="narrow-page">
      <StepLabel step={2} total={7} label="Select permit" />
      <PageHeading eyebrow="YOUR ACTIVE WORK" title="Choose a permit." description="Only permits assigned to your demo worker appear here." />
      {loadState === 'loading' && <Panel><p className="field-hint">Loading active permits assigned to this worker…</p></Panel>}
      {loadState === 'ready' && permits.length === 0 && <Panel><p className="field-hint">No active permits are assigned to this demo worker.</p></Panel>}
      {loadState === 'ready' && permits.map((permit) => (
        <button key={permit.id} className={`permit-card ${permitId === permit.permit_number ? 'selected' : ''}`} onClick={() => choosePermit(permit.permit_number, permit.id, permit.task_type, permit.work_location)} type="button">
          <div className="permit-card-top"><Badge tone="success">Active</Badge><span className="permit-number">{permit.permit_number}</span></div>
          <h2>{permit.task_type}</h2>
          <div className="permit-details"><span>Location</span><strong>{permit.work_location}</strong><span>Worker</span><strong>{savedName || savedWorkerId}</strong></div>
          <span className="permit-select"><span>Select this permit</span><ArrowRight size={17} /></span>
        </button>
      ))}
      {(loadState === 'offline' || loadState === 'error') && (
        <>
          {loadState === 'error' && <p className="form-error" role="alert">The backend could not load permits. You can continue with the local demo preview; briefing progress will not be saved.</p>}
          <button className={`permit-card ${permitId === 'PTW-1001' ? 'selected' : ''}`} onClick={() => choosePermit('PTW-1001', null, 'Equipment Maintenance', 'Pump House 04')} type="button">
            <div className="permit-card-top"><Badge tone="warning">Preview only</Badge><span className="permit-number">PTW-1001</span></div>
            <h2>Equipment Maintenance</h2>
            <div className="permit-details"><span>Location</span><strong>Pump House 04</strong><span>Worker</span><strong>WRK-1001 · Prem Demo Worker</strong></div>
            <span className="permit-select"><span>Continue in local preview</span><ArrowRight size={17} /></span>
          </button>
          {loadState === 'offline' && <p className="privacy-note"><ShieldAlert size={15} /> Demo permit preview only · not valid for work and not connected to a saved briefing.</p>}
        </>
      )}
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
  const { workerName, workerId, permitId, permitTaskType, permitLocation, language, reportPreviewed } = useWorkflow()
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
        <div className="active-permit-copy"><span>ACTIVE DEMO PERMIT</span><strong>{permitId || 'PTW-1001'} · {permitTaskType || 'Equipment Maintenance'}</strong><small>{permitLocation || 'Pump House 04'}</small></div>
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
  const { language, workerAccessToken, permitId, permitRecordId, permitTaskType, permitLocation } = useWorkflow()
  const [instruction, setInstruction] = useState<PublishedInstruction | null>(null)
  const [briefing, setBriefing] = useState<BriefingBundle | null>(null)
  const [instructionState, setInstructionState] = useState<'loading' | 'available' | 'missing' | 'preview' | 'error'>('loading')
  const [savingState, setSavingState] = useState<'idle' | 'starting' | 'saving' | 'completing'>('idle')
  const [actionError, setActionError] = useState('')
  const voiceLocale = languageOptions.find((item) => item.code === language)?.locale ?? 'ta-IN'
  const statusText = {
    ta: 'மேற்பார்வையாளர் அங்கீகரித்து வெளியிட்ட பிறகே பாதுகாப்பு வழிமுறைகள் காட்டப்படும். அங்கீகரிக்கப்படாத வழிமுறைகள் காட்டப்படாது.',
    en: 'Safety instructions are shown only after supervisor approval and publication. Unapproved instructions are not shown.',
    hi: 'सुरक्षा निर्देश केवल सुपरवाइज़र की मंज़ूरी और प्रकाशन के बाद दिखाए जाते हैं। बिना मंज़ूरी वाले निर्देश नहीं दिखाए जाते।',
  }[language]

  async function beginBriefing() {
    if (!workerAccessToken || permitRecordId === null) return
    setActionError('')
    setSavingState('starting')
    try {
      const response = await startBriefing(permitRecordId, language, workerAccessToken)
      if (!response.success || !response.data) throw new Error('The briefing could not be started.')
      setBriefing(response.data)
      setInstruction(response.data.instruction)
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'The briefing could not be started. Ask the supervisor to check the published content.')
    } finally {
      setSavingState('idle')
    }
  }

  async function saveProgress(reviewed: boolean) {
    if (!workerAccessToken || !briefing) return
    setActionError('')
    setSavingState(reviewed ? 'completing' : 'saving')
    try {
      const currentStep = reviewed ? 100 : Math.max(briefing.briefing.current_step, 1)
      const response = await saveBriefingProgress(briefing.briefing.id, currentStep, reviewed, workerAccessToken)
      if (!response.success || !response.data) throw new Error('Progress could not be saved.')
      setBriefing({ ...briefing, briefing: response.data })
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Progress could not be saved. Check your connection and try again.')
    } finally {
      setSavingState('idle')
    }
  }

  useEffect(() => {
    let mounted = true
    setInstruction(null)
    setBriefing(null)
    if (!workerAccessToken || permitRecordId === null) {
      setInstructionState('preview')
      return () => { mounted = false }
    }
    setInstructionState('loading')
    void (async () => {
      try {
        const currentResponse = await fetchCurrentBriefing(permitRecordId, language, workerAccessToken)
        if (!currentResponse.success) throw new Error('Saved briefing could not be loaded.')
        if (currentResponse.data) {
          if (mounted) {
            setBriefing(currentResponse.data)
            setInstruction(currentResponse.data.instruction)
            setInstructionState('available')
          }
          return
        }
        const instructionResponse = await fetchPublishedInstructions(permitRecordId, language, workerAccessToken)
        if (!instructionResponse.success || !instructionResponse.data) throw new Error('Instructions could not be loaded.')
        const latest = [...instructionResponse.data].sort((left, right) => right.version - left.version)[0] ?? null
        if (mounted) {
          setInstruction(latest)
          setInstructionState(latest ? 'available' : 'missing')
        }
      } catch {
        if (mounted) setInstructionState('error')
      }
    })()
    return () => { mounted = false }
  }, [language, permitRecordId, workerAccessToken])

  const instructionNotices: Record<LanguageCode, Record<typeof instructionState, string>> = {
    en: {
      loading: 'Checking for a published instruction linked to this permit and language…',
      available: 'This text is the published instruction for your active permit and selected language.',
      missing: 'No published instruction is available for this permit and language. Ask the supervisor for review.',
      preview: 'Sign in through the backend and select an assigned permit to load and save an approved briefing.',
      error: 'Approved content could not be loaded. Use the visible controls or ask the supervisor; no substitute instruction was created.',
    },
    ta: {
      loading: 'இந்த அனுமதி மற்றும் மொழிக்கான வெளியிடப்பட்ட வழிமுறை உள்ளதா எனச் சரிபார்க்கப்படுகிறது…',
      available: 'இந்த உரை உங்கள் செயலில் உள்ள அனுமதி மற்றும் தேர்ந்தெடுத்த மொழிக்கான வெளியிடப்பட்ட வழிமுறை.',
      missing: 'இந்த அனுமதி மற்றும் மொழிக்கான வெளியிடப்பட்ட வழிமுறை இல்லை. மேற்பார்வையாளரிடம் மதிப்பாய்வு கேளுங்கள்.',
      preview: 'அங்கீகரிக்கப்பட்ட வழிமுறையை ஏற்றி சேமிக்க பின்புற சேவையில் உள்நுழைந்து ஒதுக்கப்பட்ட அனுமதியைத் தேர்ந்தெடுக்கவும்.',
      error: 'அங்கீகரிக்கப்பட்ட உள்ளடக்கத்தை ஏற்ற முடியவில்லை. திரைக் கட்டுப்பாடுகளைப் பயன்படுத்தவும் அல்லது மேற்பார்வையாளரிடம் கேளுங்கள்.',
    },
    hi: {
      loading: 'इस परमिट और भाषा से जुड़ा प्रकाशित निर्देश खोजा जा रहा है…',
      available: 'यह आपके सक्रिय परमिट और चुनी गई भाषा का प्रकाशित निर्देश है।',
      missing: 'इस परमिट और भाषा के लिए कोई प्रकाशित निर्देश नहीं है। समीक्षा के लिए सुपरवाइज़र से पूछें।',
      preview: 'स्वीकृत निर्देश लोड करने और प्रगति सहेजने के लिए बैकएंड में साइन इन करें और अपना परमिट चुनें।',
      error: 'स्वीकृत सामग्री लोड नहीं हो सकी। स्क्रीन के विकल्प इस्तेमाल करें या सुपरवाइज़र से पूछें।',
    },
  }

  return (
    <div className="narrow-page">
      <StepLabel step={4} total={7} label="Safety briefing" />
      <PageHeading eyebrow={`${permitId || 'NO PERMIT'} · ${permitTaskType || 'TASK BRIEFING'}`} title="Your safety briefing." description={`Approved task instructions for ${permitLocation || 'your selected work location'} are checked in your selected language.`} />
      <Panel className="briefing-panel">
        <div className="briefing-panel-header"><div className="panel-icon"><BookOpenCheck size={20} /></div><div><strong>{instruction?.title ?? 'Task-specific instruction'}</strong><span>Language · {languageOptions.find((item) => item.code === language)?.label}{instruction ? ` · version ${instruction.version}` : ''}</span></div><Badge tone={instruction ? 'success' : 'warning'}>{briefing?.briefing.status === 'completed' ? 'Assessment complete' : briefing?.briefing.status === 'supervisor_review' ? 'Supervisor review' : briefing ? briefing.briefing.current_step >= 100 ? 'Reviewed' : briefing.briefing.current_step > 0 ? 'In progress' : 'Started' : instruction ? 'Published' : 'Approval gate active'}</Badge></div>
        {instruction ? (
          <div className="published-content-preview instruction-content"><strong>Published safety instruction · v{instruction.version}</strong><p>{instruction.content}</p></div>
        ) : (
          <div className="approval-notice"><ShieldAlert size={19} /><div><strong>Safety content stays behind the approval gate.</strong><p>{instructionNotices[language][instructionState]}</p></div></div>
        )}
        <VoicePlayback text={instruction?.content ?? statusText} locale={voiceLocale} />
        <div className="briefing-footer-note">Text remains visible if speech output is unavailable.</div>
        {instruction && !briefing && instructionState === 'available' && (
          <button className="button button-primary button-full" type="button" onClick={() => void beginBriefing()} disabled={savingState !== 'idle'}>
            {savingState === 'starting' ? 'Starting briefing…' : 'Start saved briefing'} <ArrowRight size={17} />
          </button>
        )}
        {briefing && briefing.briefing.status !== 'completed' && briefing.briefing.status !== 'supervisor_review' && (
          <div className="briefing-progress-actions">
            <p className="field-hint">{briefing.briefing.current_step >= 100 ? 'Your review is saved. The understanding check can continue from this published version.' : briefing.briefing.current_step > 0 ? 'Your reading session is saved. Review the instruction, then mark it reviewed.' : 'This briefing is saved. You can leave and return to continue reading later.'}</p>
            <div className="action-row">
              <button className="button button-secondary" type="button" onClick={() => void saveProgress(false)} disabled={savingState !== 'idle' || briefing.briefing.current_step >= 100}>
                {savingState === 'saving' ? 'Saving…' : 'Save reading progress'}
              </button>
              <button className="button button-primary" type="button" onClick={() => void saveProgress(true)} disabled={savingState !== 'idle' || briefing.briefing.current_step >= 100}>
                {savingState === 'completing' ? 'Saving review…' : briefing.briefing.current_step >= 100 ? 'Review saved' : 'Mark instruction reviewed'} <CheckCircle2 size={17} />
              </button>
            </div>
          </div>
        )}
        {briefing?.briefing.status === 'supervisor_review' && <p className="form-error" role="status">This briefing is waiting for supervisor review. Check with your supervisor before continuing.</p>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
      </Panel>
      <VoiceCommandPanel locale={voiceLocale} language={language} accessToken={workerAccessToken} permitNumber={permitId} briefingSessionId={briefing?.briefing.id} />
      <div className="action-row"><Link className="button button-secondary" to="/worker/home"><ArrowLeft size={16} /> Home</Link>{briefing?.briefing.current_step === 100 ? <Link className="button button-primary" to="/worker/assessment">Continue to understanding check <ArrowRight size={17} /></Link> : <Link className="button button-secondary" to="/worker/permit">Change permit</Link>}</div>
    </div>
  )
}

export function AssessmentPage() {
  const { language, permitRecordId, workerAccessToken } = useWorkflow()
  const [briefing, setBriefing] = useState<BriefingBundle | null>(null)
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'preview' | 'noBriefing' | 'error'>('loading')
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState<AssessmentResult['result'] | null>(null)
  const voiceLocale = languageOptions.find((item) => item.code === language)?.locale ?? 'ta-IN'
  const handleTranscript = useCallback((transcript: string) => {
    setAnswer((current) => [current.trim(), transcript].filter(Boolean).join(' '))
    setFormError('')
  }, [])
  const { supported, listening, interimTranscript, error: speechError, start, stop } = useSpeechRecognition(voiceLocale, handleTranscript)

  useEffect(() => {
    let mounted = true
    setBriefing(null)
    setResults([])
    setAnswer('')
    setFeedback(null)
    setFormError('')
    if (!workerAccessToken || permitRecordId === null) {
      setLoadState('preview')
      return () => { mounted = false }
    }
    setLoadState('loading')
    void (async () => {
      try {
        const currentResponse = await fetchCurrentBriefing(permitRecordId, language, workerAccessToken)
        if (!currentResponse.success) throw new Error('The briefing could not be loaded.')
        if (!currentResponse.data) {
          if (mounted) setLoadState('noBriefing')
          return
        }
        const assessmentResponse = await fetchBriefingAssessments(currentResponse.data.briefing.id, workerAccessToken)
        if (!assessmentResponse.success || !assessmentResponse.data) throw new Error('Assessment progress could not be loaded.')
        if (mounted) {
          setBriefing(currentResponse.data)
          setResults(assessmentResponse.data)
          setLoadState('ready')
        }
      } catch {
        if (mounted) setLoadState('error')
      }
    })()
    return () => { mounted = false }
  }, [language, permitRecordId, workerAccessToken])

  async function sendAnswer(unsure = false) {
    if (!workerAccessToken || !briefing) return
    const question = briefing.instruction.questions.find((item) => !results.some((result) => result.question_id === item.id && result.result === 'correct'))
    if (!question) return
    const submittedAnswer = unsure ? '' : answer.trim()
    if (!unsure && !submittedAnswer) {
      setFormError('Enter an answer or choose “I’m not sure” to ask for help.')
      return
    }
    setSubmitting(true)
    setFormError('')
    setFeedback(null)
    try {
      const response = await submitAssessmentAnswer(briefing.briefing.id, question.id, submittedAnswer, workerAccessToken)
      if (!response.success || !response.data) throw new Error('The answer was not recorded.')
      const submitted = response.data
      setResults((current) => [submitted, ...current.filter((item) => item.id !== submitted.id)])
      setFeedback(submitted.result)
      if (submitted.result !== 'incorrect') setAnswer('')
      try {
        const sessionResponse = await fetchBriefingSession(briefing.briefing.id, workerAccessToken)
        if (sessionResponse.success && sessionResponse.data) setBriefing(sessionResponse.data)
      } catch {
        // The saved answer remains visible even if refreshing the session status fails.
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The answer could not be saved. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const latestByQuestion = new Map<number, AssessmentResult>()
  for (const result of results) {
    const previous = latestByQuestion.get(result.question_id)
    if (!previous || result.attempt_count > previous.attempt_count) latestByQuestion.set(result.question_id, result)
  }
  const questions = briefing?.instruction.questions ?? []
  const currentQuestionIndex = questions.findIndex((question) => latestByQuestion.get(question.id)?.result !== 'correct')
  const currentQuestion = currentQuestionIndex >= 0 ? questions[currentQuestionIndex] : null
  const currentQuestionResult = currentQuestion ? latestByQuestion.get(currentQuestion.id) : undefined
  const attemptsUsed = currentQuestionResult?.attempt_count ?? 0
  const completedCount = questions.filter((question) => latestByQuestion.get(question.id)?.result === 'correct').length
  const assessmentComplete = briefing?.briefing.status === 'completed' || (questions.length > 0 && completedCount === questions.length)
  const supervisorReview = briefing?.briefing.status === 'supervisor_review'

  return (
    <div className="narrow-page">
      <StepLabel step={5} total={7} label="Understanding check" />
      <PageHeading eyebrow="ASSESSMENT" title="Check your understanding." description="Answer questions from the approved briefing by voice or text." />
      <Panel className="assessment-preview-panel">
        <div className="assessment-preview-icon"><CircleHelp size={24} /></div>
        <Badge tone={assessmentComplete ? 'success' : supervisorReview ? 'warning' : 'info'}>{assessmentComplete ? 'Assessment complete' : supervisorReview ? 'Supervisor review required' : 'Approved question check'}</Badge>
        <div className="assessment-metadata"><span>Selected language</span><strong>{languageOptions.find((item) => item.code === language)?.label}</strong>{briefing && <><span>Questions passed</span><strong>{completedCount} of {questions.length}</strong></>}</div>
        {loadState === 'loading' && <p role="status">Loading the saved briefing and assessment progress…</p>}
        {loadState === 'preview' && <div className="approval-notice"><ShieldAlert size={19} /><div><strong>Sign in and select an assigned permit first.</strong><p>Assessment questions are shown only from a saved, published briefing. Offline preview cannot submit or save answers.</p></div></div>}
        {loadState === 'noBriefing' && <div className="approval-notice"><ShieldAlert size={19} /><div><strong>No saved briefing is available.</strong><p>Open the assigned permit’s safety briefing, read the approved instruction, and mark it reviewed before starting this check.</p></div></div>}
        {loadState === 'error' && <p className="form-error" role="alert">The saved briefing or assessment progress could not be loaded. Check the backend connection and try again.</p>}
        {loadState === 'ready' && briefing && briefing.briefing.current_step < 100 && <div className="approval-notice"><ShieldAlert size={19} /><div><strong>Review the instruction before the assessment.</strong><p>Return to the briefing and mark it reviewed. Your saved reading progress is still available.</p></div></div>}
        {loadState === 'ready' && questions.length === 0 && <div className="approval-notice"><ShieldAlert size={19} /><div><strong>No approved assessment question is available.</strong><p>Ask the supervisor to review and publish a question for this briefing.</p></div></div>}
        {loadState === 'ready' && supervisorReview && <div className="approval-notice"><ShieldAlert size={19} /><div><strong>A supervisor needs to review this assessment.</strong><p>Three attempts were used without an accepted answer. Pause here and ask your supervisor to review the result.</p></div></div>}
        {loadState === 'ready' && assessmentComplete && <div className="assessment-success"><CheckCircle2 size={21} /><div><strong>All approved questions were answered correctly.</strong><p>Your assessment result has been saved with the briefing.</p></div></div>}
        {loadState === 'ready' && !assessmentComplete && !supervisorReview && briefing && briefing.briefing.current_step >= 100 && currentQuestion && (
          <>
            <div className="assessment-question-card">
              <div className="assessment-question-heading"><span>Question {currentQuestionIndex + 1} of {questions.length}</span><Badge tone="info">Attempt {attemptsUsed + 1} of 3</Badge></div>
              <h2>{currentQuestion.question}</h2>
              <VoicePlayback text={currentQuestion.question} locale={voiceLocale} />
            </div>
            <form className="stack-form assessment-answer-form" onSubmit={(event) => { event.preventDefault(); void sendAnswer() }}>
              <label className="field-label" htmlFor="assessment-answer">Your answer</label>
              <div className="assessment-answer-entry">
                {supported && <button className={`mic-button assessment-mic ${listening ? 'mic-preview-active' : ''}`} type="button" aria-label={listening ? 'Stop listening to answer' : 'Speak your answer'} aria-pressed={listening} disabled={submitting} onClick={listening ? stop : start}>{listening ? <MicOff size={20} /> : <Mic size={20} />}</button>}
                <textarea id="assessment-answer" className="text-field assessment-answer-field" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={4000} rows={3} placeholder="Speak or type your answer" />
              </div>
              {(interimTranscript || listening) && <p className="command-listening" role="status">{interimTranscript || 'Listening for your answer…'}</p>}
              {speechError && <p className="form-error" role="alert">{speechError}</p>}
              <p className="field-hint">Your answer is matched against supervisor-approved answer variants after text normalization. Those variants are not shown here.</p>
              <p className="field-hint">“I’m not sure” records an unclear attempt. Three incorrect or unclear attempts send this briefing for supervisor review.</p>
              {currentQuestionResult && <p className="assessment-attempt-note" role="status">Latest attempt: {currentQuestionResult.result}. {Math.max(0, 3 - attemptsUsed)} attempt{3 - attemptsUsed === 1 ? '' : 's'} remaining.</p>}
              {feedback && <p className={`assessment-feedback ${feedback}`} role="status">{feedback === 'correct' ? 'Answer accepted. Moving to the next approved question.' : feedback === 'unclear' ? 'No answer was understood. You can try again or ask your supervisor for help.' : 'That answer did not match an approved answer. Try a different answer or choose help.'}</p>}
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="action-row assessment-actions">
                <button className="button button-secondary" type="button" onClick={() => void sendAnswer(true)} disabled={submitting || attemptsUsed >= 3}>{submitting ? 'Saving…' : 'I’m not sure (unclear)'}</button>
                <button className="button button-primary" type="submit" disabled={submitting || !answer.trim() || attemptsUsed >= 3}>{submitting ? 'Checking…' : 'Submit answer'} <ArrowRight size={17} /></button>
              </div>
            </form>
          </>
        )}
      </Panel>
      <div className="action-row"><Link className="button button-secondary" to="/worker/briefing"><ArrowLeft size={16} /> Briefing</Link>{assessmentComplete && <Link className="button button-primary" to="/worker/hazard">Continue to hazard report <ArrowRight size={17} /></Link>}</div>
    </div>
  )
}

export function HazardReportPage() {
  const navigate = useNavigate()
  const { hazardDraft, updateHazardDraft, language, workerAccessToken } = useWorkflow()
  const [formError, setFormError] = useState('')
  const [intelligence, setIntelligence] = useState<IntelligenceResult | null>(null)
  const [interpreting, setInterpreting] = useState(false)
  const [intelligenceMessage, setIntelligenceMessage] = useState('')
  const interpretationRequest = useRef(0)
  const voiceLocale = languageOptions.find((item) => item.code === language)?.locale ?? 'ta-IN'

  const analyzeHazardText = useCallback(async (text: string) => {
    if (!text.trim()) return
    if (!workerAccessToken) {
      setIntelligence(null)
      setIntelligenceMessage('Backend sign-in is unavailable. No fields were inferred; enter and review them manually.')
      return
    }
    const requestId = interpretationRequest.current + 1
    interpretationRequest.current = requestId
    setInterpreting(true)
    setIntelligenceMessage('Reviewing the report draft…')
    try {
      const response = await interpretVoice(text, language, workerAccessToken, 'hazard')
      if (requestId !== interpretationRequest.current || !response.data) return
      const result = response.data
      setIntelligence(result)
      setIntelligenceMessage(result.message)
      if (result.intent === 'report_hazard') {
        const suggestion: Partial<HazardDraft> = {}
        if (result.hazard.suggested_category) suggestion.category = result.hazard.suggested_category
        if (result.hazard.suggested_location) suggestion.location = result.hazard.suggested_location
        if (Object.keys(suggestion).length) updateHazardDraft(suggestion)
      }
    } catch {
      if (requestId === interpretationRequest.current) {
        setIntelligence(null)
        setIntelligenceMessage('Could not check this text. The transcript is still here; enter and review the fields manually.')
      }
    } finally {
      if (requestId === interpretationRequest.current) setInterpreting(false)
    }
  }, [language, updateHazardDraft, workerAccessToken])

  const handleTranscript = useCallback((transcript: string) => {
    const previousDescription = hazardDraft.description.trim()
    const combinedTranscript = [hazardDraft.transcript.trim(), transcript].filter(Boolean).join(' ')
    const combinedDescription = [previousDescription, transcript].filter(Boolean).join(' ')
    if (combinedTranscript.length > 6000 || combinedDescription.length > 6000) {
      setFormError('The report reached its 6,000-character limit. Review the captured text before continuing.')
    }
    updateHazardDraft({
      transcript: combinedTranscript.slice(0, 6000),
      description: combinedDescription.slice(0, 6000),
    })
    void analyzeHazardText(transcript)
  }, [analyzeHazardText, hazardDraft.description, hazardDraft.transcript, updateHazardDraft])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (interpreting) return
    if (!hazardDraft.category || !hazardDraft.location.trim() || !hazardDraft.description.trim()) {
      setFormError('Choose a category and add a location and description before reviewing.')
      return
    }
    setFormError('')
    updateHazardDraft({ idempotencyKey: createIdempotencyKey() })
    navigate('/worker/hazard/confirmation')
  }

  return (
    <div className="narrow-page">
      <StepLabel step={6} total={7} label="Report a hazard" />
      <PageHeading eyebrow="HAZARD REPORT" title="What did you notice?" description="Use voice or text. Review the details before a report is submitted." />
      <Panel className="hazard-form-panel">
        <VoiceCapture locale={voiceLocale} language={language} accessToken={workerAccessToken} onTranscript={handleTranscript} />
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
          <input id="hazard-location" className="text-field" value={hazardDraft.location} onChange={(event) => updateHazardDraft({ location: event.target.value })} placeholder="For example, Pump 4" maxLength={180} required />
          <label className="field-label" htmlFor="hazard-description">Describe what you noticed</label>
          <textarea id="hazard-description" className="text-field text-area" value={hazardDraft.description} onChange={(event) => updateHazardDraft({ description: event.target.value })} placeholder="Share only what you observed. You can add details in your own words." maxLength={6000} required />
          <button className="button button-secondary suggest-fields-button" type="button" disabled={!hazardDraft.description.trim() || interpreting} onClick={() => void analyzeHazardText(hazardDraft.description)}>
            <Sparkles size={15} />{interpreting ? 'Checking text…' : 'Suggest category and location'}
          </button>
          {intelligenceMessage && (
            <div className="intelligence-result" role="status" aria-live="polite">
              <strong>{intelligence?.intent === 'report_hazard' ? 'Draft suggestions · review required' : intelligence?.intent === 'raise_sos' ? 'Simulated SOS command recognized' : intelligence?.intent === 'explain_simply' || intelligence?.intent === 'safety_question' ? 'Supervisor review required' : 'Voice command'}</strong>
              <span>{intelligenceMessage}</span>
              {intelligence?.intent === 'report_hazard' && (intelligence.hazard.suggested_category || intelligence.hazard.suggested_location) && <small>Suggested fields were placed in the form. Confirm or correct each one; nothing was submitted.</small>}
              {intelligence?.intent === 'raise_sos' && <Link className="inline-action-link" to="/worker/sos">Open simulated SOS screen <ArrowRight size={14} /></Link>}
              {intelligence?.requires_supervisor_review && <Badge tone="warning">No safety answer generated</Badge>}
            </div>
          )}
          <p className="field-hint">If a detail is uncertain, say so. The app will ask you to confirm the report.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="button button-primary button-full" type="submit" disabled={interpreting}>Review report details <ArrowRight size={17} /></button>
        </form>
      </Panel>
      <p className="privacy-note"><ShieldAlert size={15} /> Dictation only fills this draft. Review the recognized words and report fields before continuing.</p>
    </div>
  )
}

export function HazardConfirmationPage() {
  const navigate = useNavigate()
  const { hazardDraft, language, workerId, workerAccessToken, permitId, permitRecordId, updateHazardDraft, setReportPreviewed } = useWorkflow()
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [previewComplete, setPreviewComplete] = useState(false)
  const [submittedHazard, setSubmittedHazard] = useState<HazardReport | null>(null)
  if (!hazardDraft.category || !hazardDraft.location || !hazardDraft.description) return <Navigate to="/worker/hazard" replace />

  const voiceLocale = languageOptions.find((item) => item.code === language)?.locale ?? 'ta-IN'

  const categoryLabel = {
    oil_leak: 'Oil leak',
    gas_alarm: 'Gas alarm',
    unsafe_scaffold: 'Unsafe scaffold',
    other: 'Other / unsure',
  }[hazardDraft.category] || hazardDraft.category
  const readbackText = language === 'ta'
    ? `அபாய அறிக்கை. வகை: ${categoryLabel}. இடம்: ${hazardDraft.location}. விளக்கம்: ${hazardDraft.description}.`
    : language === 'hi'
      ? `खतरे की रिपोर्ट। श्रेणी: ${categoryLabel}। स्थान: ${hazardDraft.location}। विवरण: ${hazardDraft.description}।`
      : `Hazard report. Category: ${categoryLabel}. Location: ${hazardDraft.location}. Description: ${hazardDraft.description}.`

  async function confirmReport() {
    if (!confirmed || submitting || submittedHazard || previewComplete) return
    if (!workerAccessToken || permitRecordId === null) {
      setPreviewComplete(true)
      setReportPreviewed(true)
      return
    }
    const idempotencyKey = hazardDraft.idempotencyKey || createIdempotencyKey()
    if (!hazardDraft.idempotencyKey) updateHazardDraft({ idempotencyKey })
    setSubmissionError('')
    setSubmitting(true)
    try {
      const response = await createHazardReport({
        permit_id: permitRecordId,
        category: hazardDraft.category,
        description: hazardDraft.description,
        location: hazardDraft.location,
        transcript: hazardDraft.transcript || null,
      }, workerAccessToken, idempotencyKey)
      if (!response.success || !response.data) throw new Error('The server did not confirm that the report was saved.')
      setSubmittedHazard(response.data)
      setReportPreviewed(true)
    } catch (error) {
      setSubmissionError(error instanceof ApiError
        ? `${error.message} Your draft is still here. Retry to safely check whether it was saved.`
        : 'The report could not be confirmed as saved. Your draft is still here; retry to safely check whether it was saved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="narrow-page">
      <StepLabel step={7} total={7} label="Confirm details" />
      <PageHeading eyebrow="REVIEW BEFORE SUBMITTING" title="Does this look right?" description="Check the category and location before the report is sent." />
      <Panel className="confirmation-panel">
        <div className="confirmation-title"><span className="confirm-icon"><CheckCircle2 size={21} /></span><div><strong>{submittedHazard ? `Hazard report #${submittedHazard.id}` : 'Hazard report draft'}</strong><span>Permit {permitId || 'PTW-1001'} · Worker {workerId || 'WRK-1001'}</span></div><Badge tone={submittedHazard ? 'success' : 'warning'}>{submittedHazard ? `Saved · ${submittedHazard.status}` : 'Awaiting confirmation'}</Badge></div>
        <dl className="confirmation-list"><div><dt>Category</dt><dd>{categoryLabel}</dd></div><div><dt>Location</dt><dd>{hazardDraft.location}</dd></div><div><dt>Description</dt><dd>{hazardDraft.description}</dd></div><div><dt>Voice transcript</dt><dd>{hazardDraft.transcript || 'No voice transcript · entered as text'}</dd></div></dl>
        <VoicePlayback text={readbackText} locale={voiceLocale} />
        {!submittedHazard && !previewComplete && <label className="transcript-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the transcript and report details. They match what I want to report.</span></label>}
        {submittedHazard && <div className="inline-note"><CheckCircle2 size={17} /><span>The server saved this report with status “{submittedHazard.status}”. It is now available to the assigned supervisor.</span></div>}
        {previewComplete && <div className="preview-warning"><ShieldAlert size={17} /><span>Local preview only. No backend session or assigned permit was available, so this report was not submitted or saved.</span></div>}
        {!workerAccessToken || permitRecordId === null ? !previewComplete && <div className="preview-warning"><ShieldAlert size={17} /><span>Sign in through the backend and select an assigned permit to submit this report. You can complete a local preview, but it will not be saved.</span></div> : !submittedHazard && <div className="privacy-note"><ShieldAlert size={15} /> The report is sent only after confirmation. A successful server response is required before it is marked submitted.</div>}
        {submissionError && <p className="form-error" role="alert">{submissionError}</p>}
      </Panel>
      <div className="action-row"><Link className="button button-secondary" to="/worker/hazard"><ArrowLeft size={16} /> {submittedHazard || previewComplete ? 'Report another' : 'Edit details'}</Link>{submittedHazard || previewComplete ? <button className="button button-primary" type="button" onClick={() => navigate('/worker/home')}>Return to worker home <ArrowRight size={17} /></button> : <button className="button button-primary" type="button" disabled={!confirmed || submitting} onClick={() => void confirmReport()}>{submitting ? 'Submitting…' : !workerAccessToken || permitRecordId === null ? 'Complete local preview' : 'Confirm & submit report'} <Check size={17} /></button>}</div>
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

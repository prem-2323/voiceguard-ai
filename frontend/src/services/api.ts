import axios, { type AxiosError } from 'axios'

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T | null
  error: { code: string; details?: unknown } | null
}

export interface HealthData {
  status: string
  database: string
}

export interface DemoUser {
  id: number
  name: string
  worker_id: string
  role: 'worker' | 'supervisor'
  preferred_language: 'en' | 'ta' | 'hi'
}

export interface DemoAuthData {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: DemoUser
}

export interface VoiceCapabilities {
  whisper_fallback_available: boolean
}

export interface VoiceTranscription {
  transcript: string
  language: 'en' | 'ta' | 'hi'
}

export type VoiceIntent = 'repeat_instruction' | 'explain_simply' | 'report_hazard' | 'raise_sos' | 'help' | 'safety_question' | 'unknown'

export interface IntelligenceResult {
  intent: VoiceIntent
  confidence: 'high' | 'partial' | 'none'
  hazard: {
    suggested_category: 'oil_leak' | 'gas_alarm' | 'unsafe_scaffold' | null
    suggested_location: string | null
    ambiguous: boolean
  }
  requires_confirmation: boolean
  requires_supervisor_review: boolean
  approved_instruction: {
    id: number
    title: string
    content: string
    language: 'en' | 'ta' | 'hi'
    version: number
  } | null
  message: string
}

export interface WorkerPermit {
  id: number
  permit_number: string
  task_type: string
  work_location: string
  status: string
  valid_from: string
  valid_until: string | null
}

export interface PublishedInstruction {
  id: number
  task_type: string
  title: string
  content: string
  language: 'en' | 'ta' | 'hi'
  version: number
  approval_status: 'published'
  questions: { id: number; question: string; language: string; version: number }[]
}

export interface BriefingSession {
  id: number
  worker_id: number
  permit_id: number
  instruction_id: number
  instruction_version: number
  status: 'started' | 'in_progress' | 'completed' | 'supervisor_review'
  current_step: number
  started_at: string
  completed_at: string | null
}

export interface BriefingBundle {
  briefing: BriefingSession
  instruction: PublishedInstruction
}

export interface AssessmentResult {
  id: number
  session_id: number
  worker_id: number
  permit_id: number
  question_id: number
  question_version: number
  worker_answer: string
  result: 'correct' | 'incorrect' | 'unclear'
  attempt_count: number
  reviewed_by: number | null
  created_at: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    message: string,
    status: number,
    code: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const response = error.response
    const message = response?.data?.message ?? 'The VoiceGuard API could not be reached.'
    const code = response?.data?.error?.code ?? 'API_UNAVAILABLE'
    return Promise.reject(new ApiError(message, response?.status ?? 0, code))
  },
)

export async function fetchHealth(): Promise<ApiEnvelope<HealthData>> {
  const response = await api.get<ApiEnvelope<HealthData>>('/health')
  return response.data
}

export async function loginDemo(workerId: string, password: string): Promise<ApiEnvelope<DemoAuthData>> {
  const response = await api.post<ApiEnvelope<DemoAuthData>>('/auth/demo-login', {
    worker_id: workerId,
    password,
    role: 'worker',
  })
  return response.data
}

export async function fetchVoiceCapabilities(accessToken: string): Promise<ApiEnvelope<VoiceCapabilities>> {
  const response = await api.get<ApiEnvelope<VoiceCapabilities>>('/voice/capabilities', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function transcribeVoice(
  audio: Blob,
  language: 'en' | 'ta' | 'hi',
  accessToken: string,
): Promise<ApiEnvelope<VoiceTranscription>> {
  const body = new FormData()
  body.append('audio', audio, `voice.${audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'm4a' : audio.type.includes('wav') ? 'wav' : 'webm'}`)
  body.append('language', language)
  const response = await api.post<ApiEnvelope<VoiceTranscription>>('/voice/transcribe', body, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 120_000,
  })
  return response.data
}

export async function interpretVoice(
  text: string,
  language: 'en' | 'ta' | 'hi',
  accessToken: string,
  context: 'general' | 'briefing' | 'hazard',
  permitNumber?: string,
  briefingSessionId?: number,
): Promise<ApiEnvelope<IntelligenceResult>> {
  const response = await api.post<ApiEnvelope<IntelligenceResult>>('/intelligence/interpret', {
    text,
    language,
    context,
    ...(permitNumber ? { permit_number: permitNumber } : {}),
    ...(briefingSessionId ? { briefing_session_id: briefingSessionId } : {}),
  }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function fetchWorkerPermits(accessToken: string): Promise<ApiEnvelope<WorkerPermit[]>> {
  const response = await api.get<ApiEnvelope<WorkerPermit[]>>('/permits', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function fetchPublishedInstructions(
  permitId: number,
  language: 'en' | 'ta' | 'hi',
  accessToken: string,
): Promise<ApiEnvelope<PublishedInstruction[]>> {
  const response = await api.get<ApiEnvelope<PublishedInstruction[]>>('/instructions', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { permit_id: permitId, language },
  })
  return response.data
}

export async function fetchCurrentBriefing(
  permitId: number,
  language: 'en' | 'ta' | 'hi',
  accessToken: string,
): Promise<ApiEnvelope<BriefingBundle | null>> {
  const response = await api.get<ApiEnvelope<BriefingBundle | null>>('/briefings/current', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { permit_id: permitId, language },
  })
  return response.data
}

export async function fetchBriefingSession(
  sessionId: number,
  accessToken: string,
): Promise<ApiEnvelope<BriefingBundle>> {
  const response = await api.get<ApiEnvelope<BriefingBundle>>(`/briefings/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function startBriefing(
  permitId: number,
  language: 'en' | 'ta' | 'hi',
  accessToken: string,
): Promise<ApiEnvelope<BriefingBundle>> {
  const response = await api.post<ApiEnvelope<BriefingBundle>>('/briefings', {
    permit_id: permitId,
    language,
  }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function saveBriefingProgress(
  sessionId: number,
  currentStep: number,
  completed: boolean,
  accessToken: string,
): Promise<ApiEnvelope<BriefingSession>> {
  const response = await api.patch<ApiEnvelope<BriefingSession>>(`/briefings/${sessionId}/progress`, {
    current_step: currentStep,
    completed,
  }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

export async function fetchBriefingAssessments(
  sessionId: number,
  accessToken: string,
): Promise<ApiEnvelope<AssessmentResult[]>> {
  const response = await api.get<ApiEnvelope<AssessmentResult[]>>('/assessments', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { session_id: sessionId },
  })
  return response.data
}

export async function submitAssessmentAnswer(
  sessionId: number,
  questionId: number,
  answer: string,
  accessToken: string,
): Promise<ApiEnvelope<AssessmentResult>> {
  const response = await api.post<ApiEnvelope<AssessmentResult>>(`/briefings/${sessionId}/assessments`, {
    question_id: questionId,
    answer,
  }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return response.data
}

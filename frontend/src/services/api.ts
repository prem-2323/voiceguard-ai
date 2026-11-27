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

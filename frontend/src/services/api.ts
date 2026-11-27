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

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type LanguageCode = 'ta' | 'en' | 'hi'

export interface HazardDraft {
  category: string
  location: string
  description: string
  transcript: string
  idempotencyKey: string
}

interface WorkflowState {
  workerId: string
  workerName: string
  workerAccessToken: string
  permitId: string
  permitRecordId: number | null
  permitTaskType: string
  permitLocation: string
  language: LanguageCode
  languageSelected: boolean
  supervisorAuthenticated: boolean
  hazardDraft: HazardDraft
  reportPreviewed: boolean
  sosPreviewed: boolean
}

interface WorkflowActions {
  setWorker: (workerId: string, workerName: string, accessToken?: string) => void
  setPermit: (permitId: string, recordId: number | null, taskType: string, workLocation: string) => void
  setLanguage: (language: LanguageCode) => void
  setSupervisorAuthenticated: (authenticated: boolean) => void
  updateHazardDraft: (draft: Partial<HazardDraft>) => void
  setReportPreviewed: (previewed: boolean) => void
  setSosPreviewed: (previewed: boolean) => void
}

const initialState: WorkflowState = {
  workerId: '',
  workerName: '',
  workerAccessToken: '',
  permitId: '',
  permitRecordId: null,
  permitTaskType: '',
  permitLocation: '',
  language: 'ta',
  languageSelected: false,
  supervisorAuthenticated: false,
  hazardDraft: { category: '', location: '', description: '', transcript: '', idempotencyKey: '' },
  reportPreviewed: false,
  sosPreviewed: false,
}

const WorkflowContext = createContext<(WorkflowState & WorkflowActions) | null>(null)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState)
  const value = useMemo<WorkflowState & WorkflowActions>(() => ({
    ...state,
    setWorker: (workerId, workerName, workerAccessToken = '') => setState((current) => ({ ...current, workerId, workerName, workerAccessToken, permitId: '', permitRecordId: null, permitTaskType: '', permitLocation: '', languageSelected: false, hazardDraft: { category: '', location: '', description: '', transcript: '', idempotencyKey: '' }, reportPreviewed: false })),
    setPermit: (permitId, permitRecordId, permitTaskType, permitLocation) => setState((current) => ({ ...current, permitId, permitRecordId, permitTaskType, permitLocation, languageSelected: false, hazardDraft: { ...current.hazardDraft, idempotencyKey: '' }, reportPreviewed: false })),
    setLanguage: (language) => setState((current) => ({ ...current, language, languageSelected: true })),
    setSupervisorAuthenticated: (supervisorAuthenticated) => setState((current) => ({ ...current, supervisorAuthenticated })),
    updateHazardDraft: (draft) => setState((current) => ({
      ...current,
      hazardDraft: { ...current.hazardDraft, ...draft, idempotencyKey: 'idempotencyKey' in draft ? draft.idempotencyKey ?? '' : '' },
      reportPreviewed: false,
    })),
    setReportPreviewed: (reportPreviewed) => setState((current) => ({ ...current, reportPreviewed })),
    setSosPreviewed: (sosPreviewed) => setState((current) => ({ ...current, sosPreviewed })),
  }), [state])

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (!context) throw new Error('useWorkflow must be used inside WorkflowProvider')
  return context
}

import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { SupervisorLayout, WorkerLayout } from './components/layouts'
import { useWorkflow } from './contexts/WorkflowContext'
import WelcomePage from './pages/WelcomePage'
import VoiceDiagnosticsPage from './pages/VoiceDiagnosticsPage'
import {
  AssessmentPage,
  BriefingPage,
  HazardConfirmationPage,
  HazardReportPage,
  LanguagePage,
  PermitPage,
  WorkerHomePage,
  WorkerLoginPage,
  WorkerSosPage,
} from './pages/worker/WorkerPages'
import {
  SupervisorLoginPage,
  SupervisorOverviewPage,
  SupervisorSectionPage,
} from './pages/supervisor/SupervisorPages'

function RequireWorker() {
  const { workerAccessToken } = useWorkflow()
  return workerAccessToken ? <Outlet /> : <Navigate to="/worker/login" replace />
}

function RequirePermit() {
  const { permitId, permitRecordId } = useWorkflow()
  return permitId && permitRecordId !== null ? <Outlet /> : <Navigate to="/worker/permit" replace />
}

function RequireLanguage() {
  const { languageSelected } = useWorkflow()
  return languageSelected ? <Outlet /> : <Navigate to="/worker/language" replace />
}

function RequireSupervisor() {
  const { supervisorAccessToken } = useWorkflow()
  return supervisorAccessToken ? <Outlet /> : <Navigate to="/supervisor/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />

      <Route element={<WorkerLayout />}>
        <Route path="worker/voice-diagnostics" element={<VoiceDiagnosticsPage />} />
        <Route path="worker/login" element={<WorkerLoginPage />} />
        <Route element={<RequireWorker />}>
          <Route path="worker/sos" element={<WorkerSosPage />} />
          <Route path="worker/permit" element={<PermitPage />} />
          <Route element={<RequirePermit />}>
            <Route path="worker/language" element={<LanguagePage />} />
            <Route element={<RequireLanguage />}>
              <Route path="worker/home" element={<WorkerHomePage />} />
              <Route path="worker/briefing" element={<BriefingPage />} />
              <Route path="worker/assessment" element={<AssessmentPage />} />
              <Route path="worker/hazard" element={<HazardReportPage />} />
              <Route path="worker/hazard/confirmation" element={<HazardConfirmationPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="supervisor/login" element={<SupervisorLoginPage />} />
      <Route element={<RequireSupervisor />}>
        <Route path="supervisor" element={<SupervisorLayout />}>
          <Route index element={<SupervisorOverviewPage />} />
          <Route path=":section" element={<SupervisorSectionPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

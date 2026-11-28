import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WorkflowProvider } from './contexts/WorkflowContext'
import { registerServiceWorker } from './services/pwa'
import './index.css'
import App from './App.tsx'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkflowProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WorkflowProvider>
  </StrictMode>,
)

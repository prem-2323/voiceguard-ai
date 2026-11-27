import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WorkflowProvider } from './contexts/WorkflowContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkflowProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WorkflowProvider>
  </StrictMode>,
)

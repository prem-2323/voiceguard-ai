import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Database, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { ApiError, fetchHealth, type HealthData } from './services/api'

type ConnectionState = 'loading' | 'connected' | 'disconnected'

function App() {
  const [connection, setConnection] = useState<ConnectionState>('loading')
  const [health, setHealth] = useState<HealthData | null>(null)
  const [message, setMessage] = useState('Checking the local API…')

  const refreshHealth = useCallback(async () => {
    setConnection('loading')
    setMessage('Checking the local API…')

    try {
      const response = await fetchHealth()
      if (!response.success || !response.data) {
        throw new ApiError(response.message, 0, 'HEALTH_CHECK_FAILED')
      }
      setHealth(response.data)
      setConnection('connected')
      setMessage(response.message)
    } catch (error) {
      setHealth(null)
      setConnection('disconnected')
      setMessage(error instanceof Error ? error.message : 'The API could not be reached.')
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth])

  const connected = connection === 'connected'

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="VoiceGuard AI home">
          <span className="brand-mark">V</span>
          <span>VoiceGuard <span className="brand-light">AI</span></span>
        </a>
        <span className="environment-tag"><span className="environment-dot" /> Local demo</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="eyebrow"><ShieldCheck size={15} strokeWidth={2.2} /> SAFETY WORKFLOW FOUNDATION</div>
        <div className="hero-row">
          <div>
            <h1 id="page-title">A safer start,<br /><span>one clear step at a time.</span></h1>
            <p className="hero-copy">Voice-first safety support for industrial teams, built around approved instructions and clear human review.</p>
          </div>
          <div className="hero-stamp" aria-hidden="true"><span>VG</span><span>BUILT FOR<br />BHARAT</span></div>
        </div>
      </section>

      <section className="status-card" aria-labelledby="status-heading">
        <div className="status-card-heading">
          <div className="status-icon"><Activity size={19} /></div>
          <div>
            <p className="section-kicker">DEVELOPMENT CHECK</p>
            <h2 id="status-heading">Services at a glance</h2>
          </div>
          <span className={`connection-pill ${connected ? 'is-connected' : connection === 'loading' ? 'is-loading' : 'is-disconnected'}`}>
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {connection === 'loading' ? 'Connecting' : connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <div className="service-row">
          <div className="service-symbol"><Database size={18} /></div>
          <div className="service-copy">
            <strong>FastAPI backend</strong>
            <span>{message}</span>
          </div>
          <span className={`service-state ${connected ? 'ready' : connection === 'loading' ? 'pending' : 'unavailable'}`}>
            {connected ? 'Ready' : connection === 'loading' ? 'Checking' : 'Unavailable'}
          </span>
        </div>

        {health && (
          <div className="health-details" role="status">
            <span><span className="tiny-dot" /> API {health.status}</span>
            <span><span className="tiny-dot" /> Database {health.database}</span>
          </div>
        )}

        <div className="card-footer">
          <span>Phase 1 · Repository and environment</span>
          <button className="refresh-button" type="button" onClick={() => void refreshHealth()}>
            Refresh connection <ArrowUpRight size={15} />
          </button>
        </div>
      </section>

      <footer className="page-footer">
        <span>Demo environment · Synthetic data only</span>
        <span>Safety decisions stay with approved site procedures.</span>
      </footer>
    </main>
  )
}

export default App

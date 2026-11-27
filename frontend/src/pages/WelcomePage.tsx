import { useEffect, useState } from 'react'
import { ArrowRight, HardHat, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchHealth } from '../services/api'
import { Brand } from '../components/layouts'

export default function WelcomePage() {
  const [apiReady, setApiReady] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void fetchHealth()
      .then((response) => { if (active) setApiReady(response.success && response.data?.status === 'healthy') })
      .catch(() => { if (active) setApiReady(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        <span className="welcome-status">
          {apiReady ? <Wifi size={15} /> : apiReady === false ? <WifiOff size={15} /> : <span className="status-spinner" />}
          {apiReady === null ? 'Checking services' : apiReady ? 'Services connected' : 'Offline preview'}
        </span>
      </header>

      <main className="welcome-main">
        <section className="welcome-copy">
          <div className="eyebrow"><ShieldCheck size={16} /> SAFETY STARTS WITH BEING HEARD</div>
          <h1>Clear guidance.<br /><span>Confident work.</span></h1>
          <p>Voice-first safety support designed for industrial teams across languages. Choose your workspace to begin the demo.</p>
          <div className="welcome-proof"><span className="proof-icon"><HardHat size={17} /></span><span>Instructions stay tied to reviewed site content.</span></div>
        </section>

        <section className="role-picker" aria-labelledby="role-title">
          <div className="role-picker-heading">
            <p className="eyebrow">GET STARTED</p>
            <h2 id="role-title">Choose your workspace</h2>
            <p>Use a fictional account to explore the interface.</p>
          </div>
          <Link to="/worker/login" className="role-card worker-role">
            <span className="role-icon"><HardHat size={22} /></span>
            <span className="role-text"><strong>Worker</strong><span>Briefings, understanding checks, and hazard reports</span></span>
            <ArrowRight size={19} className="role-arrow" />
          </Link>
          <Link to="/supervisor/login" className="role-card supervisor-role">
            <span className="role-icon"><ShieldCheck size={22} /></span>
            <span className="role-text"><strong>Supervisor</strong><span>Monitor reports, reviews, and demo activity</span></span>
            <ArrowRight size={19} className="role-arrow" />
          </Link>
          <p className="demo-note"><span className="environment-dot" /> DEMO ENVIRONMENT · SYNTHETIC DATA ONLY</p>
        </section>
      </main>

      <footer className="welcome-footer">
        <span>VoiceGuard AI · Built for safer, clearer workflows</span>
        <span>In a real emergency, follow your site's emergency procedure immediately.</span>
      </footer>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Mic, MicOff, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Panel, PageHeading } from '../components/ui'
import { useSpeechPlayback, useSpeechRecognition } from '../services/speech'

const languageOptions = [
  { locale: 'ta-IN', code: 'ta', label: 'Tamil', native: 'தமிழ்', testText: 'வணக்கம். இது குரல் சோதனை.' },
  { locale: 'en-IN', code: 'en', label: 'English', native: 'English', testText: 'This is a speech playback test.' },
  { locale: 'hi-IN', code: 'hi', label: 'Hindi', native: 'हिन्दी', testText: 'यह आवाज़ परीक्षण है।' },
] as const

type PermissionState = 'checking' | 'granted' | 'denied' | 'prompt' | 'unavailable'

function availableSpeechVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().map(({ name, lang }) => ({ name, lang }))
}

function canReadMicrophonePermission() {
  if (typeof navigator === 'undefined') return false
  const permissionsApi = Reflect.get(navigator, 'permissions') as { query?: unknown } | undefined
  return typeof permissionsApi?.query === 'function'
}

function browserName() {
  if (typeof navigator === 'undefined') return 'Unknown'
  const userAgentData = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
  const preferredBrand = userAgentData?.brands?.find(({ brand }) => !/not.?a.?brand/i.test(brand))?.brand
  if (preferredBrand) return preferredBrand
  const userAgent = navigator.userAgent
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge'
  if (/OPR\//.test(userAgent)) return 'Opera'
  if (/Brave/i.test(userAgent)) return 'Brave'
  if (/Chrome\//.test(userAgent)) return 'Chromium browser'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Unidentified browser'
}

export default function VoiceDiagnosticsPage() {
  const [locale, setLocale] = useState<(typeof languageOptions)[number]['locale']>('ta-IN')
  const [permission, setPermission] = useState<PermissionState>(() =>
    canReadMicrophonePermission() ? 'checking' : 'unavailable')
  const [browser] = useState(browserName)
  const [voices, setVoices] = useState(availableSpeechVoices)
  const [lastTranscript, setLastTranscript] = useState('')
  const [recognizedLocale, setRecognizedLocale] = useState('')
  const selectedLanguage = languageOptions.find((language) => language.locale === locale) ?? languageOptions[0]

  const handleTranscript = useCallback((text: string) => {
    setLastTranscript(text)
    setRecognizedLocale(locale)
  }, [locale])

  const {
    supported: recognitionApiAvailable,
    listening,
    processing,
    interimTranscript,
    error: recognitionError,
    start,
    stop,
  } = useSpeechRecognition(locale, handleTranscript)
  const {
    supported: selectedTtsAvailable,
    speaking,
    error: ttsError,
    speak,
    stop: stopSpeaking,
  } = useSpeechPlayback(selectedLanguage.testText, locale)
  const ttsApiAvailable = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window

  useEffect(() => {
    let active = true
    let removePermissionListener: (() => void) | null = null
    let refreshVoices: (() => void) | null = null

    if (canReadMicrophonePermission()) {
      void navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (!active) return
          const updatePermission = () => {
            if (active) setPermission(status.state as PermissionState)
          }
          updatePermission()
          status.addEventListener('change', updatePermission)
          removePermissionListener = () => status.removeEventListener('change', updatePermission)
        })
        .catch(() => {
          if (active) setPermission('unavailable')
        })
    }

    if ('speechSynthesis' in window) {
      refreshVoices = () => {
        if (!active) return
        setVoices(window.speechSynthesis.getVoices().map(({ name, lang }) => ({ name, lang })))
      }
      window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    }

    return () => {
      active = false
      removePermissionListener?.()
      if (refreshVoices && 'speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
      }
    }
  }, [])

  const voiceSummary = (code: 'ta' | 'en' | 'hi') => {
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${code}-`) || voice.lang.toLowerCase() === code)
    return matchingVoices.length
      ? matchingVoices.map((voice) => `${voice.name} (${voice.lang})`).join(', ')
      : 'No matching voice reported by this browser'
  }

  return (
    <div className="narrow-page voice-diagnostics-page">
      <PageHeading eyebrow="VOICE CHECK" title="Voice diagnostics" description="Check browser voice capabilities before using the worker workflow." />

      <Panel className="voice-diagnostics-panel">
        <dl className="diagnostic-facts">
          <div><dt>Browser</dt><dd>{browser}</dd></div>
          <div><dt>Speech recognition API</dt><dd>{recognitionApiAvailable ? 'Available' : 'Unavailable'}</dd></div>
          <div><dt>Speech synthesis API</dt><dd>{ttsApiAvailable ? 'Available' : 'Unavailable'}</dd></div>
          <div><dt>Microphone permission</dt><dd>{permission === 'unavailable' ? 'Permission state unavailable' : permission}</dd></div>
        </dl>
        <p className="diagnostic-disclosure">API availability is not proof that the microphone works or that speech was recognized. A successful microphone check requires a real spoken phrase and a transcript below. Browser speech services may send audio to a provider outside this app.</p>
      </Panel>

      <Panel className="voice-diagnostics-panel">
        <label className="field-label" htmlFor="diagnostic-language">Test language</label>
        <select id="diagnostic-language" className="text-field" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
          {languageOptions.map((language) => <option key={language.locale} value={language.locale}>{language.native} · {language.label} · {language.locale}</option>)}
        </select>

        <div className="diagnostic-voice-controls">
          {recognitionApiAvailable && (
            <button className={`button ${listening ? 'button-secondary' : 'button-primary'}`} type="button" onClick={listening ? stop : start}>
              {listening ? <><MicOff size={16} /> Stop listening</> : <><Mic size={16} /> {recognitionError || lastTranscript ? 'Retry microphone test' : 'Test microphone'}</>}
            </button>
          )}
          <button className="button button-secondary" type="button" disabled={!ttsApiAvailable} onClick={speaking ? stopSpeaking : speak}>
            {speaking ? <><MicOff size={16} /> Stop playback</> : <><Volume2 size={16} /> Play test phrase</>}
          </button>
        </div>

        {!recognitionApiAvailable && <p className="diagnostic-message" role="status">Speech recognition is not exposed by this browser. No microphone test was attempted; use the app's text entry instead.</p>}
        {listening && <p className="diagnostic-message" role="status">Listening for {locale}. Speak a short, non-sensitive test phrase.</p>}
        {processing && <p className="diagnostic-message" role="status">Processing the browser recognition result…</p>}
        {interimTranscript && <p className="diagnostic-transcript" aria-live="polite"><strong>Interim transcript</strong><span>{interimTranscript}</span></p>}
        <p className="diagnostic-transcript" aria-live="polite"><strong>{lastTranscript ? `Recognized in ${recognizedLocale}` : 'Successful microphone test'}</strong><span>{lastTranscript || 'No successful mic transcript recorded in this session.'}</span></p>
        {recognitionError && <p className="form-error" role="alert">Recognition error: {recognitionError}</p>}
        {!selectedTtsAvailable && <p className="diagnostic-message">No installed speech voice matches {locale}; written text remains available.</p>}
        {ttsError && <p className="form-error" role="alert">TTS error: {ttsError}</p>}
      </Panel>

      <Panel className="voice-diagnostics-panel">
        <h2>Voices reported by the browser</h2>
        <dl className="diagnostic-voice-list">
          <div><dt>Tamil (ta)</dt><dd>{voiceSummary('ta')}</dd></div>
          <div><dt>English (en)</dt><dd>{voiceSummary('en')}</dd></div>
          <div><dt>Hindi (hi)</dt><dd>{voiceSummary('hi')}</dd></div>
        </dl>
        {voices.length === 0 && <p className="diagnostic-message">No speech voices are currently reported. Some browsers load voice lists asynchronously or provide them only after device language packs are installed.</p>}
        <p className="diagnostic-test-phrase"><strong>Playback phrase:</strong> {selectedLanguage.testText}</p>
      </Panel>

      <Link className="inline-action-link" to="/"><ArrowLeft size={15} /> Back to VoiceGuard</Link>
    </div>
  )
}

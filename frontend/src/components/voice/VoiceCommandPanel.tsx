import { useCallback, useState } from 'react'
import { ArrowRight, Mic, MicOff, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Panel } from '../ui'
import type { LanguageCode } from '../../contexts/WorkflowContext'
import { ApiError, interpretVoice, type IntelligenceResult } from '../../services/api'
import { useSpeechRecognition } from '../../services/speech'
import { VoicePlayback } from './VoiceControls'

const commandExamples: Record<LanguageCode, string> = {
  en: 'Try: “repeat instruction”, “explain simply”, “report a hazard”, or “SOS”.',
  ta: 'முயற்சிக்கவும்: “மீண்டும் சொல்லுங்கள்”, “எளிமையாக விளக்குங்கள்”, “ஆபத்தைப் புகாரளி” அல்லது “SOS”.',
  hi: 'कहें: “फिर से बताएं”, “आसान भाषा में समझाएं”, “खतरे की रिपोर्ट” या “SOS”.',
}

const intentLabels: Record<IntelligenceResult['intent'], string> = {
  repeat_instruction: 'Repeat request',
  explain_simply: 'Simpler explanation request',
  report_hazard: 'Hazard report request',
  raise_sos: 'Simulated SOS request',
  help: 'Help request',
  safety_question: 'Safety question',
  unknown: 'Request not matched',
}

export function VoiceCommandPanel({
  locale,
  language,
  accessToken,
  permitNumber,
}: {
  locale: string
  language: LanguageCode
  accessToken: string
  permitNumber: string
}) {
  const [commandText, setCommandText] = useState('')
  const [result, setResult] = useState<IntelligenceResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const interpret = useCallback(async (text: string) => {
    if (!text.trim()) return
    setError('')
    setResult(null)
    if (!accessToken) {
      setError('Sign in to the demo backend to check voice commands. You can also use the visible screen controls.')
      return
    }
    setBusy(true)
    try {
      const response = await interpretVoice(text, language, accessToken, 'briefing', permitNumber)
      if (!response.success || !response.data) throw new Error('No command response was returned.')
      setResult(response.data)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Command checking is unavailable. Use the visible screen controls.')
    } finally {
      setBusy(false)
    }
  }, [accessToken, language, permitNumber])

  const handleVoiceCommand = useCallback((text: string) => {
    setCommandText(text)
    void interpret(text)
  }, [interpret])
  const { supported, listening, interimTranscript, start, stop } = useSpeechRecognition(locale, handleVoiceCommand)

  const reviewNeeded = result?.requires_supervisor_review
    || (result?.intent === 'repeat_instruction' && !result.approved_instruction)

  return (
    <Panel className="voice-command-panel">
      <div className="command-panel-heading">
        <div><p className="eyebrow">VOICE COMMANDS</p><h2>Ask for help with this step.</h2></div>
        <Badge tone="info">{locale}</Badge>
      </div>
      <p className="command-examples">{commandExamples[language]}</p>
      <div className="command-input-row">
        {supported && (
          <button
            className={`mic-button command-mic ${listening ? 'mic-preview-active' : ''}`}
            type="button"
            aria-label={listening ? 'Stop listening for a command' : 'Speak a command'}
            aria-pressed={listening}
            disabled={busy}
            onClick={listening ? stop : start}
          >
            {listening ? <MicOff size={20} /> : <Mic size={21} />}
          </button>
        )}
        <label className="visually-hidden" htmlFor="voice-command-text">Type a voice command</label>
        <input
          id="voice-command-text"
          className="text-field command-text-field"
          value={commandText}
          onChange={(event) => setCommandText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void interpret(commandText)
            }
          }}
          placeholder="Or type a command"
          maxLength={4000}
        />
        <button className="button button-secondary command-submit" type="button" disabled={!commandText.trim() || busy} onClick={() => void interpret(commandText)}>
          <Send size={15} />{busy ? 'Checking…' : 'Send'}
        </button>
      </div>
      {(interimTranscript || listening) && <p className="command-listening" role="status">{interimTranscript || 'Listening for one command…'}</p>}
      {!supported && <p className="voice-engine-note">Browser speech recognition is unavailable. Type a command or use the buttons on screen.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && (
        <div className="command-result" role="status" aria-live="polite">
          <div className="command-result-heading"><strong>{intentLabels[result.intent]}</strong>{reviewNeeded && <Badge tone="warning">Supervisor review may be needed</Badge>}</div>
          <p>{result.message}</p>
          {result.intent === 'repeat_instruction' && result.approved_instruction && (
            <div className="published-content-preview">
              <strong>{result.approved_instruction.title} · approved version {result.approved_instruction.version}</strong>
              <p>{result.approved_instruction.content}</p>
            </div>
          )}
          {result.intent === 'repeat_instruction' && !result.approved_instruction && <p className="command-safe-fallback">No approved published instruction is available for this permit and language. The request needs supervisor review; no substitute instruction was created.</p>}
          <VoicePlayback text={result.approved_instruction?.content ?? result.message} locale={locale} />
          {result.intent === 'report_hazard' && <Link className="inline-action-link" to="/worker/hazard">Open hazard report <ArrowRight size={14} /></Link>}
          {result.intent === 'raise_sos' && <Link className="inline-action-link" to="/worker/sos">Open simulated SOS screen <ArrowRight size={14} /></Link>}
        </div>
      )}
      <p className="command-safety-note">Commands are recognized as suggestions only. They do not submit a report, trigger SOS, approve a permit, or generate safety instructions.</p>
    </Panel>
  )
}

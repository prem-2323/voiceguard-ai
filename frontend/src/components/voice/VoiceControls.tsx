import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, Volume2 } from 'lucide-react'
import { ApiError, fetchVoiceCapabilities, transcribeVoice } from '../../services/api'
import { useSpeechPlayback, useSpeechRecognition } from '../../services/speech'
import type { LanguageCode } from '../../contexts/WorkflowContext'

function describeMicrophoneError(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was denied. You can still enter the report as text.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found. You can still enter the report as text.'
  }
  if (error instanceof ApiError) return `${error.message} You can still enter the report as text.`
  return 'The recording could not be processed. You can still enter the report as text.'
}

export function VoiceCapture({
  locale,
  language,
  accessToken,
  onTranscript,
}: {
  locale: string
  language: LanguageCode
  accessToken: string
  onTranscript: (transcript: string) => void
}) {
  const [heardText, setHeardText] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const [recordingState, setRecordingState] = useState<'idle' | 'requesting' | 'recording' | 'transcribing'>('idle')
  const [whisperAvailable, setWhisperAvailable] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mountedRef = useRef(true)
  const { supported, listening, processing, interimTranscript, error, start, stop } = useSpeechRecognition(locale, (text) => {
    setHeardText(text)
    onTranscript(text)
  })
  const canRecord = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)

  useEffect(() => {
    let mounted = true
    if (!accessToken || !canRecord) {
      setWhisperAvailable(false)
      return () => { mounted = false }
    }
    fetchVoiceCapabilities(accessToken)
      .then((response) => {
        if (mounted) setWhisperAvailable(response.success && Boolean(response.data?.whisper_fallback_available))
      })
      .catch(() => {
        if (mounted) setWhisperAvailable(false)
      })
    return () => { mounted = false }
  }, [accessToken, canRecord])

  const handleWhisperResult = useCallback((transcript: string) => {
    setHeardText(transcript)
    onTranscript(transcript)
  }, [onTranscript])

  const startWhisperRecording = useCallback(async () => {
    setRecordingError('')
    if (!accessToken || !whisperAvailable || !canRecord) {
      setRecordingError('Optional local transcription is unavailable. You can still enter the report as text.')
      return
    }
    setRecordingState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        recorder.onstop = null
        recorderRef.current = null
        streamRef.current = null
        setRecordingState('idle')
        setRecordingError('The recording stopped unexpectedly. You can still enter the report as text.')
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        if (!blob.size) {
          setRecordingState('idle')
          setRecordingError('No audio was captured. You can still enter the report as text.')
          return
        }
        setRecordingState('transcribing')
        try {
          const response = await transcribeVoice(blob, language, accessToken)
          const transcript = response.data?.transcript.trim() ?? ''
          if (!response.success || !transcript) throw new Error('No speech was returned.')
          handleWhisperResult(transcript)
          setRecordingError('')
        } catch (error) {
          setRecordingError(describeMicrophoneError(error))
        } finally {
          setRecordingState('idle')
        }
      }
      recorder.start()
      setRecordingState('recording')
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (mountedRef.current) {
        setRecordingState('idle')
        setRecordingError(describeMicrophoneError(error))
      }
    }
  }, [accessToken, canRecord, handleWhisperResult, language, whisperAvailable])

  const stopWhisperRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.onerror = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <section className="voice-capture" aria-label="Voice input">
      <div className="voice-capture-preview">
        {supported && (
          <button
            type="button"
            className={`mic-button ${listening ? 'mic-preview-active' : ''}`}
            aria-label={listening ? 'Stop browser speech recognition' : 'Start browser speech recognition'}
            aria-pressed={listening}
            onClick={listening ? stop : start}
            disabled={recordingState !== 'idle'}
          >
            {listening ? <MicOff size={25} /> : <Mic size={27} />}
          </button>
        )}
        <div className="mic-copy">
          <strong>{recordingState === 'requesting' ? 'Requesting microphone…'
            : recordingState === 'recording' ? 'Recording…'
              : recordingState === 'transcribing' || processing ? 'Processing speech…'
                : listening ? 'Listening…' : 'Speak your observation'}</strong>
          <span>{supported ? `Browser speech recognition · ${locale}` : 'Browser speech recognition is unavailable. Text entry remains available.'}</span>
        </div>
        <span className={`recording-indicator ${listening || processing || recordingState === 'recording' ? 'active' : ''}`} />
      </div>

      {canRecord && accessToken && whisperAvailable && (
        <div className="whisper-controls">
          <button
            className="button button-secondary whisper-button"
            type="button"
            disabled={recordingState === 'transcribing' || recordingState === 'requesting' || listening}
            onClick={recordingState === 'recording' ? stopWhisperRecording : startWhisperRecording}
          >
            {recordingState === 'requesting' ? 'Requesting microphone…'
              : recordingState === 'recording' ? <><Square size={15} /> Stop and transcribe</>
              : recordingState === 'transcribing' ? 'Transcribing locally…'
                : <><Mic size={15} /> Use optional Whisper fallback</>}
          </button>
          <span>Audio is processed by the configured local model and then discarded.</span>
        </div>
      )}
      {canRecord && accessToken && !whisperAvailable && (
        <p className="voice-engine-note">Optional Whisper transcription is not configured on this backend. Browser speech and text entry remain available.</p>
      )}
      {canRecord && !accessToken && (
        <p className="voice-engine-note">Optional Whisper fallback needs a backend worker sign-in. Browser speech and text entry remain available.</p>
      )}

      {(interimTranscript || heardText) && (
        <div className="recognized-transcript" aria-live="polite">
          <strong>{interimTranscript ? 'Recognizing' : 'Recognized transcript'}</strong>
          <span>{interimTranscript || heardText}</span>
        </div>
      )}
      {(error || recordingError) && <p className="form-error voice-error" role="alert">{recordingError || error}</p>}
      <p className="voice-engine-note">Review the transcript and correct any recognition errors. Browser speech services may process audio outside this device.</p>
    </section>
  )
}

export function VoicePlayback({ text, locale }: { text: string; locale: string }) {
  const { supported, speaking, error, speak, stop } = useSpeechPlayback(text, locale)
  return (
    <>
      <div className={`voice-preview ${speaking ? 'is-previewing' : ''}`}>
        <button
          type="button"
          className="voice-preview-button"
          aria-label={speaking ? 'Stop speech playback' : 'Read visible message aloud'}
          aria-pressed={speaking}
          disabled={!supported}
          onClick={speaking ? stop : speak}
        >
          {speaking ? <Square size={18} /> : <Volume2 size={20} />}
        </button>
        <div>
          <strong>{speaking ? 'Speaking…' : supported ? 'Read this message aloud' : 'Speech playback unavailable'}</strong>
          <span>{supported ? `Text stays visible · voice locale ${locale}` : `No ${locale} speech voice is available here. The written message remains visible.`}</span>
        </div>
        <span className="voice-state-dot" />
      </div>
      {error && <p className="form-error voice-error" role="alert">{error}</p>}
    </>
  )
}

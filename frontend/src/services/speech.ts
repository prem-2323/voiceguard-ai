import { useCallback, useEffect, useRef, useState } from 'react'

export interface SpeechRecognitionCallbacks {
  onFinalTranscript: (text: string) => void
  onInterimTranscript: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export interface SpeechRecognitionSession {
  start: () => void
  stop: () => void
  abort: () => void
}

export interface SpeechRecognitionProvider {
  isSupported: () => boolean
  create: (locale: string, callbacks: SpeechRecognitionCallbacks) => SpeechRecognitionSession | null
}

function recognitionConstructor(): VoiceRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

function recognitionErrorMessage(code: string) {
  const messages: Record<string, string> = {
    'not-allowed': 'Microphone access was denied. You can still enter the report as text.',
    'service-not-allowed': 'The browser speech service is blocked. You can still enter the report as text.',
    'audio-capture': 'No microphone was found. You can still enter the report as text.',
    network: 'Browser speech recognition needs a network connection. You can still enter the report as text.',
    'no-speech': 'No speech was recognized. Try again or enter the report as text.',
    'language-not-supported': 'This browser does not support the selected speech language. Try text entry.',
  }
  return messages[code] ?? 'Speech recognition stopped. You can try again or enter the report as text.'
}

export const webSpeechRecognitionProvider: SpeechRecognitionProvider = {
  isSupported: () => Boolean(recognitionConstructor()),
  create: (locale, callbacks) => {
    const Constructor = recognitionConstructor()
    if (!Constructor) return null

    const recognition = new Constructor()
    recognition.lang = locale
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const finalParts: string[] = []
      const interimParts: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript?.trim()
        if (!transcript) continue
        if (result.isFinal) finalParts.push(transcript)
        else interimParts.push(transcript)
      }
      callbacks.onInterimTranscript(interimParts.join(' '))
      const finalText = finalParts.join(' ').trim()
      if (finalText) callbacks.onFinalTranscript(finalText)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') callbacks.onError(recognitionErrorMessage(event.error))
    }
    recognition.onend = callbacks.onEnd
    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
    }
  },
}

export function useSpeechRecognition(
  locale: string,
  onFinalTranscript: (text: string) => void,
  provider: SpeechRecognitionProvider = webSpeechRecognitionProvider,
) {
  const supported = provider.isSupported()
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionSession | null>(null)
  const callbackRef = useRef(onFinalTranscript)

  useEffect(() => {
    callbackRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!provider.isSupported()) {
      setError('Browser speech recognition is unavailable. You can still enter the report as text.')
      return
    }
    setError('')
    setInterimTranscript('')
    setProcessing(false)
    recognitionRef.current?.abort()
    const recognition = provider.create(locale, {
      onFinalTranscript: (text) => {
        setInterimTranscript('')
        setProcessing(true)
        callbackRef.current(text)
      },
      onInterimTranscript: setInterimTranscript,
      onError: (message) => {
        setError(message)
        setListening(false)
        setProcessing(false)
      },
      onEnd: () => {
        setListening(false)
        setProcessing(false)
      },
    })
    if (!recognition) {
      setError('Browser speech recognition is unavailable. You can still enter the report as text.')
      return
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
      setProcessing(false)
      setError('The microphone could not start. Try again or enter the report as text.')
    }
  }, [locale, provider])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, processing, interimTranscript, error, start, stop, clearError: () => setError('') }
}

function speechChunks(text: string, maximumLength = 180) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maximumLength && current) {
      chunks.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function matchingSpeechVoice(locale: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const language = locale.toLowerCase().split('-')[0]
  return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().split('-')[0] === language) ?? null
}

export function useSpeechPlayback(text: string, locale: string) {
  const speechApiAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const [voice, setVoice] = useState(() => matchingSpeechVoice(locale))
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState('')
  const supported = speechApiAvailable && voice !== null

  useEffect(() => {
    if (!speechApiAvailable) return
    const refreshVoices = () => setVoice(matchingSpeechVoice(locale))
    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
  }, [locale, speechApiAvailable])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(() => {
    if (!speechApiAvailable) {
      setError('The browser speech synthesis API is unavailable.')
      return
    }
    if (!voice) {
      setError(`No installed speech voice is available for ${locale}.`)
      return
    }
    if (!text.trim()) {
      setError('There is no text to speak.')
      return
    }
    setError('')
    window.speechSynthesis.cancel()
    const chunks = speechChunks(text)
    let remaining = chunks.length
    setSpeaking(true)
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = locale
      utterance.voice = voice
      utterance.rate = 0.92
      utterance.onend = () => {
        remaining -= 1
        if (remaining <= 0) setSpeaking(false)
      }
      utterance.onerror = (event) => {
        remaining = 0
        setSpeaking(false)
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          setError(`Speech playback failed (${event.error || 'unknown error'}).`)
        }
      }
      window.speechSynthesis.speak(utterance)
    }
  }, [locale, speechApiAvailable, text, voice])

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  return { supported, speaking, error, speak, stop, clearError: () => setError('') }
}

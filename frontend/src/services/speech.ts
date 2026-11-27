import { useCallback, useEffect, useRef, useState } from 'react'

function recognitionConstructor() {
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

export function useSpeechRecognition(locale: string, onFinalTranscript: (text: string) => void) {
  const [supported] = useState(() => Boolean(recognitionConstructor()))
  const [listening, setListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const callbackRef = useRef(onFinalTranscript)

  useEffect(() => {
    callbackRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      setError('Browser speech recognition is unavailable. You can still enter the report as text.')
      return
    }
    setError('')
    setInterimTranscript('')
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
      setInterimTranscript(interimParts.join(' '))
      const finalText = finalParts.join(' ').trim()
      if (finalText) {
        setInterimTranscript('')
        callbackRef.current(finalText)
      }
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(recognitionErrorMessage(event.error))
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
      setError('The microphone could not start. Try again or enter the report as text.')
    }
  }, [locale])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, interimTranscript, error, start, stop, clearError: () => setError('') }
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

export function useSpeechPlayback(text: string, locale: string) {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(() => {
    if (!supported || !text.trim()) return
    window.speechSynthesis.cancel()
    const chunks = speechChunks(text)
    let remaining = chunks.length
    setSpeaking(true)
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = locale
      utterance.rate = 0.92
      utterance.onend = () => {
        remaining -= 1
        if (remaining <= 0) setSpeaking(false)
      }
      utterance.onerror = () => {
        remaining = 0
        setSpeaking(false)
      }
      window.speechSynthesis.speak(utterance)
    }
  }, [locale, supported, text])

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  return { supported, speaking, speak, stop }
}

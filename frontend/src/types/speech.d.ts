export {}

declare global {
  interface VoiceRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }

  interface VoiceRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    readonly [index: number]: VoiceRecognitionAlternative
  }

  interface VoiceRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: {
      readonly length: number
      readonly [index: number]: VoiceRecognitionResult
    }
  }

  interface VoiceRecognitionErrorEvent extends Event {
    readonly error: string
    readonly message?: string
  }

  interface VoiceRecognition {
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    onresult: ((event: VoiceRecognitionEvent) => void) | null
    onerror: ((event: VoiceRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start(): void
    stop(): void
    abort(): void
  }

  interface VoiceRecognitionConstructor {
    new(): VoiceRecognition
  }

  interface Window {
    SpeechRecognition?: VoiceRecognitionConstructor
    webkitSpeechRecognition?: VoiceRecognitionConstructor
  }
}

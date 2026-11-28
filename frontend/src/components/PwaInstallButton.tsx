import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const showPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const hidePrompt = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', showPrompt)
    window.addEventListener('appinstalled', hidePrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', showPrompt)
      window.removeEventListener('appinstalled', hidePrompt)
    }
  }, [])

  if (!installPrompt) return null

  async function install() {
    const prompt = installPrompt
    if (!prompt) return
    try {
      await prompt.prompt()
      await prompt.userChoice
    } finally {
      setInstallPrompt(null)
    }
  }

  return <button className="button button-secondary pwa-install-button" type="button" onClick={() => void install()}><Download size={15} /> Install app</button>
}

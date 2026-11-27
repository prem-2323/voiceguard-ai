import { useEffect, useRef, useState } from 'react'

export type UpdateConnectionState = 'connecting' | 'live' | 'polling' | 'offline'

function updatesSocketUrl() {
  const configured = import.meta.env.VITE_API_WS_URL
  const apiBase = configured || `${import.meta.env.VITE_API_BASE_URL || '/api'}/ws/updates`
  const url = new URL(apiBase, window.location.href)
  if (url.protocol === 'https:') url.protocol = 'wss:'
  else if (url.protocol === 'http:') url.protocol = 'ws:'
  return url.toString()
}

export function useLiveUpdates(
  accessToken: string,
  onUpdate: () => void,
  pollIntervalMs = 5000,
): UpdateConnectionState {
  const onUpdateRef = useRef(onUpdate)
  const [connectionState, setConnectionState] = useState<UpdateConnectionState>('offline')

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!accessToken) {
      setConnectionState('offline')
      return
    }

    let closed = false
    let pollTimer: number | undefined
    let retryTimer: number | undefined
    let keepAliveTimer: number | undefined
    let socket: WebSocket | undefined

    const startPolling = () => {
      setConnectionState('polling')
      if (pollTimer === undefined) {
        pollTimer = window.setInterval(() => void onUpdateRef.current(), pollIntervalMs)
      }
    }
    const stopPolling = () => {
      if (pollTimer !== undefined) window.clearInterval(pollTimer)
      pollTimer = undefined
    }

    const connect = () => {
      if (closed) return
      setConnectionState('connecting')
      try {
        socket = new WebSocket(updatesSocketUrl())
      } catch {
        startPolling()
        retryTimer = window.setTimeout(connect, 15000)
        return
      }
      socket.onopen = () => {
        socket?.send(JSON.stringify({ token: accessToken }))
        keepAliveTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
        }, 20000)
      }
      socket.onmessage = (event) => {
        let message: { type?: string }
        try {
          message = JSON.parse(String(event.data)) as { type?: string }
        } catch {
          return
        }
        if (message.type === 'connected') {
          stopPolling()
          setConnectionState('live')
        } else if (message.type !== 'pong') {
          void onUpdateRef.current()
        }
      }
      socket.onclose = () => {
        if (keepAliveTimer !== undefined) window.clearInterval(keepAliveTimer)
        keepAliveTimer = undefined
        if (!closed) {
          startPolling()
          retryTimer = window.setTimeout(connect, 15000)
        }
      }
      socket.onerror = () => socket?.close()
    }

    startPolling()
    connect()
    return () => {
      closed = true
      stopPolling()
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      if (keepAliveTimer !== undefined) window.clearInterval(keepAliveTimer)
      socket?.close()
    }
  }, [accessToken, pollIntervalMs])

  return connectionState
}

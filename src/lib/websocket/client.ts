import type { ClientMessage, ServerMessage } from '@/types'

type MessageHandler = (message: ServerMessage) => void
type StateHandler = (state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void

export class GameWebSocket {
  private ws: WebSocket | null = null
  private handlers: Set<MessageHandler> = new Set()
  private stateHandlers: Set<StateHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 8
  private reconnectDelay = 1000
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private url = ''
  private token = ''
  private roomCode = ''
  private displayName = 'Player'
  private disposed = false

  connect(url: string, token: string, roomCode: string, displayName: string): Promise<void> {
    this.url = url
    this.token = token
    this.roomCode = roomCode
    this.displayName = displayName
    this.disposed = false

    return this.attemptConnect(3, 1200)
  }

  private attemptConnect(retriesLeft: number, retryDelay: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.disposed) return reject(new Error('Disposed'))

      this.emitState('connecting')

      try {
        if (this.ws) {
          try { this.ws.close(1000) } catch { /* noop */ }
          this.ws = null
        }

        this.ws = new WebSocket(this.url)

        const connectTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            try { this.ws?.close() } catch { /* noop */ }
            if (retriesLeft > 0 && !this.disposed) {
              setTimeout(() => {
                this.attemptConnect(retriesLeft - 1, retryDelay).then(resolve, reject)
              }, retryDelay)
            } else {
              this.emitState('failed')
              reject(new Error('Connection timed out'))
            }
          }
        }, 8000)

        this.ws.onopen = () => {
          clearTimeout(connectTimeout)
          if (this.disposed) { this.ws?.close(); return }
          this.reconnectAttempts = 0
          this.send({
            type: 'join_room',
            payload: { roomCode: this.roomCode, token: this.token, displayName: this.displayName },
          })
          this.startPing()
          this.emitState('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data)
            this.handlers.forEach((handler) => handler(message))
          } catch {
            console.error('Failed to parse WebSocket message')
          }
        }

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout)
          this.stopPing()

          if (this.disposed) return

          if (!event.wasClean) {
            if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.CLOSED) {
              if (retriesLeft > 0) {
                setTimeout(() => {
                  if (this.disposed) return
                  this.attemptConnect(retriesLeft - 1, retryDelay).then(resolve, reject)
                }, retryDelay)
                return
              }
            }

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.emitState('connecting')
              this.backgroundReconnect()
            } else {
              this.emitState('failed')
            }
          }
        }

        this.ws.onerror = () => {
          // Don't reject here -- let onclose handle retry logic
        }
      } catch (error) {
        this.emitState('failed')
        reject(error)
      }
    })
  }

  private backgroundReconnect() {
    if (this.disposed) return
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4))

    setTimeout(() => {
      if (this.disposed) return
      this.emitState('connecting')

      this.attemptConnect(0, 0).then(() => {
        this.emitState('connected')
      }).catch(() => {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emitState('failed')
          this.handlers.forEach((handler) =>
            handler({ type: 'error', payload: { message: 'Connection lost. Please refresh.', code: 'RECONNECT_FAILED' } })
          )
        } else {
          this.backgroundReconnect()
        }
      })
    }, delay)
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler)
    return () => { this.handlers.delete(handler) }
  }

  onStateChange(handler: StateHandler) {
    this.stateHandlers.add(handler)
    return () => { this.stateHandlers.delete(handler) }
  }

  private emitState(state: 'connecting' | 'connected' | 'disconnected' | 'failed') {
    this.stateHandlers.forEach((handler) => handler(state))
  }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  disconnect() {
    this.disposed = true
    this.stopPing()
    this.reconnectAttempts = this.maxReconnectAttempts
    if (this.ws) {
      try { this.ws.close(1000, 'Client disconnect') } catch { /* noop */ }
      this.ws = null
    }
    this.handlers.clear()
    this.stateHandlers.clear()
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

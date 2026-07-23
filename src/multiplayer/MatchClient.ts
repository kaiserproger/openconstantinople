import {
  parseServerMessage,
  type ClientMessage,
  type MatchCommand,
  type ServerMessage,
} from './protocol'

export type MatchConnectionStatus = 'offline' | 'connecting' | 'online' | 'error'

export class MatchClient {
  private socket: WebSocket | null = null
  private revision = 0
  private commandSequence = 0

  constructor(
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onStatus: (status: MatchConnectionStatus) => void,
  ) {}

  connect(url: string, roomId: string, playerName: string, nationId: string): void {
    this.disconnect()
    this.onStatus('connecting')
    const socket = new WebSocket(url)
    this.socket = socket
    socket.addEventListener('open', () => {
      this.send({ type: 'join', roomId, playerName, nationId })
    })
    socket.addEventListener('message', (event) => {
      let decoded: unknown
      try {
        decoded = JSON.parse(String(event.data))
      } catch {
        this.onStatus('error')
        return
      }
      const message = parseServerMessage(decoded)
      if (!message) {
        this.onStatus('error')
        return
      }
      if (message.type === 'snapshot') {
        this.revision = message.revision
        this.onStatus('online')
      }
      this.onMessage(message)
    })
    socket.addEventListener('error', () => this.onStatus('error'))
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null
        this.onStatus('offline')
      }
    })
  }

  command(command: MatchCommand): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false
    this.commandSequence += 1
    this.send({
      type: 'command',
      commandId: `command-${this.commandSequence}`,
      revision: this.revision,
      command,
    })
    return true
  }

  disconnect(): void {
    const socket = this.socket
    this.socket = null
    if (socket) socket.close()
    this.revision = 0
    this.onStatus('offline')
  }

  private send(message: ClientMessage): void {
    this.socket?.send(JSON.stringify(message))
  }
}

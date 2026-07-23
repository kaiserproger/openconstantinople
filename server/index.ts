import { MatchServer } from './MatchServer'

const port = Number(process.env.MATCH_PORT ?? 5175)
const server = new MatchServer()
await server.listen(port, '0.0.0.0')
console.info(`[match-server] listening on ${port}`)

async function shutdown(): Promise<void> {
  await server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

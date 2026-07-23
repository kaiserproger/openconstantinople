import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import {
  answerAllianceOffer,
  answerPeaceOffer,
  advanceCampaign,
  beginAllianceSupportMarch,
  beginCampaignMarch,
  beginSiegeMarch,
  breakAlliance,
  campaignActionBlockReason,
  createCampaign,
  declareWar,
  musterProvince,
  openTradeRoute,
  offerAlliance,
  proposePeace,
  recallCampaignMarch,
  retreatSiege,
  realmEconomy,
  resolveCampaignMarches,
  sendAllianceSilver,
  sendGift,
  setSiegeTactic,
  setTradeEmbargo,
  setProvinceDefenseFormation,
  sortieSiege,
  startProvinceProject,
  withdrawPeaceOffer,
  type CampaignCommandResult,
  type CampaignState,
} from '../src/game/campaign'
import { NATIONS } from '../src/game/nations'
import {
  parseClientMessage,
  type ClientMessage,
  type MatchPlayer,
  type MatchEvent,
  type MatchPhase,
  type ServerMessage,
} from '../src/multiplayer/protocol'

const MIN_MATCH_PLAYERS = 2

interface Room {
  id: string
  revision: number
  phase: MatchPhase
  campaign: CampaignState
  clients: Map<WebSocket, MatchParticipant>
  events: MatchEvent[]
  nextCampaignDayAt: number
}

type MatchParticipant = MatchPlayer

export class MatchServer {
  private readonly httpServer: Server
  private readonly socketServer: WebSocketServer
  private readonly rooms = new Map<string, Room>()
  private readonly marchDurationMs: number
  private readonly marchPollMs: number
  private readonly campaignDayMs: number
  private readonly campaignFactory: (seed: string) => CampaignState
  private marchTimer: NodeJS.Timeout | null = null

  constructor(options: {
    marchDurationMs?: number
    marchPollMs?: number
    campaignDayMs?: number
    campaignFactory?: (seed: string) => CampaignState
  } = {}) {
    this.marchDurationMs = options.marchDurationMs ?? 3000
    this.marchPollMs = options.marchPollMs ?? 50
    this.campaignDayMs = options.campaignDayMs ?? 5000
    this.campaignFactory = options.campaignFactory ?? createCampaign
    this.httpServer = createServer((request, response) => {
      if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: true, rooms: this.rooms.size }))
        return
      }
      response.writeHead(404)
      response.end()
    })
    this.socketServer = new WebSocketServer({ server: this.httpServer, maxPayload: 8192 })
    this.socketServer.on('connection', (socket) => {
      socket.on('message', (payload) => this.receive(socket, payload.toString()))
      socket.on('close', () => this.leave(socket))
    })
  }

  async listen(port = 5175, host = '127.0.0.1'): Promise<number> {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject)
      this.httpServer.listen(port, host, () => {
        this.httpServer.off('error', reject)
        resolve()
      })
    })
    const address = this.httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Match server did not bind a TCP port')
    this.marchTimer ??= setInterval(() => this.resolveDueMarches(), this.marchPollMs)
    return address.port
  }

  async close(): Promise<void> {
    if (this.marchTimer) clearInterval(this.marchTimer)
    this.marchTimer = null
    for (const client of this.socketServer.clients) client.terminate()
    await new Promise<void>((resolve, reject) => {
      this.socketServer.close(() => {
        this.httpServer.close((error) => error ? reject(error) : resolve())
      })
    })
  }

  private receive(socket: WebSocket, payload: string): void {
    let decoded: unknown
    try {
      decoded = JSON.parse(payload)
    } catch {
      this.reject(socket, null, 'Некорректное сообщение')
      return
    }
    const message = parseClientMessage(decoded)
    if (!message) {
      this.reject(socket, null, 'Команда не прошла проверку')
      return
    }
    if (message.type === 'join') {
      this.join(socket, message)
      return
    }
    this.command(socket, message)
  }

  private join(socket: WebSocket, message: Extract<ClientMessage, { type: 'join' }>): void {
    if (this.roomFor(socket)) {
      this.reject(socket, null, 'Подключение уже состоит в матче')
      return
    }
    if (!NATIONS.some((nation) => nation.id === message.nationId)) {
      this.reject(socket, null, 'Такой нации нет в этом сценарии')
      return
    }
    const room = this.rooms.get(message.roomId) ?? {
      id: message.roomId,
      revision: 0,
      phase: 'lobby' as const,
      campaign: this.campaignFactory(`match:${message.roomId}`),
      clients: new Map<WebSocket, MatchParticipant>(),
      events: [],
      nextCampaignDayAt: Number.POSITIVE_INFINITY,
    }
    if (room.phase !== 'lobby') {
      this.reject(socket, null, room.phase === 'finished' ? 'Матч уже завершён' : 'Матч уже начался')
      return
    }
    if ([...room.clients.values()].some((player) => player.nationId === message.nationId)) {
      this.reject(socket, null, 'Эта нация уже занята другим игроком')
      return
    }
    if (room.campaign.realms.find((realm) => realm.id === message.nationId)?.status === 'defeated') {
      this.reject(socket, null, 'Эта держава уже разгромлена')
      return
    }
    if (!this.rooms.has(room.id)) this.rooms.set(room.id, room)
    room.clients.set(socket, {
      id: randomUUID(),
      name: message.playerName,
      nationId: message.nationId,
      ready: false,
    })
    this.broadcast(room)
  }

  private command(socket: WebSocket, message: Extract<ClientMessage, { type: 'command' }>): void {
    const found = this.roomFor(socket)
    if (!found) {
      this.reject(socket, message.commandId, 'Сначала войдите в матч')
      return
    }
    const { room, player } = found
    if (message.command.type === 'lobby.ready') {
      this.setReady(socket, room, player, message)
      return
    }
    if (message.revision !== room.revision) {
      this.reject(socket, message.commandId, 'Состояние матча устарело')
      this.sendSnapshot(socket, room, player)
      return
    }
    if (room.phase === 'lobby') {
      this.reject(socket, message.commandId, 'Матч ещё не начался')
      return
    }
    const blocked = campaignActionBlockReason(room.campaign, player.nationId)
    if (blocked) {
      this.reject(socket, message.commandId, blocked)
      return
    }
    const now = Date.now()
    let eventKind: MatchEvent['kind']
    let provinceId: number | null = null
    let result: CampaignCommandResult
    if (message.command.type === 'campaign.attack') {
      result = beginCampaignMarch(room.campaign, {
          id: randomUUID(),
          actorId: player.nationId,
          sourceId: message.command.sourceId,
          targetId: message.command.targetId,
          commitmentPercent: message.command.commitment,
          formation: message.command.formation,
          departedAt: now,
          arrivesAt: now + this.marchDurationMs,
        })
      eventKind = 'march-started'
      provinceId = message.command.targetId
    } else if (message.command.type === 'campaign.support') {
      const { sourceId, targetId, commitment, formation } = message.command
      const target = room.campaign.provinces.find((province) => province.id === targetId)
      if (!target?.owner || !this.hasNation(room, target.owner)) {
        result = { ok: false, reason: 'У союзной державы нет правителя в этом матче' }
      } else {
        result = beginAllianceSupportMarch(room.campaign, {
          id: randomUUID(),
          actorId: player.nationId,
          sourceId,
          targetId,
          commitmentPercent: commitment,
          formation,
          departedAt: now,
          arrivesAt: now + this.marchDurationMs,
        })
      }
      eventKind = 'alliance-support-started'
      provinceId = targetId
    } else if (message.command.type === 'campaign.transfer') {
      result = this.hasNation(room, message.command.targetNationId)
        ? sendAllianceSilver(
            room.campaign,
            message.command.targetNationId,
            message.command.amount,
            player.nationId,
          )
        : { ok: false, reason: 'У союзной державы нет правителя в этом матче' }
      eventKind = 'alliance-silver-sent'
    } else if (message.command.type === 'campaign.trade-route') {
      const { sourceId, targetId } = message.command
      const target = room.campaign.provinces.find((province) => province.id === targetId)
      if (!target?.owner || !this.hasNation(room, target.owner)) {
        result = { ok: false, reason: 'У соседней державы нет правителя в этом матче' }
      } else {
        result = openTradeRoute(room.campaign, sourceId, targetId, player.nationId, randomUUID())
      }
      eventKind = 'trade-route-opened'
      provinceId = targetId
    } else if (message.command.type === 'campaign.trade-policy') {
      result = setTradeEmbargo(
        room.campaign,
        message.command.targetNationId,
        message.command.embargoed,
        player.nationId,
      )
      eventKind = message.command.embargoed ? 'trade-embargoed' : 'trade-resumed'
    } else if (message.command.type === 'campaign.siege-tactic') {
      const { siegeId, tactic } = message.command
      const siege = room.campaign.sieges.find((item) => item.id === siegeId)
      result = setSiegeTactic(
        room.campaign,
        siegeId,
        tactic,
        player.nationId,
      )
      eventKind = 'siege-tactic'
      provinceId = siege?.targetId ?? null
    } else if (message.command.type === 'campaign.siege-retreat') {
      const { siegeId } = message.command
      const siege = room.campaign.sieges.find((item) => item.id === siegeId)
      result = retreatSiege(room.campaign, siegeId, player.nationId)
      eventKind = 'siege-retreated'
      provinceId = siege?.targetId ?? null
    } else if (message.command.type === 'campaign.siege-sortie') {
      const { siegeId } = message.command
      const siege = room.campaign.sieges.find((item) => item.id === siegeId)
      result = sortieSiege(room.campaign, siegeId, player.nationId)
      eventKind = 'siege-sortie'
      provinceId = siege?.targetId ?? null
    } else if (message.command.type === 'campaign.siege-march') {
      const { siegeId, sourceId, commitment, formation } = message.command
      const siege = room.campaign.sieges.find((item) => item.id === siegeId)
      result = beginSiegeMarch(room.campaign, {
        id: randomUUID(),
        siegeId,
        actorId: player.nationId,
        sourceId,
        commitmentPercent: commitment,
        formation,
        departedAt: now,
        arrivesAt: now + this.marchDurationMs,
      })
      eventKind = 'march-started'
      provinceId = siege?.targetId ?? null
    } else if (message.command.type === 'campaign.recall') {
      const { marchId } = message.command
      const march = room.campaign.marches.find((item) => (
        item.id === marchId && item.actorId === player.nationId
      ))
      result = recallCampaignMarch(room.campaign, marchId, player.nationId)
      eventKind = 'march-recalled'
      provinceId = march?.sourceId ?? null
    } else if (message.command.type === 'campaign.muster') {
      result = musterProvince(room.campaign, message.command.provinceId, player.nationId)
      eventKind = 'province-mustered'
      provinceId = message.command.provinceId
    } else if (message.command.type === 'campaign.develop') {
      result = startProvinceProject(
        room.campaign,
        message.command.provinceId,
        message.command.project,
        player.nationId,
      )
      eventKind = 'province-project-started'
      provinceId = message.command.provinceId
    } else if (message.command.type === 'campaign.defense') {
      result = setProvinceDefenseFormation(
        room.campaign,
        message.command.provinceId,
        message.command.formation,
        player.nationId,
      )
      eventKind = 'province-formation'
      provinceId = message.command.provinceId
    } else {
      result = this.diplomacy(
        room,
        player,
        message.command.targetNationId,
        message.command.action,
        message.command.provinceId,
      )
      eventKind = message.command.action === 'alliance-offer'
        ? 'alliance-offered'
        : message.command.action === 'alliance-accept'
          ? 'alliance-accepted'
          : message.command.action === 'alliance-decline'
            ? 'alliance-declined'
            : message.command.action === 'truce' || message.command.action === 'peace-demand'
              ? 'peace-offered'
              : message.command.action === 'peace-accept'
                ? 'peace-accepted'
                : message.command.action === 'peace-reject' || message.command.action === 'peace-withdraw'
                  ? 'peace-rejected'
            : 'diplomacy-changed'
      provinceId = message.command.provinceId ?? null
    }
    if (!result.ok) {
      this.reject(socket, message.commandId, result.reason)
      return
    }
    room.revision += 1
    room.events = [{
      revision: room.revision,
      kind: eventKind,
      message: result.message,
      provinceId,
    }]
    this.broadcast(room)
  }

  private setReady(
    socket: WebSocket,
    room: Room,
    player: MatchParticipant,
    message: Extract<ClientMessage, { type: 'command' }>,
  ): void {
    if (room.phase !== 'lobby') {
      this.reject(socket, message.commandId, 'Состав матча уже зафиксирован')
      return
    }
    const ready = message.command.type === 'lobby.ready' && message.command.ready
    if (player.ready === ready) {
      this.reject(socket, message.commandId, ready ? 'Готовность уже подтверждена' : 'Готовность уже снята')
      return
    }
    player.ready = ready
    room.revision += 1
    room.events = [{
      revision: room.revision,
      kind: 'player-ready',
      message: ready ? `${player.name} готов к войне` : `${player.name} отозвал готовность`,
      provinceId: null,
    }]
    if (this.maybeStart(room)) {
      room.events.push({
        revision: room.revision,
        kind: 'match-started',
        message: 'Все правители готовы · война держав началась',
        provinceId: null,
      })
    }
    this.broadcast(room)
  }

  private maybeStart(room: Room): boolean {
    if (
      room.phase !== 'lobby'
      || room.clients.size < MIN_MATCH_PLAYERS
      || [...room.clients.values()].some((player) => !player.ready)
    ) return false
    room.phase = 'running'
    room.nextCampaignDayAt = Date.now() + this.campaignDayMs
    return true
  }

  private resolveDueMarches(): void {
    const now = Date.now()
    for (const room of this.rooms.values()) {
      if (room.phase !== 'running') continue
      const pendingEvents: Array<Omit<MatchEvent, 'revision'>> = []
      const advanceDay = (dayAt: number) => {
        const occupiedRealms = new Set([...room.clients.values()].map((player) => player.nationId))
        const aiRealmIds = room.campaign.realms
          .filter((realm) => realm.status === 'active' && !occupiedRealms.has(realm.id))
          .map((realm) => realm.id)
        const reports = advanceCampaign(room.campaign, 1, {
          aiRealmIds,
          marchTiming: {
            departedAt: dayAt,
            legDurationMs: this.marchDurationMs,
          },
        })
        pendingEvents.push({
          kind: 'day-advanced',
          message: `День ${room.campaign.tick}: владения пополнили казну держав`,
          provinceId: null,
        })
        for (const report of reports.filter((item) => item.kind === 'project-completed')) {
          pendingEvents.push({
            kind: 'province-project-completed',
            message: report.message,
            provinceId: report.provinceId,
          })
        }
        for (const report of reports.filter((item) => item.kind === 'march-started')) {
          pendingEvents.push({
            kind: 'march-started',
            message: report.message,
            provinceId: report.provinceId,
          })
        }
        for (const report of reports) {
          if (
            report.kind !== 'siege-advanced'
            && report.kind !== 'siege-resolved'
            && report.kind !== 'siege-lifted'
          ) continue
          pendingEvents.push({
            kind: report.kind,
            message: report.message,
            provinceId: report.provinceId,
          })
          const defeated = report.message.includes('держава разгромлена')
            ? room.campaign.realms.find((realm) => realm.status === 'defeated' && realm.defeatedAt === room.campaign.tick)
            : null
          if (defeated) {
            pendingEvents.push({
              kind: 'realm-defeated',
              message: `${defeated.name} больше не владеет землями`,
              provinceId: report.provinceId,
            })
          }
          if (room.campaign.winnerRealmId && report.kind === 'siege-resolved') {
            const winner = room.campaign.realms.find((realm) => realm.id === room.campaign.winnerRealmId)
            pendingEvents.push({
              kind: 'match-finished',
              message: `${winner?.name ?? 'Держава'} побеждает в матче`,
              provinceId: report.provinceId,
            })
          }
        }
      }
      const resolveMarchesAt = (cutoff: number) => {
        for (const report of resolveCampaignMarches(room.campaign, cutoff)) {
          pendingEvents.push({
            kind: report.outcome === 'besieged' ? 'siege-started' : 'march-resolved',
            message: report.message,
            provinceId: report.targetId,
          })
          if (report.defeatedRealmId) {
            const defeated = room.campaign.realms.find((realm) => realm.id === report.defeatedRealmId)
            pendingEvents.push({
              kind: 'realm-defeated',
              message: `${defeated?.name ?? 'Держава'} больше не владеет землями`,
              provinceId: report.targetId,
            })
          }
          if (report.winnerRealmId) {
            const winner = room.campaign.realms.find((realm) => realm.id === report.winnerRealmId)
            pendingEvents.push({
              kind: 'match-finished',
              message: `${winner?.name ?? 'Держава'} побеждает в матче`,
              provinceId: report.targetId,
            })
          }
        }
      }

      while (!room.campaign.winnerRealmId) {
        const nextArrival = room.campaign.marches
          .filter((march) => march.arrivesAt <= now)
          .reduce<number | null>((earliest, march) => (
            earliest === null || march.arrivesAt < earliest ? march.arrivesAt : earliest
          ), null)
        const nextDay = room.nextCampaignDayAt <= now ? room.nextCampaignDayAt : null
        if (nextArrival === null && nextDay === null) break
        if (nextArrival !== null && (nextDay === null || nextArrival < nextDay)) {
          resolveMarchesAt(nextArrival)
          continue
        }
        advanceDay(nextDay!)
        room.nextCampaignDayAt += this.campaignDayMs
      }
      if (pendingEvents.length === 0) continue

      room.revision += 1
      room.events = pendingEvents.map((event) => ({ ...event, revision: room.revision }))
      if (room.campaign.winnerRealmId) room.phase = 'finished'
      this.broadcast(room)
    }
  }

  private diplomacy(
    room: Room,
    player: MatchParticipant,
    targetNationId: string,
    action: Extract<Extract<ClientMessage, { type: 'command' }>['command'], { type: 'campaign.diplomacy' }>['action'],
    provinceId?: number,
  ): CampaignCommandResult {
    const { campaign } = room
    if (!campaign.realms.some((realm) => realm.id === targetNationId) || player.nationId === targetNationId) {
      return { ok: false, reason: 'Держава не найдена' }
    }
    if (action === 'gift') return sendGift(campaign, targetNationId, player.nationId)
    if (action === 'alliance-offer') {
      if (![...room.clients.values()].some((participant) => participant.nationId === targetNationId)) {
        return { ok: false, reason: 'У державы нет правителя в этом матче' }
      }
      return offerAlliance(campaign, targetNationId, player.nationId)
    }
    if (action === 'alliance-accept') {
      return answerAllianceOffer(campaign, targetNationId, true, player.nationId)
    }
    if (action === 'alliance-decline') {
      return answerAllianceOffer(campaign, targetNationId, false, player.nationId)
    }
    if (action === 'war') return declareWar(campaign, targetNationId, player.nationId)
    if (action === 'truce' || action === 'peace-demand') {
      if (!this.hasNation(room, targetNationId)) {
        return { ok: false, reason: 'У державы нет правителя в этом матче' }
      }
      return proposePeace(
        campaign,
        targetNationId,
        action === 'peace-demand' ? provinceId ?? null : null,
        player.nationId,
      )
    }
    if (action === 'peace-accept') return answerPeaceOffer(campaign, targetNationId, true, player.nationId)
    if (action === 'peace-reject') return answerPeaceOffer(campaign, targetNationId, false, player.nationId)
    if (action === 'peace-withdraw') return withdrawPeaceOffer(campaign, targetNationId, player.nationId)
    return breakAlliance(campaign, targetNationId, player.nationId)
  }

  private hasNation(room: Room, nationId: string): boolean {
    return [...room.clients.values()].some((participant) => participant.nationId === nationId)
  }

  private leave(socket: WebSocket): void {
    const found = this.roomFor(socket)
    if (!found) return
    const { room, player } = found
    room.clients.delete(socket)
    if (room.clients.size === 0) {
      this.rooms.delete(room.id)
      return
    }

    const offerCount = room.campaign.allianceOffers.length
    room.campaign.allianceOffers = room.campaign.allianceOffers.filter((offer) => (
      offer.fromRealmId !== player.nationId && offer.toRealmId !== player.nationId
    ))
    const cancelledOffers = offerCount - room.campaign.allianceOffers.length
    const peaceOfferCount = room.campaign.peaceOffers.length
    room.campaign.peaceOffers = room.campaign.peaceOffers.filter((offer) => (
      offer.fromRealmId !== player.nationId && offer.toRealmId !== player.nationId
    ))
    const cancelledPeaceOffers = peaceOfferCount - room.campaign.peaceOffers.length
    const tradeRouteCount = room.campaign.tradeRoutes.length
    room.campaign.tradeRoutes = room.campaign.tradeRoutes.filter((route) => (
      !route.realmIds.includes(player.nationId)
    ))
    const closedTradeRoutes = tradeRouteCount - room.campaign.tradeRoutes.length
    const events: Array<Omit<MatchEvent, 'revision'>> = []
    if (cancelledOffers > 0) {
      events.push({
        kind: 'alliance-declined',
        message: cancelledOffers === 1
          ? `Предложение союза отменено: ${player.name} покинул матч`
          : `Союзные предложения отменены: ${player.name} покинул матч`,
        provinceId: null,
      })
    }
    if (cancelledPeaceOffers > 0) {
      events.push({
        kind: 'peace-rejected',
        message: `Мирные условия отменены: ${player.name} покинул матч`,
        provinceId: null,
      })
    }
    if (closedTradeRoutes > 0) {
      events.push({
        kind: 'trade-route-closed',
        message: closedTradeRoutes === 1
          ? `Торговый путь закрыт: ${player.name} покинул матч`
          : `Торговые пути закрыты: ${player.name} покинул матч`,
        provinceId: null,
      })
    }
    if (this.maybeStart(room)) {
      events.push({
        kind: 'match-started',
        message: 'Все оставшиеся правители готовы · война держав началась',
        provinceId: null,
      })
    }
    if (events.length > 0) {
      room.revision += 1
      room.events = events.map((event) => ({ ...event, revision: room.revision }))
    }
    this.broadcast(room)
  }

  private roomFor(socket: WebSocket): { room: Room; player: MatchParticipant } | null {
    for (const room of this.rooms.values()) {
      const player = room.clients.get(socket)
      if (player) return { room, player }
    }
    return null
  }

  private broadcast(room: Room): void {
    for (const [socket, player] of room.clients) this.sendSnapshot(socket, room, player)
  }

  private sendSnapshot(socket: WebSocket, room: Room, player: MatchParticipant): void {
    const economy = realmEconomy(room.campaign, player.nationId)
    this.send(socket, {
      type: 'snapshot',
      roomId: room.id,
      revision: room.revision,
      phase: room.phase,
      serverNow: Date.now(),
      self: {
        playerId: player.id,
        silver: economy?.silver ?? 0,
        legitimacy: economy?.legitimacy ?? 0,
      },
      campaign: room.campaign,
      players: [...room.clients.values()].map(({ id, name, nationId, ready }) => ({ id, name, nationId, ready })),
      events: room.events,
    })
  }

  private reject(socket: WebSocket, commandId: string | null, reason: string): void {
    this.send(socket, { type: 'rejected', commandId, reason })
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }
}

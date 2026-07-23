import WebSocket, { type RawData } from 'ws'
import { MatchServer } from '../server/MatchServer'
import { campaignRelation, createCampaign, provincesAreAdjacent, realmDailyIncome } from '../src/game/campaign'
import type { ClientMessage, ServerMessage } from '../src/multiplayer/protocol'
import { createFinalCampaign } from './fixtures/finalCampaign'

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    socket.once('error', onError)
    socket.once('message', (payload) => {
      socket.off('error', onError)
      resolve(JSON.parse(payload.toString()) as ServerMessage)
    })
  })
}

function nextMessages(socket: WebSocket, count: number): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = []
    const cleanup = () => {
      socket.off('message', onMessage)
      socket.off('error', onError)
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onMessage = (payload: RawData) => {
      messages.push(JSON.parse(payload.toString()) as ServerMessage)
      if (messages.length < count) return
      cleanup()
      resolve(messages)
    }
    socket.on('message', onMessage)
    socket.on('error', onError)
  })
}

function send(socket: WebSocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message))
}

function expectNoMessage(socket: WebSocket, durationMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (payload: RawData) => {
      clearTimeout(timer)
      reject(new Error(`Unexpected server message: ${payload.toString()}`))
    }
    const timer = setTimeout(() => {
      socket.off('message', onMessage)
      resolve()
    }, durationMs)
    socket.once('message', onMessage)
  })
}

async function startTwoPlayerMatch(
  first: WebSocket,
  second: WebSocket,
  revision = 0,
): Promise<[ServerMessage, ServerMessage]> {
  const firstReadyView = nextMessage(first)
  const secondObservesFirst = nextMessage(second)
  send(first, {
    type: 'command',
    commandId: 'ready-first',
    revision,
    command: { type: 'lobby.ready', ready: true },
  })
  const waitingViews = await Promise.all([firstReadyView, secondObservesFirst])
  for (const view of waitingViews) {
    expect(view).toMatchObject({
      type: 'snapshot',
      revision: revision + 1,
      phase: 'lobby',
      players: expect.arrayContaining([expect.objectContaining({ ready: true })]),
    })
  }

  const firstObservesStart = nextMessage(first)
  const secondReadyView = nextMessage(second)
  send(second, {
    type: 'command',
    commandId: 'ready-second',
    revision: revision + 1,
    command: { type: 'lobby.ready', ready: true },
  })
  const startedViews = await Promise.all([firstObservesStart, secondReadyView]) as [ServerMessage, ServerMessage]
  for (const view of startedViews) {
    expect(view).toMatchObject({
      type: 'snapshot',
      revision: revision + 2,
      phase: 'running',
      events: expect.arrayContaining([expect.objectContaining({ kind: 'match-started' })]),
      players: expect.arrayContaining([
        expect.objectContaining({ ready: true }),
        expect.objectContaining({ ready: true }),
      ]),
    })
  }
  return startedViews
}

describe('authoritative multiplayer match server', () => {
  let server: MatchServer
  let url: string

  beforeEach(async () => {
    server = new MatchServer({ marchDurationMs: 80, marchPollMs: 5 })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
  })

  afterEach(async () => {
    await server.close()
  })

  it('binds each socket to one nation and broadcasts accepted border changes', async () => {
    await server.close()
    server = new MatchServer({ marchDurationMs: 300, marchPollMs: 5 })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)

    const firstSnapshot = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'shared-border', playerName: 'Alexios', nationId: 'porphyry' })
    expect(await firstSnapshot).toMatchObject({ type: 'snapshot', revision: 0, phase: 'lobby' })

    const porphyryRoster = nextMessage(porphyry)
    const seljukRoster = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'shared-border', playerName: 'Kutlug', nationId: 'seljuk' })
    const [porphyryReady, seljukReady] = await Promise.all([porphyryRoster, seljukRoster])
    expect(porphyryReady).toMatchObject({ type: 'snapshot', revision: 0 })
    expect(seljukReady).toMatchObject({ type: 'snapshot', revision: 0 })
    if (porphyryReady.type !== 'snapshot') throw new Error('Expected campaign snapshot')

    const source = porphyryReady.campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = porphyryReady.campaign.provinces.find((province) => province.column === 3 && province.row === 4)!

    const beforeStart = nextMessage(porphyry)
    send(porphyry, {
      type: 'command',
      commandId: 'too-early',
      revision: 0,
      command: { type: 'campaign.attack', sourceId: source.id, targetId: target.id, commitment: 75, formation: 'wedge' },
    })
    expect(await beforeStart).toEqual({
      type: 'rejected',
      commandId: 'too-early',
      reason: 'Матч ещё не начался',
    })

    await startTwoPlayerMatch(porphyry, seljuk)

    const invalidCommitment = nextMessage(porphyry)
    send(porphyry, {
      type: 'command',
      commandId: 'invalid-commitment',
      revision: 2,
      command: { type: 'campaign.attack', sourceId: source.id, targetId: target.id, commitment: 52, formation: 'line' },
    })
    expect(await invalidCommitment).toEqual({
      type: 'rejected',
      commandId: null,
      reason: 'Команда не прошла проверку',
    })

    const late = await openSocket(url)
    const lateRejected = nextMessage(late)
    send(late, { type: 'join', roomId: 'shared-border', playerName: 'Tervel', nationId: 'bulgar' })
    expect(await lateRejected).toEqual({
      type: 'rejected',
      commandId: null,
      reason: 'Матч уже начался',
    })

    const rejected = nextMessage(seljuk)
    send(seljuk, {
      type: 'command',
      commandId: 'forged-order',
      revision: 2,
      command: { type: 'campaign.attack', sourceId: source.id, targetId: target.id, commitment: 75, formation: 'wedge' },
    })
    expect(await rejected).toEqual({
      type: 'rejected',
      commandId: 'forged-order',
      reason: 'Исходная провинция не принадлежит вашей державе',
    })

    const porphyryDeparture = nextMessage(porphyry)
    const seljukDeparture = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'lawful-order',
      revision: 2,
      command: { type: 'campaign.attack', sourceId: source.id, targetId: target.id, commitment: 75, formation: 'wedge' },
    })
    const [firstDeparture, secondDeparture] = await Promise.all([porphyryDeparture, seljukDeparture])
    for (const view of [firstDeparture, secondDeparture]) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 3,
        campaign: { marches: [expect.objectContaining({ actorId: 'porphyry', targetId: target.id, formation: 'wedge' })] },
      })
      if (view.type === 'snapshot') {
        expect(view.campaign.provinces.find((province) => province.id === target.id)?.owner).toBe(null)
      }
    }

    if (firstDeparture.type !== 'snapshot') throw new Error('Expected departure snapshot')
    const firstMarch = firstDeparture.campaign.marches[0]
    const departureGarrison = firstDeparture.campaign.provinces.find((province) => province.id === source.id)!.levies
    const porphyryRecall = nextMessage(porphyry)
    const seljukRecall = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'recall-lawful-order',
      revision: 3,
      command: { type: 'campaign.recall', marchId: firstMarch.id },
    })
    const recalledViews = await Promise.all([porphyryRecall, seljukRecall])
    for (const view of recalledViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        events: [expect.objectContaining({
          kind: 'march-recalled',
          provinceId: source.id,
          message: expect.stringContaining('потери'),
        })],
        campaign: { marches: [] },
      })
      if (view.type === 'snapshot') {
        const expectedGarrison = departureGarrison + firstMarch.soldiers - Math.ceil(firstMarch.soldiers * 0.25)
        expect(view.campaign.provinces.find((province) => province.id === source.id)?.levies).toBe(expectedGarrison)
        expect(view.campaign.provinces.find((province) => province.id === target.id)?.owner).toBe(null)
      }
    }

    const secondPorphyryDeparture = nextMessage(porphyry)
    const secondSeljukDeparture = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'second-lawful-order',
      revision: 4,
      command: { type: 'campaign.attack', sourceId: source.id, targetId: target.id, commitment: 75, formation: 'wedge' },
    })
    const secondDepartures = await Promise.all([secondPorphyryDeparture, secondSeljukDeparture])
    expect(secondDepartures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'snapshot',
        revision: 5,
        campaign: expect.objectContaining({
          marches: [expect.objectContaining({ actorId: 'porphyry', targetId: target.id })],
        }),
      }),
    ]))

    const porphyryArrival = nextMessage(porphyry)
    const seljukArrival = nextMessage(seljuk)
    const [firstView, secondView] = await Promise.all([porphyryArrival, seljukArrival])
    for (const view of [firstView, secondView]) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        events: [expect.objectContaining({ kind: 'march-resolved', provinceId: target.id, message: expect.stringContaining('строй +20%') })],
        campaign: { marches: [] },
      })
      if (view.type === 'snapshot') {
        expect(view.campaign.provinces.find((province) => province.id === target.id)?.owner).toBe('porphyry')
      }
    }

    if (firstView.type !== 'snapshot') throw new Error('Expected resolved campaign snapshot')
    const remoteSource = firstView.campaign.provinces.find((province) => province.id === 24)!
    const remoteTarget = firstView.campaign.provinces.find((province) => province.id === 27)!
    const routedDepartureForPorphyry = nextMessage(porphyry)
    const routedDepartureForSeljuk = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'routed-order',
      revision: 6,
      command: {
        type: 'campaign.attack',
        sourceId: remoteSource.id,
        targetId: remoteTarget.id,
        commitment: 50,
        formation: 'shieldwall',
      },
    })
    const routedDepartures = await Promise.all([routedDepartureForPorphyry, routedDepartureForSeljuk])
    for (const view of routedDepartures) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 7,
        campaign: {
          marches: [expect.objectContaining({
            actorId: 'porphyry',
            route: [24, 25, 26, 27],
          })],
        },
      })
      if (view.type === 'snapshot') {
        const march = view.campaign.marches[0]
        expect(march.arrivesAt - march.departedAt).toBe(900)
      }
    }

    const routedArrivalForPorphyry = nextMessage(porphyry)
    const routedArrivalForSeljuk = nextMessage(seljuk)
    const routedArrivals = await Promise.all([routedArrivalForPorphyry, routedArrivalForSeljuk])
    for (const view of routedArrivals) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 8,
        events: [expect.objectContaining({ kind: 'march-resolved', provinceId: remoteTarget.id })],
        campaign: { marches: [] },
      })
    }
  })

  it('rejects a second player claiming an occupied nation', async () => {
    const first = await openSocket(url)
    const second = await openSocket(url)
    const joined = nextMessage(first)
    send(first, { type: 'join', roomId: 'occupied', playerName: 'First', nationId: 'bulgar' })
    await joined

    const rejected = nextMessage(second)
    send(second, { type: 'join', roomId: 'occupied', playerName: 'Second', nationId: 'bulgar' })
    expect(await rejected).toEqual({
      type: 'rejected',
      commandId: null,
      reason: 'Эта нация уже занята другим игроком',
    })
  })

  it('starts once when both players ready simultaneously from the same revision', async () => {
    const first = await openSocket(url)
    const second = await openSocket(url)

    const firstJoined = nextMessage(first)
    send(first, { type: 'join', roomId: 'simultaneous-ready', playerName: 'First', nationId: 'porphyry' })
    await firstJoined

    const firstRoster = nextMessage(first)
    const secondJoined = nextMessage(second)
    send(second, { type: 'join', roomId: 'simultaneous-ready', playerName: 'Second', nationId: 'seljuk' })
    await Promise.all([firstRoster, secondJoined])

    const firstViews = nextMessages(first, 2)
    const secondViews = nextMessages(second, 2)
    send(first, {
      type: 'command',
      commandId: 'first-ready-at-zero',
      revision: 0,
      command: { type: 'lobby.ready', ready: true },
    })
    send(second, {
      type: 'command',
      commandId: 'second-ready-at-zero',
      revision: 0,
      command: { type: 'lobby.ready', ready: true },
    })

    const views = [...await firstViews, ...await secondViews]
    expect(views.every((view) => view.type === 'snapshot')).toBe(true)
    for (const view of [views[1], views[3]]) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 2,
        phase: 'running',
        events: expect.arrayContaining([expect.objectContaining({ kind: 'match-started' })]),
        players: [
          expect.objectContaining({ ready: true }),
          expect.objectContaining({ ready: true }),
        ],
      })
    }
  })

  it('charges diplomatic costs on the server instead of trusting client resources', async () => {
    const socket = await openSocket(url)
    const peer = await openSocket(url)
    const joined = nextMessage(socket)
    send(socket, { type: 'join', roomId: 'treasury', playerName: 'Treasurer', nationId: 'porphyry' })
    await joined
    const roster = nextMessage(socket)
    const peerJoined = nextMessage(peer)
    send(peer, { type: 'join', roomId: 'treasury', playerName: 'Witness', nationId: 'seljuk' })
    await Promise.all([roster, peerJoined])
    await startTwoPlayerMatch(socket, peer)

    for (let index = 0; index < 3; index += 1) {
      const revision = 2 + index
      const update = nextMessage(socket)
      send(socket, {
        type: 'command',
        commandId: `gift-${index}`,
        revision,
        command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'gift' },
      })
      const snapshot = await update
      expect(snapshot).toMatchObject({ type: 'snapshot', revision: revision + 1 })
      if (snapshot.type === 'snapshot') {
        expect(snapshot.self.silver).toBe(92 - (index + 1) * 30)
        expect(snapshot.players[0]).not.toHaveProperty('silver')
      }
    }

    const rejected = nextMessage(socket)
    send(socket, {
      type: 'command',
      commandId: 'gift-without-silver',
      revision: 5,
      command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'gift' },
    })
    expect(await rejected).toEqual({
      type: 'rejected',
      commandId: 'gift-without-silver',
      reason: 'Для даров нужно 30 номисм',
    })

    const unavailable = nextMessage(socket)
    send(socket, {
      type: 'command',
      commandId: 'offer-to-absent-ruler',
      revision: 5,
      command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'alliance-offer' },
    })
    expect(await unavailable).toEqual({
      type: 'rejected',
      commandId: 'offer-to-absent-ruler',
      reason: 'У державы нет правителя в этом матче',
    })
  })

  it('keeps a multiplayer alliance pending until the invited nation accepts', async () => {
    const porphyry = await openSocket(url)
    const bulgar = await openSocket(url)
    const porphyryJoined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'alliance-oath', playerName: 'Alexios', nationId: 'porphyry' })
    await porphyryJoined
    const porphyryRoster = nextMessage(porphyry)
    const bulgarJoined = nextMessage(bulgar)
    send(bulgar, { type: 'join', roomId: 'alliance-oath', playerName: 'Tervel', nationId: 'bulgar' })
    await Promise.all([porphyryRoster, bulgarJoined])
    await startTwoPlayerMatch(porphyry, bulgar)

    for (let index = 0; index < 2; index += 1) {
      const revision = 2 + index
      const views = [nextMessage(porphyry), nextMessage(bulgar)]
      send(porphyry, {
        type: 'command',
        commandId: `alliance-gift-${index}`,
        revision,
        command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'gift' },
      })
      await Promise.all(views)
    }

    const offeredViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(porphyry, {
      type: 'command',
      commandId: 'offer-alliance',
      revision: 4,
      command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'alliance-offer' },
    })
    for (const view of await Promise.all(offeredViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [expect.objectContaining({ kind: 'alliance-offered' })],
        campaign: {
          allianceOffers: [{
            fromRealmId: 'porphyry',
            toRealmId: 'bulgar',
            offeredAt: 0,
          }],
          relations: expect.arrayContaining([
            expect.objectContaining({ realmIds: ['porphyry', 'bulgar'], status: 'neutral' }),
          ]),
        },
      })
    }

    const acceptedViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(bulgar, {
      type: 'command',
      commandId: 'accept-alliance',
      revision: 5,
      command: { type: 'campaign.diplomacy', targetNationId: 'porphyry', action: 'alliance-accept' },
    })
    for (const view of await Promise.all(acceptedViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        events: [expect.objectContaining({ kind: 'alliance-accepted' })],
        campaign: {
          allianceOffers: [],
          relations: expect.arrayContaining([
            expect.objectContaining({ realmIds: ['porphyry', 'bulgar'], status: 'alliance' }),
          ]),
        },
      })
    }
  })

  it('keeps multiplayer peace pending until the opposing ruler accepts it', async () => {
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)
    const porphyryJoined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'peace-table', playerName: 'Alexios', nationId: 'porphyry' })
    await porphyryJoined
    const porphyryRoster = nextMessage(porphyry)
    const seljukJoined = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'peace-table', playerName: 'Kutlug', nationId: 'seljuk' })
    await Promise.all([porphyryRoster, seljukJoined])
    await startTwoPlayerMatch(porphyry, seljuk)

    const offeredViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'offer-white-peace',
      revision: 2,
      command: { type: 'campaign.diplomacy', targetNationId: 'seljuk', action: 'truce' },
    })
    for (const view of await Promise.all(offeredViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 3,
        events: [expect.objectContaining({ kind: 'peace-offered' })],
        campaign: {
          peaceOffers: [{
            fromRealmId: 'porphyry',
            toRealmId: 'seljuk',
            demandedProvinceId: null,
            offeredAt: 0,
          }],
          relations: expect.arrayContaining([
            expect.objectContaining({ realmIds: ['porphyry', 'seljuk'], status: 'war' }),
          ]),
        },
      })
    }

    const withdrawnViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'withdraw-white-peace',
      revision: 3,
      command: { type: 'campaign.diplomacy', targetNationId: 'seljuk', action: 'peace-withdraw' },
    })
    for (const view of await Promise.all(withdrawnViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        campaign: { peaceOffers: [] },
      })
    }

    const repeatedViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'offer-white-peace-again',
      revision: 4,
      command: { type: 'campaign.diplomacy', targetNationId: 'seljuk', action: 'truce' },
    })
    await Promise.all(repeatedViews)

    const acceptedViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(seljuk, {
      type: 'command',
      commandId: 'accept-white-peace',
      revision: 5,
      command: { type: 'campaign.diplomacy', targetNationId: 'porphyry', action: 'peace-accept' },
    })
    for (const view of await Promise.all(acceptedViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        events: [expect.objectContaining({ kind: 'peace-accepted' })],
        campaign: {
          peaceOffers: [],
          relations: expect.arrayContaining([
            expect.objectContaining({ realmIds: ['porphyry', 'seljuk'], status: 'truce' }),
          ]),
        },
      })
    }
  })

  it('transfers only the demanded border province after server-approved peace', async () => {
    await server.close()
    let demandedProvinceId = -1
    server = new MatchServer({
      campaignFactory: (seed) => {
        const campaign = createCampaign(seed)
        const candidate = campaign.provinces.find((province) => (
          province.owner === 'seljuk'
          && province.capitalOf !== 'seljuk'
          && campaign.provinces.some((neighbor) => (
            neighbor.owner !== 'seljuk' && provincesAreAdjacent(neighbor, province)
          ))
        ))!
        demandedProvinceId = candidate.id
        const bridge = campaign.provinces.find((province) => (
          province.owner !== 'seljuk' && provincesAreAdjacent(province, candidate)
        ))!
        bridge.owner = 'porphyry'
        for (const province of campaign.provinces) {
          if (
            province.homelandOf === 'seljuk'
            && province.id !== candidate.id
            && province.capitalOf !== 'seljuk'
          ) province.owner = 'porphyry'
        }
        return campaign
      },
    })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)
    const joined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'border-peace', playerName: 'Alexios', nationId: 'porphyry' })
    await joined
    const roster = nextMessage(porphyry)
    const peerJoined = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'border-peace', playerName: 'Kutlug', nationId: 'seljuk' })
    await Promise.all([roster, peerJoined])
    await startTwoPlayerMatch(porphyry, seljuk)

    const offeredViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'demand-border',
      revision: 2,
      command: {
        type: 'campaign.diplomacy',
        targetNationId: 'seljuk',
        action: 'peace-demand',
        provinceId: demandedProvinceId,
      },
    })
    await Promise.all(offeredViews)

    const acceptedViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(seljuk, {
      type: 'command',
      commandId: 'cede-border',
      revision: 3,
      command: { type: 'campaign.diplomacy', targetNationId: 'porphyry', action: 'peace-accept' },
    })
    for (const view of await Promise.all(acceptedViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        campaign: {
          peaceOffers: [],
          provinces: expect.arrayContaining([
            expect.objectContaining({ id: demandedProvinceId, owner: 'porphyry' }),
          ]),
        },
      })
    }
  })

  it('authoritatively transfers allied silver and marches reinforcements between selected provinces', async () => {
    await server.close()
    const campaignFactory = (seed: string) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
      campaignRelation(campaign, 'bulgar', 'porphyry')!.status = 'alliance'
      source.levies = 80
      target.owner = 'bulgar'
      target.levies = 20
      return campaign
    }
    server = new MatchServer({
      marchDurationMs: 100,
      marchPollMs: 5,
      campaignDayMs: 60_000,
      campaignFactory,
    })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const bulgar = await openSocket(url)

    const joined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'allied-relief', playerName: 'Alexios', nationId: 'porphyry' })
    await joined
    const porphyryRoster = nextMessage(porphyry)
    const bulgarJoined = nextMessage(bulgar)
    send(bulgar, { type: 'join', roomId: 'allied-relief', playerName: 'Tervel', nationId: 'bulgar' })
    await Promise.all([porphyryRoster, bulgarJoined])
    await startTwoPlayerMatch(porphyry, bulgar)

    const transferViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(porphyry, {
      type: 'command',
      commandId: 'alliance-silver',
      revision: 2,
      command: { type: 'campaign.transfer', targetNationId: 'bulgar', amount: 30 },
    })
    const [senderTransfer, recipientTransfer] = await Promise.all(transferViews)
    expect(senderTransfer).toMatchObject({
      type: 'snapshot',
      revision: 3,
      self: { silver: 62 },
      events: [{ kind: 'alliance-silver-sent' }],
    })
    expect(recipientTransfer).toMatchObject({
      type: 'snapshot',
      revision: 3,
      self: { silver: 122 },
      campaign: {
        economies: expect.arrayContaining([
          expect.objectContaining({ realmId: 'porphyry', silver: 62 }),
          expect.objectContaining({ realmId: 'bulgar', silver: 122 }),
        ]),
      },
    })

    const sourceId = 5 * 8 + 2
    const targetId = 5 * 8 + 3
    const porphyryViews = nextMessages(porphyry, 2)
    const bulgarViews = nextMessages(bulgar, 2)
    send(porphyry, {
      type: 'command',
      commandId: 'alliance-support',
      revision: 3,
      command: {
        type: 'campaign.support',
        sourceId,
        targetId,
        commitment: 50,
        formation: 'shieldwall',
      },
    })
    const [porphyryUpdates, bulgarUpdates] = await Promise.all([porphyryViews, bulgarViews])
    for (const updates of [porphyryUpdates, bulgarUpdates]) {
      expect(updates[0]).toMatchObject({
        type: 'snapshot',
        revision: 4,
        events: [{ kind: 'alliance-support-started', provinceId: targetId }],
        campaign: {
          marches: [expect.objectContaining({ kind: 'support', soldiers: 40, sourceId, targetId })],
        },
      })
      expect(updates[1]).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [expect.objectContaining({ kind: 'march-resolved', provinceId: targetId })],
        campaign: {
          marches: [],
          provinces: expect.arrayContaining([
            expect.objectContaining({ id: sourceId, levies: 40 }),
            expect.objectContaining({ id: targetId, owner: 'bulgar', levies: 60 }),
          ]),
        },
      })
    }
  })

  it('synchronizes a bilateral market route and preserves ownership of unilateral embargoes', async () => {
    await server.close()
    const campaignFactory = (seed: string) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
      source.marketLevel = 1
      target.owner = 'bulgar'
      target.marketLevel = 1
      return campaign
    }
    server = new MatchServer({ campaignDayMs: 60_000, campaignFactory })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const bulgar = await openSocket(url)

    const joined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'caravan-road', playerName: 'Alexios', nationId: 'porphyry' })
    await joined
    const porphyryRoster = nextMessage(porphyry)
    const bulgarJoined = nextMessage(bulgar)
    send(bulgar, { type: 'join', roomId: 'caravan-road', playerName: 'Tervel', nationId: 'bulgar' })
    await Promise.all([porphyryRoster, bulgarJoined])
    await startTwoPlayerMatch(porphyry, bulgar)

    const sourceId = 5 * 8 + 2
    const targetId = 5 * 8 + 3
    const routeViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(porphyry, {
      type: 'command',
      commandId: 'open-caravan-road',
      revision: 2,
      command: { type: 'campaign.trade-route', sourceId, targetId },
    })
    for (const view of await Promise.all(routeViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 3,
        events: [{ kind: 'trade-route-opened', provinceId: targetId }],
        campaign: {
          tradeRoutes: [{
            realmIds: ['porphyry', 'bulgar'],
            provinceIds: [sourceId, targetId],
            openedAt: 0,
          }],
        },
      })
    }

    const embargoViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(bulgar, {
      type: 'command',
      commandId: 'bulgar-embargo',
      revision: 3,
      command: { type: 'campaign.trade-policy', targetNationId: 'porphyry', embargoed: true },
    })
    for (const view of await Promise.all(embargoViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        events: [{ kind: 'trade-embargoed' }],
        campaign: {
          tradeRoutes: [],
          relations: expect.arrayContaining([
            expect.objectContaining({
              realmIds: ['porphyry', 'bulgar'],
              tradeEmbargoes: ['bulgar'],
            }),
          ]),
        },
      })
    }

    const unauthorizedResume = nextMessage(porphyry)
    send(porphyry, {
      type: 'command',
      commandId: 'wrong-ruler-resume',
      revision: 4,
      command: { type: 'campaign.trade-policy', targetNationId: 'bulgar', embargoed: false },
    })
    expect(await unauthorizedResume).toEqual({
      type: 'rejected',
      commandId: 'wrong-ruler-resume',
      reason: 'Вашего эмбарго нет',
    })

    const resumeViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(bulgar, {
      type: 'command',
      commandId: 'bulgar-resume',
      revision: 4,
      command: { type: 'campaign.trade-policy', targetNationId: 'porphyry', embargoed: false },
    })
    for (const view of await Promise.all(resumeViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [{ kind: 'trade-resumed' }],
        campaign: {
          tradeRoutes: [],
          relations: expect.arrayContaining([
            expect.objectContaining({
              realmIds: ['porphyry', 'bulgar'],
              tradeEmbargoes: [],
            }),
          ]),
        },
      })
    }

    const reopenedViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(porphyry, {
      type: 'command',
      commandId: 'reopen-caravan-road',
      revision: 5,
      command: { type: 'campaign.trade-route', sourceId, targetId },
    })
    for (const view of await Promise.all(reopenedViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        campaign: { tradeRoutes: [expect.objectContaining({ provinceIds: [sourceId, targetId] })] },
      })
    }

    const disconnected = nextMessage(porphyry)
    bulgar.close()
    expect(await disconnected).toMatchObject({
      type: 'snapshot',
      revision: 7,
      events: [{ kind: 'trade-route-closed' }],
      campaign: { tradeRoutes: [] },
      players: [expect.objectContaining({ nationId: 'porphyry' })],
    })
  })

  it('starts one authoritative siege and synchronizes tactics, sortie, and retreat', async () => {
    await server.close()
    const campaignFactory = (seed: string) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
      source.levies = 120
      target.owner = 'seljuk'
      target.levies = 40
      target.fortificationLevel = 1
      target.defenseFormation = 'line'
      return campaign
    }
    server = new MatchServer({
      campaignFactory,
      campaignDayMs: 60_000,
      marchDurationMs: 60,
      marchPollMs: 5,
    })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)
    const joined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'shared-siege', playerName: 'Alexios', nationId: 'porphyry' })
    await joined
    const porphyryRoster = nextMessage(porphyry)
    const seljukJoined = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'shared-siege', playerName: 'Kutlug', nationId: 'seljuk' })
    await Promise.all([porphyryRoster, seljukJoined])
    await startTwoPlayerMatch(porphyry, seljuk)

    const sourceId = 4 * 8 + 2
    const targetId = 4 * 8 + 3
    const departureViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'march-to-walls',
      revision: 2,
      command: {
        type: 'campaign.attack',
        sourceId,
        targetId,
        commitment: 75,
        formation: 'wedge',
      },
    })
    await Promise.all(departureViews)

    const siegeViews = await Promise.all([nextMessage(porphyry), nextMessage(seljuk)])
    for (const view of siegeViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        events: [{ kind: 'siege-started', provinceId: targetId }],
        campaign: {
          marches: [],
          sieges: [{
            attackerId: 'porphyry',
            defenderId: 'seljuk',
            sourceId,
            targetId,
            soldiers: 90,
            formation: 'wedge',
            tactic: 'blockade',
            progress: 0,
          }],
          provinces: expect.arrayContaining([
            expect.objectContaining({ id: targetId, owner: 'seljuk', fortificationLevel: 1 }),
          ]),
        },
      })
    }
    if (siegeViews[0].type !== 'snapshot') return
    const siegeId = siegeViews[0].campaign.sieges[0]!.id

    const tacticViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'dig-under-walls',
      revision: 4,
      command: { type: 'campaign.siege-tactic', siegeId, tactic: 'sappers' },
    })
    for (const view of await Promise.all(tacticViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [{ kind: 'siege-tactic', provinceId: targetId }],
        campaign: { sieges: [expect.objectContaining({ id: siegeId, tactic: 'sappers' })] },
      })
    }

    const forbiddenTactic = nextMessage(seljuk)
    send(seljuk, {
      type: 'command',
      commandId: 'defender-cannot-command-camp',
      revision: 5,
      command: { type: 'campaign.siege-tactic', siegeId, tactic: 'assault' },
    })
    expect(await forbiddenTactic).toEqual({
      type: 'rejected',
      commandId: 'defender-cannot-command-camp',
      reason: 'Только осаждающий правитель выбирает способ осады',
    })

    const sortieViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(seljuk, {
      type: 'command',
      commandId: 'sortie-from-walls',
      revision: 5,
      command: { type: 'campaign.siege-sortie', siegeId },
    })
    for (const view of await Promise.all(sortieViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        events: [{ kind: 'siege-sortie', provinceId: targetId }],
        campaign: {
          sieges: [expect.objectContaining({ id: siegeId, progress: 10 })],
          provinces: expect.arrayContaining([expect.objectContaining({ id: targetId, levies: 20 })]),
        },
      })
    }

    const retreatViews = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'lift-the-siege',
      revision: 6,
      command: { type: 'campaign.siege-retreat', siegeId },
    })
    for (const view of await Promise.all(retreatViews)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 7,
        events: [{ kind: 'siege-retreated', provinceId: targetId }],
        campaign: { sieges: [] },
      })
    }
    porphyry.close()
    seljuk.close()
  })

  it('authoritatively combines siege reinforcements and resolves a defender relief march for both clients', async () => {
    await server.close()
    const campaignFactory = (seed: string) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
      const attackerReserve = campaign.provinces.find((province) => province.column === 3 && province.row === 3)!
      const defenderReserve = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
      source.owner = 'porphyry'
      source.levies = 120
      attackerReserve.owner = 'porphyry'
      attackerReserve.levies = 80
      defenderReserve.owner = 'seljuk'
      defenderReserve.levies = 200
      target.owner = 'seljuk'
      target.levies = 40
      target.fortificationLevel = 1
      return campaign
    }
    server = new MatchServer({
      campaignFactory,
      campaignDayMs: 60_000,
      marchDurationMs: 80,
      marchPollMs: 5,
    })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)
    const joined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'siege-maneuvers', playerName: 'Alexios', nationId: 'porphyry' })
    await joined
    const porphyryRoster = nextMessage(porphyry)
    const seljukJoined = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'siege-maneuvers', playerName: 'Kutlug', nationId: 'seljuk' })
    await Promise.all([porphyryRoster, seljukJoined])
    await startTwoPlayerMatch(porphyry, seljuk)

    const sourceId = 4 * 8 + 2
    const targetId = 4 * 8 + 3
    const attackerReserveId = 3 * 8 + 3
    const defenderReserveId = 4 * 8 + 4
    const departure = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'start-siege-for-maneuvers',
      revision: 2,
      command: {
        type: 'campaign.attack',
        sourceId,
        targetId,
        commitment: 75,
        formation: 'line',
      },
    })
    await Promise.all(departure)
    const startedViews = await Promise.all([nextMessage(porphyry), nextMessage(seljuk)])
    if (startedViews[0].type !== 'snapshot') return
    const siegeId = startedViews[0].campaign.sieges[0]!.id

    const reinforcementDepartures = [nextMessage(porphyry), nextMessage(seljuk)]
    send(porphyry, {
      type: 'command',
      commandId: 'reinforce-siege-camp',
      revision: 4,
      command: {
        type: 'campaign.siege-march',
        siegeId,
        sourceId: attackerReserveId,
        commitment: 50,
        formation: 'shieldwall',
      },
    })
    for (const view of await Promise.all(reinforcementDepartures)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [{ kind: 'march-started', provinceId: targetId }],
        campaign: {
          marches: [expect.objectContaining({
            actorId: 'porphyry',
            siegeId,
            sourceId: attackerReserveId,
            soldiers: 40,
          })],
        },
      })
    }
    for (const view of await Promise.all([nextMessage(porphyry), nextMessage(seljuk)])) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 6,
        events: [{
          kind: 'march-resolved',
          provinceId: targetId,
          message: expect.stringContaining('усиливает лагерь'),
        }],
        campaign: {
          marches: [],
          sieges: [expect.objectContaining({ id: siegeId, soldiers: 130 })],
        },
      })
    }

    const reliefDepartures = [nextMessage(porphyry), nextMessage(seljuk)]
    send(seljuk, {
      type: 'command',
      commandId: 'relieve-besieged-city',
      revision: 6,
      command: {
        type: 'campaign.siege-march',
        siegeId,
        sourceId: defenderReserveId,
        commitment: 75,
        formation: 'wedge',
      },
    })
    for (const view of await Promise.all(reliefDepartures)) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 7,
        campaign: {
          marches: [expect.objectContaining({
            kind: 'support',
            actorId: 'seljuk',
            siegeId,
            sourceId: defenderReserveId,
            soldiers: 150,
          })],
        },
      })
    }
    for (const view of await Promise.all([nextMessage(porphyry), nextMessage(seljuk)])) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 8,
        events: [{
          kind: 'march-resolved',
          provinceId: targetId,
          message: expect.stringContaining('разбивает лагерь'),
        }],
        campaign: {
          marches: [],
          sieges: [],
          provinces: expect.arrayContaining([
            expect.objectContaining({ id: targetId, owner: 'seljuk', levies: 112 }),
          ]),
        },
      })
    }
    porphyry.close()
    seljuk.close()
  })

  it('cancels pending alliance offers when either participant disconnects', async () => {
    await server.close()
    server = new MatchServer({
      campaignFactory: (seed) => {
        const campaign = createCampaign(seed)
        campaignRelation(campaign, 'bulgar', 'porphyry')!.opinion = 60
        return campaign
      },
    })
    const port = await server.listen(0)
    url = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(url)
    const bulgar = await openSocket(url)
    const porphyryJoined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'broken-oath', playerName: 'Alexios', nationId: 'porphyry' })
    await porphyryJoined
    const porphyryRoster = nextMessage(porphyry)
    const bulgarJoined = nextMessage(bulgar)
    send(bulgar, { type: 'join', roomId: 'broken-oath', playerName: 'Tervel', nationId: 'bulgar' })
    await Promise.all([porphyryRoster, bulgarJoined])
    await startTwoPlayerMatch(porphyry, bulgar)

    const offeredViews = [nextMessage(porphyry), nextMessage(bulgar)]
    send(porphyry, {
      type: 'command',
      commandId: 'offer-before-disconnect',
      revision: 2,
      command: { type: 'campaign.diplomacy', targetNationId: 'bulgar', action: 'alliance-offer' },
    })
    await Promise.all(offeredViews)

    const cancellation = nextMessage(porphyry)
    bulgar.close()
    expect(await cancellation).toMatchObject({
      type: 'snapshot',
      revision: 4,
      events: [expect.objectContaining({
        kind: 'alliance-declined',
        message: 'Предложение союза отменено: Tervel покинул матч',
      })],
      campaign: {
        allianceOffers: [],
        relations: expect.arrayContaining([
          expect.objectContaining({ realmIds: ['porphyry', 'bulgar'], status: 'neutral' }),
        ]),
      },
      players: [expect.objectContaining({ nationId: 'porphyry' })],
    })
  })

  it('broadcasts authoritative mustering and provincial construction to every nation', async () => {
    const porphyry = await openSocket(url)
    const seljuk = await openSocket(url)
    const porphyryJoined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'governance', playerName: 'Alexios', nationId: 'porphyry' })
    await porphyryJoined
    const porphyryRoster = nextMessage(porphyry)
    const seljukRoster = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'governance', playerName: 'Kutlug', nationId: 'seljuk' })
    const [joined] = await Promise.all([porphyryRoster, seljukRoster])
    if (joined.type !== 'snapshot') throw new Error('Expected campaign snapshot')
    await startTwoPlayerMatch(porphyry, seljuk)
    const province = joined.campaign.provinces.find((item) => item.owner === 'porphyry' && item.cityLevel === 0)!
    const leviesBefore = province.levies

    const porphyryMuster = nextMessage(porphyry)
    const seljukMuster = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'muster',
      revision: 2,
      command: { type: 'campaign.muster', provinceId: province.id },
    })
    const musterViews = await Promise.all([porphyryMuster, seljukMuster])
    for (const view of musterViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 3,
        events: [{ kind: 'province-mustered', provinceId: province.id }],
      })
      if (view.type === 'snapshot') {
        expect(view.campaign.provinces.find((item) => item.id === province.id)?.levies).toBe(leviesBefore + 12)
      }
    }
    expect(musterViews[0]).toMatchObject({ type: 'snapshot', self: { silver: 68 } })
    expect(musterViews[1]).toMatchObject({ type: 'snapshot', self: { silver: 92 } })

    const porphyryProject = nextMessage(porphyry)
    const seljukProject = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'develop-settlement',
      revision: 3,
      command: { type: 'campaign.develop', provinceId: province.id, project: 'settlement' },
    })
    const projectViews = await Promise.all([porphyryProject, seljukProject])
    for (const view of projectViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        events: [{ kind: 'province-project-started', provinceId: province.id }],
        self: expect.objectContaining({ silver: expect.any(Number) }),
      })
      if (view.type === 'snapshot') {
        expect(view.campaign.provinces.find((item) => item.id === province.id)).toMatchObject({
          cityLevel: 0,
          project: { kind: 'settlement', completesAt: 2 },
        })
      }
    }
    expect(projectViews[0]).toMatchObject({ type: 'snapshot', self: { silver: 14 } })

    const porphyryDefense = nextMessage(porphyry)
    const seljukDefense = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'defense',
      revision: 4,
      command: { type: 'campaign.defense', provinceId: province.id, formation: 'wedge' },
    })
    const defenseViews = await Promise.all([porphyryDefense, seljukDefense])
    for (const view of defenseViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 5,
        events: [{ kind: 'province-formation', provinceId: province.id }],
      })
      if (view.type === 'snapshot') {
        expect(view.campaign.provinces.find((item) => item.id === province.id)?.defenseFormation).toBe('wedge')
      }
    }

    const forgedDefense = nextMessage(seljuk)
    send(seljuk, {
      type: 'command',
      commandId: 'forged-defense',
      revision: 5,
      command: { type: 'campaign.defense', provinceId: province.id, formation: 'shieldwall' },
    })
    expect(await forgedDefense).toEqual({
      type: 'rejected',
      commandId: 'forged-defense',
      reason: 'Для оборонного строя выберите свою провинцию',
    })

    const forgedProject = nextMessage(seljuk)
    send(seljuk, {
      type: 'command',
      commandId: 'forged-project',
      revision: 5,
      command: { type: 'campaign.develop', provinceId: province.id, project: 'market' },
    })
    expect(await forgedProject).toEqual({
      type: 'rejected',
      commandId: 'forged-project',
      reason: 'Для развития выберите свою провинцию',
    })
  })

  it('advances national income on the server clock without client speed control', async () => {
    const clockServer = new MatchServer({ campaignDayMs: 40, marchPollMs: 5 })
    const clockPort = await clockServer.listen(0)
    const socket = await openSocket(`ws://127.0.0.1:${clockPort}`)
    const peer = await openSocket(`ws://127.0.0.1:${clockPort}`)
    try {
      const joinedMessage = nextMessage(socket)
      send(socket, { type: 'join', roomId: 'clock', playerName: 'Alexios', nationId: 'porphyry' })
      const joined = await joinedMessage
      if (joined.type !== 'snapshot') throw new Error('Expected campaign snapshot')
      const income = realmDailyIncome(joined.campaign, 'porphyry')
      const roster = nextMessage(socket)
      const peerJoined = nextMessage(peer)
      send(peer, { type: 'join', roomId: 'clock', playerName: 'Kutlug', nationId: 'seljuk' })
      await Promise.all([roster, peerJoined])
      await startTwoPlayerMatch(socket, peer)

      const nextDay = await nextMessage(socket)

      expect(nextDay).toMatchObject({
        type: 'snapshot',
        revision: 3,
        self: { silver: 92 + income },
        campaign: { tick: 1 },
        events: [{ kind: 'day-advanced' }],
      })
    } finally {
      socket.close()
      peer.close()
      await clockServer.close()
    }
  })

  it('orders an unclaimed nation through the authoritative march pipeline', async () => {
    const clockServer = new MatchServer({
      campaignDayMs: 30,
      marchDurationMs: 10,
      marchPollMs: 2,
    })
    const clockPort = await clockServer.listen(0)
    const porphyry = await openSocket(`ws://127.0.0.1:${clockPort}`)
    const seljuk = await openSocket(`ws://127.0.0.1:${clockPort}`)
    try {
      const porphyryJoined = nextMessage(porphyry)
      send(porphyry, { type: 'join', roomId: 'ai-clock', playerName: 'Alexios', nationId: 'porphyry' })
      await porphyryJoined
      const porphyryRoster = nextMessage(porphyry)
      const seljukJoined = nextMessage(seljuk)
      send(seljuk, { type: 'join', roomId: 'ai-clock', playerName: 'Kutlug', nationId: 'seljuk' })
      await Promise.all([porphyryRoster, seljukJoined])
      await startTwoPlayerMatch(porphyry, seljuk)

      const [porphyryDays, seljukDays] = await Promise.all([
        nextMessages(porphyry, 4),
        nextMessages(seljuk, 4),
      ])
      for (const dayFour of [porphyryDays[3], seljukDays[3]]) {
        expect(dayFour).toMatchObject({
          type: 'snapshot',
          revision: 6,
          campaign: {
            tick: 4,
            marches: [expect.objectContaining({ actorId: 'bulgar' })],
          },
          events: expect.arrayContaining([
            expect.objectContaining({ kind: 'day-advanced' }),
            expect.objectContaining({ kind: 'march-started' }),
          ]),
        })
        if (dayFour.type === 'snapshot') {
          const march = dayFour.campaign.marches[0]
          expect(march.arrivesAt - march.departedAt).toBe(10 * (march.route.length - 1))
        }
      }

      const [porphyryArrival, seljukArrival] = await Promise.all([
        nextMessage(porphyry),
        nextMessage(seljuk),
      ])
      for (const arrival of [porphyryArrival, seljukArrival]) {
        expect(arrival).toMatchObject({
          type: 'snapshot',
          revision: 7,
          campaign: { marches: [] },
          events: [expect.objectContaining({ kind: 'march-resolved' })],
        })
      }
    } finally {
      porphyry.close()
      seljuk.close()
      await clockServer.close()
    }
  })

  it('resolves AI arrivals chronologically inside one delayed server poll', async () => {
    const catchUpServer = new MatchServer({
      campaignDayMs: 50,
      marchDurationMs: 10,
      marchPollMs: 300,
    })
    const catchUpPort = await catchUpServer.listen(0)
    const porphyry = await openSocket(`ws://127.0.0.1:${catchUpPort}`)
    const seljuk = await openSocket(`ws://127.0.0.1:${catchUpPort}`)
    try {
      const porphyryJoined = nextMessage(porphyry)
      send(porphyry, { type: 'join', roomId: 'ai-catch-up', playerName: 'Alexios', nationId: 'porphyry' })
      await porphyryJoined
      const porphyryRoster = nextMessage(porphyry)
      const seljukJoined = nextMessage(seljuk)
      send(seljuk, { type: 'join', roomId: 'ai-catch-up', playerName: 'Kutlug', nationId: 'seljuk' })
      await Promise.all([porphyryRoster, seljukJoined])
      await startTwoPlayerMatch(porphyry, seljuk)

      const catchUp = await nextMessage(porphyry)
      expect(catchUp).toMatchObject({
        type: 'snapshot',
        revision: 3,
        campaign: {
          marches: [],
        },
      })
      if (catchUp.type !== 'snapshot') throw new Error('Expected campaign snapshot')
      expect(catchUp.campaign.tick).toBeGreaterThanOrEqual(5)
      const eventKinds = catchUp.events.map((event) => event.kind)
      const startedAt = eventKinds.indexOf('march-started')
      const resolvedAt = eventKinds.indexOf('march-resolved')
      expect(startedAt).toBeGreaterThanOrEqual(0)
      expect(resolvedAt).toBeGreaterThan(startedAt)
    } finally {
      porphyry.close()
      seljuk.close()
      await catchUpServer.close()
    }
  })

  it('finishes a provincial project on the shared server day for every client', async () => {
    const clockServer = new MatchServer({ campaignDayMs: 80, marchPollMs: 5 })
    const clockPort = await clockServer.listen(0)
    const porphyry = await openSocket(`ws://127.0.0.1:${clockPort}`)
    const seljuk = await openSocket(`ws://127.0.0.1:${clockPort}`)
    try {
      const joinedMessage = nextMessage(porphyry)
      send(porphyry, { type: 'join', roomId: 'project-clock', playerName: 'Alexios', nationId: 'porphyry' })
      const joined = await joinedMessage
      if (joined.type !== 'snapshot') throw new Error('Expected campaign snapshot')
      const province = joined.campaign.provinces.find((item) => (
        item.owner === 'porphyry' && item.cityLevel === 0 && item.marketLevel === 0
      ))!
      const porphyryRoster = nextMessage(porphyry)
      const seljukJoined = nextMessage(seljuk)
      send(seljuk, { type: 'join', roomId: 'project-clock', playerName: 'Kutlug', nationId: 'seljuk' })
      await Promise.all([porphyryRoster, seljukJoined])
      await startTwoPlayerMatch(porphyry, seljuk)

      const porphyryStarted = nextMessage(porphyry)
      const seljukStarted = nextMessage(seljuk)
      send(porphyry, {
        type: 'command',
        commandId: 'market-project',
        revision: 2,
        command: { type: 'campaign.develop', provinceId: province.id, project: 'market' },
      })
      await Promise.all([porphyryStarted, seljukStarted])

      const porphyryDays = nextMessages(porphyry, 2)
      const seljukDays = nextMessages(seljuk, 2)
      const views = [...await porphyryDays, ...await seljukDays]

      for (const view of [views[1], views[3]]) {
        expect(view).toMatchObject({
          type: 'snapshot',
          revision: 5,
          campaign: { tick: 2 },
          events: expect.arrayContaining([
            expect.objectContaining({ kind: 'province-project-completed', provinceId: province.id }),
            expect.objectContaining({ kind: 'day-advanced' }),
          ]),
        })
        if (view.type === 'snapshot') {
          expect(view.campaign.provinces.find((item) => item.id === province.id)).toMatchObject({
            marketLevel: 1,
            project: null,
          })
        }
      }
    } finally {
      porphyry.close()
      seljuk.close()
      await clockServer.close()
    }
  })

  it('applies a completed fortification before a later march when one poll observes both', async () => {
    const campaign = createCampaign('chronological-project')
    const target = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const source = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    target.levies = 24
    target.cityLevel = 0
    target.fortificationLevel = 0
    target.defenseFormation = 'line'
    source.owner = 'seljuk'
    source.levies = 60
    const chronologyServer = new MatchServer({
      campaignFactory: () => campaign,
      campaignDayMs: 100,
      marchDurationMs: 250,
      marchPollMs: 400,
    })
    const chronologyPort = await chronologyServer.listen(0)
    const porphyry = await openSocket(`ws://127.0.0.1:${chronologyPort}`)
    const seljuk = await openSocket(`ws://127.0.0.1:${chronologyPort}`)
    try {
      const porphyryJoined = nextMessage(porphyry)
      send(porphyry, { type: 'join', roomId: 'chronology', playerName: 'Alexios', nationId: 'porphyry' })
      await porphyryJoined
      const porphyryRoster = nextMessage(porphyry)
      const seljukJoined = nextMessage(seljuk)
      send(seljuk, { type: 'join', roomId: 'chronology', playerName: 'Kutlug', nationId: 'seljuk' })
      await Promise.all([porphyryRoster, seljukJoined])
      await startTwoPlayerMatch(porphyry, seljuk)

      const porphyryProject = nextMessage(porphyry)
      const seljukProject = nextMessage(seljuk)
      send(porphyry, {
        type: 'command',
        commandId: 'walls-before-march',
        revision: 2,
        command: { type: 'campaign.develop', provinceId: target.id, project: 'fortification' },
      })
      await Promise.all([porphyryProject, seljukProject])

      const porphyryDeparture = nextMessage(porphyry)
      const seljukDeparture = nextMessage(seljuk)
      send(seljuk, {
        type: 'command',
        commandId: 'march-after-walls',
        revision: 3,
        command: {
          type: 'campaign.attack',
          sourceId: source.id,
          targetId: target.id,
          commitment: 50,
          formation: 'line',
        },
      })
      await Promise.all([porphyryDeparture, seljukDeparture])

      const resolved = await nextMessage(porphyry)

      expect(resolved).toMatchObject({
        type: 'snapshot',
        revision: 5,
        campaign: {
          provinces: expect.arrayContaining([
            expect.objectContaining({
              id: target.id,
              owner: 'porphyry',
              fortificationLevel: 1,
              project: null,
            }),
          ]),
          sieges: [expect.objectContaining({
            targetId: target.id,
            attackerId: 'seljuk',
            defenderId: 'porphyry',
            tactic: 'blockade',
          })],
        },
      })
      if (resolved.type === 'snapshot') {
        const projectIndex = resolved.events.findIndex((event) => event.kind === 'province-project-completed')
        const marchIndex = resolved.events.findIndex((event) => event.kind === 'siege-started')
        expect(projectIndex).toBeGreaterThanOrEqual(0)
        expect(marchIndex).toBeGreaterThan(projectIndex)
        expect(resolved.events[marchIndex].message).toContain('начата блокада')
      }
    } finally {
      porphyry.close()
      seljuk.close()
      await chronologyServer.close()
    }
  })

  it('broadcasts realm defeat and the authoritative winner, then locks the finished match', async () => {
    await server.close()
    server = new MatchServer({
      marchDurationMs: 60,
      marchPollMs: 5,
      campaignDayMs: 250,
      campaignFactory: createFinalCampaign,
    })
    const port = await server.listen(0)
    const finalUrl = `ws://127.0.0.1:${port}`
    const porphyry = await openSocket(finalUrl)
    const seljuk = await openSocket(finalUrl)

    const porphyryJoined = nextMessage(porphyry)
    send(porphyry, { type: 'join', roomId: 'last-banner', playerName: 'Alexios', nationId: 'porphyry' })
    await porphyryJoined
    const porphyryRoster = nextMessage(porphyry)
    const seljukJoined = nextMessage(seljuk)
    send(seljuk, { type: 'join', roomId: 'last-banner', playerName: 'Kutlug', nationId: 'seljuk' })
    const [ready] = await Promise.all([porphyryRoster, seljukJoined])
    if (ready.type !== 'snapshot') throw new Error('Expected campaign snapshot')
    await startTwoPlayerMatch(porphyry, seljuk)
    const source = ready.campaign.provinces.find((province) => province.capitalOf === 'porphyry')!
    const target = ready.campaign.provinces.find((province) => province.capitalOf === 'seljuk')!

    const porphyryDeparture = nextMessage(porphyry)
    const seljukDeparture = nextMessage(seljuk)
    send(porphyry, {
      type: 'command',
      commandId: 'final-march',
      revision: 2,
      command: {
        type: 'campaign.attack',
        sourceId: source.id,
        targetId: target.id,
        commitment: 75,
        formation: 'wedge',
      },
    })
    await Promise.all([porphyryDeparture, seljukDeparture])

    const porphyryFinished = nextMessage(porphyry)
    const seljukFinished = nextMessage(seljuk)
    const finalViews = await Promise.all([porphyryFinished, seljukFinished])
    for (const view of finalViews) {
      expect(view).toMatchObject({
        type: 'snapshot',
        revision: 4,
        phase: 'finished',
        campaign: {
          winnerRealmId: 'porphyry',
          marches: [],
          realms: expect.arrayContaining([
            expect.objectContaining({
              id: 'seljuk',
              status: 'defeated',
              defeatedBy: 'porphyry',
            }),
          ]),
        },
        events: expect.arrayContaining([
          expect.objectContaining({ kind: 'realm-defeated', provinceId: target.id }),
          expect.objectContaining({ kind: 'match-finished', provinceId: target.id }),
        ]),
      })
    }
    expect(finalViews[0]).toMatchObject({ type: 'snapshot', self: { silver: 132, legitimacy: 74 } })

    const locked = nextMessage(seljuk)
    send(seljuk, {
      type: 'command',
      commandId: 'after-defeat',
      revision: 4,
      command: { type: 'campaign.muster', provinceId: target.id },
    })
    expect(await locked).toEqual({
      type: 'rejected',
      commandId: 'after-defeat',
      reason: 'Матч уже завершён',
    })
    await expectNoMessage(porphyry, 320)
  })
})

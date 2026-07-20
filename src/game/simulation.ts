export type BuildingKind =
  | 'road'
  | 'house'
  | 'farm'
  | 'lumberCamp'
  | 'quarry'
  | 'granary'
  | 'market'
  | 'smithy'
  | 'barracks'
  | 'watchtower'
  | 'wall'
  | 'townHall'

export interface Point { x: number; y: number }

export interface ValleyMap {
  seed: string
  river: Point[]
  forests: Point[]
  fertileFields: Point[]
  stoneDeposits: Point[]
}

export interface Building extends Point {
  id: number
  kind: BuildingKind
  progress: number
  health: number
}

export type ThreatStatus = 'forming' | 'approaching' | 'raiding' | 'withdrawing' | 'disbanded'
export type IntelConfidence = 'rumor' | 'approximate' | 'confirmed'

export interface Threat {
  id: number
  kind: 'scouts' | 'raiders' | 'invasion'
  strength: number
  supplies: number
  status: ThreatStatus
  intel: IntelConfidence
  formedDay: number
}

export interface Crisis {
  id: number
  kind: 'famine' | 'rebellion' | 'coup'
  pressure: number
}

export interface GameEvent {
  id: number
  day: number
  title: string
  text: string
  tone: 'neutral' | 'good' | 'warning' | 'danger'
}

export interface GameState {
  tick: number
  day: number
  year: number
  season: 'Весна' | 'Лето' | 'Осень' | 'Зима'
  people: number
  capacity: number
  order: number
  legitimacy: number
  resources: { food: number; wood: number; stone: number; silver: number }
  map: ValleyMap
  buildings: Building[]
  threats: Threat[]
  crises: Crisis[]
  events: GameEvent[]
  nextId: number
}

const BUILD_COSTS: Record<BuildingKind, { wood: number; stone: number; silver: number }> = {
  road: { wood: 1, stone: 1, silver: 0 },
  house: { wood: 8, stone: 0, silver: 0 },
  farm: { wood: 12, stone: 2, silver: 0 },
  lumberCamp: { wood: 15, stone: 0, silver: 0 },
  quarry: { wood: 12, stone: 0, silver: 4 },
  granary: { wood: 18, stone: 6, silver: 0 },
  market: { wood: 20, stone: 8, silver: 10 },
  smithy: { wood: 16, stone: 14, silver: 8 },
  barracks: { wood: 24, stone: 14, silver: 10 },
  watchtower: { wood: 20, stone: 18, silver: 4 },
  wall: { wood: 4, stone: 10, silver: 0 },
  townHall: { wood: 36, stone: 30, silver: 20 },
}

function hashSeed(seed: string): () => number {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function uniquePoints(random: () => number, count: number, inset = 4): Point[] {
  const points = new Map<string, Point>()
  while (points.size < count) {
    const point = {
      x: inset + Math.floor(random() * (64 - inset * 2)),
      y: inset + Math.floor(random() * (64 - inset * 2)),
    }
    points.set(`${point.x}:${point.y}`, point)
  }
  return [...points.values()]
}

function createMap(seed: string): ValleyMap {
  const random = hashSeed(seed)
  const river = Array.from({ length: 64 }, (_, y) => ({
    x: 28 + Math.round(Math.sin(y / 7) * 5 + random() * 2),
    y,
  }))
  return {
    seed,
    river,
    forests: uniquePoints(random, 48),
    fertileFields: uniquePoints(random, 24, 8),
    stoneDeposits: uniquePoints(random, 10, 7),
  }
}

export function createGame(seed: string): GameState {
  return {
    tick: 0,
    day: 1,
    year: 4,
    season: 'Осень',
    people: 98,
    capacity: 120,
    order: 72,
    legitimacy: 66,
    resources: { food: 2845, wood: 120, stone: 96, silver: 92 },
    map: createMap(seed),
    buildings: [
      { id: 1, kind: 'townHall', x: 32, y: 31, progress: 1, health: 100 },
      { id: 2, kind: 'granary', x: 37, y: 30, progress: 1, health: 100 },
      { id: 3, kind: 'house', x: 29, y: 35, progress: 1, health: 100 },
      { id: 4, kind: 'house', x: 36, y: 36, progress: 1, health: 100 },
      { id: 5, kind: 'farm', x: 42, y: 36, progress: 1, health: 100 },
      { id: 6, kind: 'lumberCamp', x: 24, y: 29, progress: 1, health: 100 },
      { id: 7, kind: 'market', x: 33, y: 40, progress: 1, health: 100 },
      { id: 8, kind: 'watchtower', x: 43, y: 24, progress: 1, health: 100 },
    ],
    threats: [],
    crises: [],
    events: [
      { id: 9, day: 1, title: 'Новая летопись', text: 'Вересков Дол встречает осень.', tone: 'neutral' },
    ],
    nextId: 10,
  }
}

export function placeBuilding(state: GameState, kind: BuildingKind, point: Point): { ok: true } | { ok: false; reason: string } {
  if (state.buildings.some((building) => building.x === point.x && building.y === point.y)) {
    return { ok: false, reason: 'Здесь уже стоит постройка' }
  }
  const cost = BUILD_COSTS[kind]
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone || state.resources.silver < cost.silver) {
    return { ok: false, reason: 'Не хватает припасов' }
  }
  state.resources.wood -= cost.wood
  state.resources.stone -= cost.stone
  state.resources.silver -= cost.silver
  state.buildings.push({ id: state.nextId++, kind, ...point, progress: kind === 'road' ? 1 : 0.15, health: 100 })
  state.events.push({ id: state.nextId++, day: state.day, title: 'Начато строительство', text: `Заложена новая постройка: ${kind}.`, tone: 'good' })
  return { ok: true }
}

export function placePath(
  state: GameState,
  kind: 'road' | 'wall',
  points: Point[],
): { ok: true; placed: number } | { ok: false; reason: string } {
  const unique = [...new Map(points.map((point) => [`${point.x}:${point.y}`, point])).values()]
  if (!unique.length) return { ok: false, reason: 'Путь не задан' }
  if (unique.some((point) => point.x < 0 || point.x > 63 || point.y < 0 || point.y > 63)) {
    return { ok: false, reason: 'Путь выходит за границы карты' }
  }
  if (unique.some((point) => state.buildings.some((building) => building.x === point.x && building.y === point.y))) {
    return { ok: false, reason: 'Здесь уже стоит постройка' }
  }
  const cost = BUILD_COSTS[kind]
  const total = {
    wood: cost.wood * unique.length,
    stone: cost.stone * unique.length,
    silver: cost.silver * unique.length,
  }
  if (state.resources.wood < total.wood || state.resources.stone < total.stone || state.resources.silver < total.silver) {
    return { ok: false, reason: 'Не хватает припасов' }
  }

  state.resources.wood -= total.wood
  state.resources.stone -= total.stone
  state.resources.silver -= total.silver
  for (const point of unique) {
    state.buildings.push({ id: state.nextId++, kind, ...point, progress: 1, health: 100 })
  }
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: kind === 'road' ? 'Проложена улица' : 'Возведена линия стены',
    text: `Завершено участков: ${unique.length}.`,
    tone: 'good',
  })
  return { ok: true, placed: unique.length }
}

export function revealThreat(state: GameState, kind: Threat['kind'], strength: number): Threat {
  const threat: Threat = {
    id: state.nextId++,
    kind,
    strength,
    supplies: 100,
    status: 'forming',
    intel: 'rumor',
    formedDay: state.day,
  }
  state.threats.push(threat)
  state.events.push({ id: state.nextId++, day: state.day, title: 'Тревожные слухи', text: 'Купцы видели костры за северным перевалом.', tone: 'warning' })
  return threat
}

export function dismissThreat(state: GameState, threatId: number, reason: 'supplies' | 'defeat' | 'diplomacy'): void {
  const threat = state.threats.find((item) => item.id === threatId)
  if (!threat) return
  threat.status = 'disbanded'
  threat.supplies = 0
  const cause = reason === 'supplies' ? 'из-за нехватки припасов' : reason === 'defeat' ? 'после поражения' : 'после переговоров'
  state.events.push({ id: state.nextId++, day: state.day, title: 'Угроза миновала', text: `Вражеские отряды рассеялись ${cause}.`, tone: 'good' })
}

function escalateCrisis(state: GameState, kind: Crisis['kind'], title: string, text: string): void {
  const crisis = state.crises.find((item) => item.kind === kind)
  if (crisis) {
    crisis.pressure = Math.min(100, crisis.pressure + 8)
    return
  }
  state.crises.push({ id: state.nextId++, kind, pressure: 28 })
  state.events.push({ id: state.nextId++, day: state.day, title, text, tone: 'danger' })
}

export function resolveRaid(
  state: GameState,
  threatId: number,
  defenseStrength: number,
): { outcome: 'victory' | 'defeat'; enemyLosses: number; cityLosses: number } {
  const threat = state.threats.find((item) => item.id === threatId)
  if (!threat || threat.status === 'disbanded') return { outcome: 'victory', enemyLosses: 0, cityLosses: 0 }

  const enemyLosses = Math.min(threat.strength, Math.round(defenseStrength * 0.7))
  const cityLosses = Math.max(2, Math.round(threat.strength * 0.18 - defenseStrength * 0.09))
  const outcome = defenseStrength >= threat.strength * 0.7 ? 'victory' : 'defeat'
  threat.strength -= enemyLosses
  threat.status = outcome === 'victory' ? 'withdrawing' : 'raiding'
  state.people = Math.max(0, state.people - cityLosses)
  state.order = Math.max(0, state.order - (outcome === 'victory' ? 2 : 12))
  if (outcome === 'defeat') state.resources.food = Math.max(0, state.resources.food - 240)
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: outcome === 'victory' ? 'Налёт отбит' : 'Посад разграблен',
    text: outcome === 'victory' ? 'Дружина удержала Северные ворота.' : 'Враги прорвались к городским амбарам.',
    tone: outcome === 'victory' ? 'good' : 'danger',
  })
  return { outcome, enemyLosses, cityLosses }
}

export function advanceGame(state: GameState, days = 1): void {
  for (let index = 0; index < days; index += 1) {
    state.day += 1
    state.tick += 240

    const farms = state.buildings.filter((building) => building.kind === 'farm' && building.progress >= 1).length
    const camps = state.buildings.filter((building) => building.kind === 'lumberCamp' && building.progress >= 1).length
    state.resources.food += farms * 14 - Math.ceil(state.people * 0.12)
    state.resources.wood += camps * 8

    for (const building of state.buildings) {
      if (building.progress < 1) building.progress = Math.min(1, building.progress + 0.18)
    }

    if (state.resources.food < 0) {
      state.resources.food = 0
      state.order = Math.max(0, state.order - 4)
      const famine = state.crises.find((crisis) => crisis.kind === 'famine')
      if (famine) famine.pressure += 14
      else if (state.day >= 7) {
        state.crises.push({ id: state.nextId++, kind: 'famine', pressure: 30 })
        state.events.push({ id: state.nextId++, day: state.day, title: 'Голод в посаде', text: 'Пустые амбары вызывают беспорядки.', tone: 'danger' })
      }
    }

    if (state.order < 30) {
      escalateCrisis(state, 'rebellion', 'Бунт в посаде', 'Недовольные ремесленники возводят баррикады у рынка.')
    }
    if (state.legitimacy < 25) {
      escalateCrisis(state, 'coup', 'Заговор знати', 'Часть бояр обсуждает смену правителя за закрытыми дверями.')
    }

    for (const threat of state.threats) {
      const age = state.day - threat.formedDay
      if (threat.status === 'forming' && age >= 2) {
        threat.status = 'approaching'
        threat.intel = 'confirmed'
      } else if (threat.status === 'approaching' && age >= 5) {
        threat.status = 'raiding'
      }
      if (threat.status !== 'disbanded') {
        threat.supplies = Math.max(0, threat.supplies - 8)
        if (threat.supplies === 0) dismissThreat(state, threat.id, 'supplies')
      }
    }

    if (state.day > 90) {
      state.day = 1
      state.season = state.season === 'Осень' ? 'Зима' : state.season === 'Зима' ? 'Весна' : state.season === 'Весна' ? 'Лето' : 'Осень'
      if (state.season === 'Весна') state.year += 1
    }
  }
}

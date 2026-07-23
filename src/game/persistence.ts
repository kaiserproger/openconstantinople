import { getPreset } from '../presets'
import type { CameraSnapshot } from '../renderer/CameraController'
import { normalizeCampaign } from './campaign'
import type { GameState } from './simulation'

interface SaveEnvelope {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
  checksum: string
  payload: string
}

export interface SaveMeta {
  presetId: string
  camera: CameraSnapshot
}

const DEFAULT_META: SaveMeta = {
  presetId: 'byzantine-macedonian',
  camera: { targetX: 32, targetZ: 32, zoom: 1, quarter: 0 },
}

export type LoadResult =
  | { ok: true; state: GameState; meta: SaveMeta }
  | { ok: false; reason: 'Сохранение повреждено' | 'Версия сохранения не поддерживается' | 'Неизвестный культурный пресет' }

function checksum(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function envelope(version: SaveEnvelope['version'], value: unknown): string {
  const payload = JSON.stringify(value)
  return JSON.stringify({ version, checksum: checksum(payload), payload } satisfies SaveEnvelope)
}

function validState(value: unknown): value is GameState {
  const state = value as Partial<GameState>
  return Boolean(state?.map?.seed && state.resources && Array.isArray(state.buildings) && Array.isArray(state.threats))
}

function validCamera(value: unknown): value is CameraSnapshot {
  const camera = value as Partial<CameraSnapshot>
  return [camera.targetX, camera.targetZ, camera.zoom, camera.quarter].every(Number.isFinite)
    && (camera.zoom ?? 0) >= 0.65
    && (camera.zoom ?? 3) <= 2.2
    && Number.isInteger(camera.quarter)
    && (camera.quarter ?? -1) >= 0
    && (camera.quarter ?? 5) <= 3
}

export function encodeSave(state: GameState, meta: SaveMeta = DEFAULT_META): string {
  return envelope(15, { state, meta })
}

export function encodeVersionOneFixture(state: GameState): string {
  const { campaign: _campaign, ...legacy } = state
  return envelope(1, legacy)
}

export function encodeVersionThreeFixture(state: GameState, meta: SaveMeta = DEFAULT_META): string {
  const legacyCampaign = {
    ...state.campaign,
    realms: state.campaign.realms.map(({
      status: _status,
      defeatedAt: _defeatedAt,
      defeatedBy: _defeatedBy,
      ...realm
    }) => ({ ...realm, ruler: realm.ruler.name })),
    provinces: state.campaign.provinces.map(({
      defenseFormation: _defenseFormation,
      capitalOf: _capitalOf,
      homelandOf: _homelandOf,
      homelandCapitalOf: _homelandCapitalOf,
      ...province
    }) => province),
    marches: state.campaign.marches.map(({ formation: _formation, kind: _kind, route: _route, ...march }) => march),
  } as unknown as Partial<GameState['campaign']>
  delete legacyCampaign.relations
  delete legacyCampaign.economies
  delete legacyCampaign.allianceOffers
  delete legacyCampaign.peaceOffers
  delete legacyCampaign.tradeRoutes
  delete legacyCampaign.sieges
  delete legacyCampaign.winnerRealmId
  return envelope(3, { state: { ...state, campaign: legacyCampaign }, meta })
}

export function encodeVersionSevenFixture(state: GameState, meta: SaveMeta = DEFAULT_META): string {
  const legacyCampaign = {
    ...state.campaign,
    relations: state.campaign.relations.map(({ tradeEmbargoes: _tradeEmbargoes, ...relation }) => relation),
    provinces: state.campaign.provinces.map(({
      marketLevel: _marketLevel,
      fortificationLevel: _fortificationLevel,
      workshopLevel: _workshopLevel,
      homelandOf: _homelandOf,
      homelandCapitalOf: _homelandCapitalOf,
      project: _project,
      ...province
    }) => province),
  } as Partial<GameState['campaign']>
  delete legacyCampaign.allianceOffers
  delete legacyCampaign.peaceOffers
  delete legacyCampaign.tradeRoutes
  delete legacyCampaign.sieges
  return envelope(7, { state: { ...state, campaign: legacyCampaign }, meta })
}

export function decodeSave(value: string): LoadResult {
  try {
    const saved = JSON.parse(value) as Partial<SaveEnvelope>
    if (
      saved.version !== 1
      && saved.version !== 2
      && saved.version !== 3
      && saved.version !== 4
      && saved.version !== 5
      && saved.version !== 6
      && saved.version !== 7
      && saved.version !== 8
      && saved.version !== 9
      && saved.version !== 10
      && saved.version !== 11
      && saved.version !== 12
      && saved.version !== 13
      && saved.version !== 14
      && saved.version !== 15
    ) {
      return { ok: false, reason: 'Версия сохранения не поддерживается' }
    }
    if (typeof saved.payload !== 'string' || saved.checksum !== checksum(saved.payload)) {
      return { ok: false, reason: 'Сохранение повреждено' }
    }
    const decoded = JSON.parse(saved.payload) as unknown
    if (saved.version === 1) {
      if (!validState(decoded)) return { ok: false, reason: 'Сохранение повреждено' }
      return {
        ok: true,
        state: { ...decoded, campaign: normalizeCampaign(decoded.campaign, decoded.map.seed) },
        meta: structuredClone(DEFAULT_META),
      }
    }

    const next = decoded as { state?: unknown; meta?: Partial<SaveMeta> }
    if (!validState(next.state) || !next.meta || typeof next.meta.presetId !== 'string') {
      return { ok: false, reason: 'Сохранение повреждено' }
    }
    try {
      getPreset(next.meta.presetId)
    } catch {
      return { ok: false, reason: 'Неизвестный культурный пресет' }
    }
    const state = next.state
    state.campaign = normalizeCampaign(state.campaign, state.map.seed)
    return {
      ok: true,
      state,
      meta: {
        presetId: next.meta.presetId,
        camera: validCamera(next.meta.camera) ? next.meta.camera : { ...DEFAULT_META.camera },
      },
    }
  } catch {
    return { ok: false, reason: 'Сохранение повреждено' }
  }
}

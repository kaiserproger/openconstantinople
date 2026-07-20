import type { GameState } from './simulation'

interface SaveEnvelope {
  version: 1
  checksum: string
  payload: string
}

export type LoadResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: 'Сохранение повреждено' | 'Версия сохранения не поддерживается' }

function checksum(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function encodeSave(state: GameState): string {
  const payload = JSON.stringify(state)
  const envelope: SaveEnvelope = { version: 1, checksum: checksum(payload), payload }
  return JSON.stringify(envelope)
}

export function decodeSave(value: string): LoadResult {
  try {
    const envelope = JSON.parse(value) as Partial<SaveEnvelope>
    if (envelope.version !== 1) return { ok: false, reason: 'Версия сохранения не поддерживается' }
    if (typeof envelope.payload !== 'string' || envelope.checksum !== checksum(envelope.payload)) {
      return { ok: false, reason: 'Сохранение повреждено' }
    }
    const state = JSON.parse(envelope.payload) as Partial<GameState>
    if (!state.map?.seed || !state.resources || !Array.isArray(state.buildings) || !Array.isArray(state.threats)) {
      return { ok: false, reason: 'Сохранение повреждено' }
    }
    return { ok: true, state: state as GameState }
  } catch {
    return { ok: false, reason: 'Сохранение повреждено' }
  }
}

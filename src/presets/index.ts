import { byzantineMacedonian } from './byzantineMacedonian'

const presets = new Map([[byzantineMacedonian.id, byzantineMacedonian]])

export { byzantineMacedonian }
export type { CivilizationPreset } from './types'

export function getPreset(id: string) {
  const preset = presets.get(id)
  if (!preset) throw new Error(`Unknown civilization preset: ${id}`)
  return preset
}

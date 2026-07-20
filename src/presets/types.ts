import type { BuildingKind } from '../game/simulation'

export interface CivilizationPalette {
  porphyry: number
  gold: number
  marble: number
  brick: number
  roof: number
  water: number
  olive: number
  danger: number
}

export interface CivilizationPreset {
  id: string
  cityName: string
  rulerTitle: string
  resources: Record<'silver' | 'food' | 'wood' | 'stone', string>
  buildings: Record<BuildingKind, string>
  units: Record<'militia' | 'retinue' | 'raider', string>
  threats: string[]
  palette: CivilizationPalette
}

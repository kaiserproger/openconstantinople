import type { BuildingKind, Crisis } from '../game/simulation'

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
  buildingDetails: Record<BuildingKind, { role: string; effect: string }>
  units: Record<'militia' | 'retinue' | 'raider', string>
  crises: Record<Crisis['kind'], { title: string; action: string; cost: string; alternative: string; alternativeCost: string }>
  threats: string[]
  palette: CivilizationPalette
}

import type { Point } from './simulation'

export type FormationKind = 'militia' | 'spears' | 'archers' | 'retinue'
export type FormationShape = 'line' | 'shieldwall' | 'wedge'

export const FORMATION_SHAPES: readonly FormationShape[] = ['line', 'shieldwall', 'wedge']

export const FORMATION_SHAPE_LABELS: Record<FormationShape, string> = {
  line: 'Линия',
  shieldwall: 'Стена щитов',
  wedge: 'Клин',
}

const FORMATION_COUNTER: Record<FormationShape, FormationShape> = {
  line: 'shieldwall',
  shieldwall: 'wedge',
  wedge: 'line',
}

export function formationMatchupModifier(attacker: FormationShape, defender: FormationShape): number {
  if (attacker === defender) return 0
  return FORMATION_COUNTER[attacker] === defender ? 0.2 : -0.2
}

export interface BattleFormation {
  id: FormationKind
  kind: FormationKind
  soldiers: number
  morale: number
  shape: FormationShape
  start: Point
  target: Point | null
}

export interface BattlePlanAssessment {
  defenseStrength: number
  orderedFormations: number
  doctrineBonus: number
  positionBonus: number
  ready: boolean
  formations: Record<FormationKind, FormationAssessment>
}

export interface FormationAssessment {
  baseStrength: number
  doctrineBonus: number
  positionBonus: number
  orderBonus: number
  total: number
}

const BASE_POWER: Record<FormationKind, number> = {
  militia: 0.55,
  spears: 0.85,
  archers: 0.8,
  retinue: 1.25,
}

const PREFERRED_SHAPE: Record<FormationKind, FormationShape> = {
  militia: 'shieldwall',
  spears: 'shieldwall',
  archers: 'line',
  retinue: 'wedge',
}

const DOCTRINE_BONUS: Record<FormationKind, number> = {
  militia: 7,
  spears: 8,
  archers: 7,
  retinue: 9,
}

export function createBattleFormations(): BattleFormation[] {
  return [
    { id: 'militia', kind: 'militia', soldiers: 28, morale: 76, shape: 'line', start: { x: 22, y: 31 }, target: null },
    { id: 'spears', kind: 'spears', soldiers: 18, morale: 82, shape: 'line', start: { x: 27, y: 37 }, target: null },
    { id: 'archers', kind: 'archers', soldiers: 14, morale: 78, shape: 'line', start: { x: 19, y: 42 }, target: null },
    { id: 'retinue', kind: 'retinue', soldiers: 8, morale: 90, shape: 'line', start: { x: 31, y: 43 }, target: null },
  ]
}

function placementBonus(formation: BattleFormation): number {
  if (!formation.target) return 0
  if (formation.kind === 'archers') return formation.target.y >= 27 ? 4 : 0
  if (formation.kind === 'retinue') return formation.target.x <= 24 || formation.target.x >= 40 ? 5 : 0
  if (formation.kind === 'spears') return formation.target.y <= 28 ? 3 : 0
  return formation.target.y <= 32 ? 2 : 0
}

export function assessBattlePlan(formations: readonly BattleFormation[]): BattlePlanAssessment {
  const orderedFormations = formations.filter((formation) => formation.target).length
  const formationAssessments = Object.fromEntries(formations.map((formation) => {
    const baseStrength = formation.soldiers * BASE_POWER[formation.kind] * (formation.morale / 100)
    const doctrineBonus = formation.shape === PREFERRED_SHAPE[formation.kind] ? DOCTRINE_BONUS[formation.kind] : 0
    const position = placementBonus(formation)
    const orderBonus = formation.target ? 2 : 0
    return [formation.id, {
      baseStrength: Math.round(baseStrength),
      doctrineBonus,
      positionBonus: position,
      orderBonus,
      total: Math.round(baseStrength + doctrineBonus + position + orderBonus),
    } satisfies FormationAssessment]
  })) as Record<FormationKind, FormationAssessment>
  const doctrineBonus = Object.values(formationAssessments).reduce((total, formation) => total + formation.doctrineBonus, 0)
  const positionBonus = Object.values(formationAssessments).reduce((total, formation) => total + formation.positionBonus, 0)
  const defenseStrength = Object.values(formationAssessments).reduce((total, formation) => total + formation.total, 0)

  return {
    defenseStrength,
    orderedFormations,
    doctrineBonus,
    positionBonus,
    ready: orderedFormations === formations.length,
    formations: formationAssessments,
  }
}

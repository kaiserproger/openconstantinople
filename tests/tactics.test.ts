import { assessBattlePlan, createBattleFormations, formationMatchupModifier } from '../src/game/tactics'

describe('formation battle planning', () => {
  it('resolves the field doctrine counter cycle without randomness', () => {
    expect(formationMatchupModifier('line', 'shieldwall')).toBe(0.2)
    expect(formationMatchupModifier('shieldwall', 'wedge')).toBe(0.2)
    expect(formationMatchupModifier('wedge', 'line')).toBe(0.2)
    expect(formationMatchupModifier('line', 'wedge')).toBe(-0.2)
    expect(formationMatchupModifier('shieldwall', 'shieldwall')).toBe(0)
  })

  it('starts with four distinct medieval formations and no issued orders', () => {
    const formations = createBattleFormations()

    expect(formations.map((formation) => formation.kind)).toEqual(['militia', 'spears', 'archers', 'retinue'])
    expect(formations.every((formation) => formation.shape === 'line')).toBe(true)
    expect(assessBattlePlan(formations)).toMatchObject({ orderedFormations: 0, ready: false })
  })

  it('turns doctrine and deployment choices into deterministic defense strength', () => {
    const formations = createBattleFormations()
    const targets = [
      { x: 32, y: 22 },
      { x: 37, y: 24 },
      { x: 31, y: 34 },
      { x: 46, y: 27 },
    ]
    formations.forEach((formation, index) => { formation.target = targets[index]! })
    formations[0]!.shape = 'shieldwall'
    formations[1]!.shape = 'shieldwall'
    formations[3]!.shape = 'wedge'

    const prepared = assessBattlePlan(formations)
    expect(prepared).toMatchObject({ orderedFormations: 4, doctrineBonus: 31, positionBonus: 14, ready: true })
    expect(prepared.defenseStrength).toBeGreaterThanOrEqual(80)

    formations.forEach((formation) => { formation.shape = 'line' })
    formations[0]!.target = { x: 32, y: 40 }
    formations[1]!.target = { x: 32, y: 40 }
    formations[2]!.target = { x: 32, y: 20 }
    formations[3]!.target = { x: 32, y: 40 }
    const careless = assessBattlePlan(formations)
    expect(careless.defenseStrength).toBeLessThan(60)
    expect(careless.formations.retinue).toMatchObject({ doctrineBonus: 0, positionBonus: 0 })
  })
})

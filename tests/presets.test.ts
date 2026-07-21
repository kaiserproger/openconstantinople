import { byzantineMacedonian, getPreset } from '../src/presets'

describe('civilization presets', () => {
  it('maps generic simulation concepts to the Byzantine presentation', () => {
    expect(byzantineMacedonian.id).toBe('byzantine-macedonian')
    expect(byzantineMacedonian.resources.silver).toBe('Номисмы')
    expect(byzantineMacedonian.buildings.townHall).toBe('Дворец стратега')
    expect(byzantineMacedonian.units.retinue).toBe('Тагма')
    expect(byzantineMacedonian.crises.coup.action).toBe('Принять клятвы')
    expect(byzantineMacedonian.threats).toEqual(expect.arrayContaining([
      'Сельджукский бейлик',
      'Славянский союз',
      'Арабский эмират',
      'Персидская держава',
    ]))
  })

  it('rejects unknown preset ids instead of silently changing culture', () => {
    expect(() => getPreset('missing')).toThrow('Unknown civilization preset: missing')
  })
})

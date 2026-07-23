export type NationId = string

export interface NationRuler {
  name: string
  dynasty: string
  age: number
  martial: number
  diplomacy: number
  stewardship: number
  trait: string
}

export interface NationDefinition {
  id: NationId
  name: string
  shortName: string
  mapStyle: 'imperial' | 'steppe' | 'danubian'
  ruler: NationRuler
  startingArea: {
    columns: [number, number]
    rows: [number, number]
  }
  capital: {
    column: number
    row: number
  }
}

export const NATIONS: readonly NationDefinition[] = [
  {
    id: 'porphyry',
    name: 'Фема Порфирополиса',
    shortName: 'Порфирополис',
    mapStyle: 'imperial',
    ruler: {
      name: 'Алексий',
      dynasty: 'Ласкариды',
      age: 34,
      martial: 12,
      diplomacy: 10,
      stewardship: 13,
      trait: 'Осмотрительный стратег',
    },
    startingArea: { columns: [0, 2], rows: [3, 7] },
    capital: { column: 2, row: 5 },
  },
  {
    id: 'seljuk',
    name: 'Сельджукский бейлик',
    shortName: 'Сельджуки',
    mapStyle: 'steppe',
    ruler: {
      name: 'Кутлуг-бей',
      dynasty: 'Кынык',
      age: 41,
      martial: 14,
      diplomacy: 7,
      stewardship: 9,
      trait: 'Неутомимый завоеватель',
    },
    startingArea: { columns: [5, 7], rows: [0, 3] },
    capital: { column: 6, row: 2 },
  },
  {
    id: 'bulgar',
    name: 'Болгарская марка',
    shortName: 'Болгары',
    mapStyle: 'danubian',
    ruler: {
      name: 'Тервел',
      dynasty: 'Дуло',
      age: 29,
      martial: 11,
      diplomacy: 13,
      stewardship: 10,
      trait: 'Верный клятве',
    },
    startingArea: { columns: [5, 7], rows: [5, 7] },
    capital: { column: 6, row: 6 },
  },
]

export const DEFAULT_NATION_ID: NationId = NATIONS[0].id

export function nationById(id: NationId): NationDefinition | null {
  return NATIONS.find((nation) => nation.id === id) ?? null
}

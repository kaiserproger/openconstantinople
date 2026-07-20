import type { CivilizationPreset } from './types'

export const byzantineMacedonian: CivilizationPreset = {
  id: 'byzantine-macedonian',
  cityName: 'Порфирополис',
  rulerTitle: 'Стратег фемы',
  resources: { silver: 'Номисмы', food: 'Зерно', wood: 'Древесина', stone: 'Камень' },
  buildings: {
    road: 'Месса',
    house: 'Инсула',
    farm: 'Проастий',
    lumberCamp: 'Лесной двор',
    quarry: 'Каменоломня',
    granary: 'Зерновой фонд',
    market: 'Агора',
    smithy: 'Эргастирий',
    barracks: 'Казармы тагмы',
    watchtower: 'Фриктория',
    wall: 'Феодосиева стена',
    townHall: 'Дворец стратега',
  },
  units: { militia: 'Городское ополчение', retinue: 'Тагма', raider: 'Налётчики' },
  threats: ['Сельджукский бейлик', 'Славянский союз', 'Арабский эмират', 'Персидская держава'],
  palette: {
    porphyry: 0x351a46,
    gold: 0xd3aa55,
    marble: 0xd8cfb8,
    brick: 0x9b4c36,
    roof: 0x8a392e,
    water: 0x173d55,
    olive: 0x667341,
    danger: 0xb84e52,
  },
}

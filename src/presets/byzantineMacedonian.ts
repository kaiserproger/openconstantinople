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
  crises: {
    famine: { title: 'Голод в посаде', action: 'Закупить зерно', cost: '24 номисмы' },
    rebellion: { title: 'Бунт городских демов', action: 'Даровать уступки', cost: '18 номисм · −3 легитимности' },
    coup: { title: 'Заговор знати', action: 'Принять клятвы', cost: '28 номисм · −2 порядка' },
  },
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

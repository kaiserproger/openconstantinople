<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import {
  Castle,
  Coins,
  Eye,
  FastForward,
  Hammer,
  House,
  Pause,
  Play,
  ScrollText,
  Shield,
  Swords,
  TreePine,
  Users,
  Warehouse,
  Wheat,
} from '@lucide/vue'
import {
  advanceGame,
  createGame,
  placeBuilding,
  revealThreat,
  resolveRaid,
  type BuildingKind,
} from './game/simulation'

const game = reactive(createGame('heather-17'))
revealThreat(game, 'raiders', 85)
const initialBuildingCount = game.buildings.length
const selectedTool = ref<BuildingKind>('road')
const speed = ref<0 | 1 | 4>(1)
const notice = ref('Выберите постройку и укажите место на карте')
const battleVisible = ref(false)

const resources = computed(() => [
  { key: 'silver', label: 'Серебро', value: game.resources.silver.toLocaleString('ru-RU'), gain: '+4', icon: Coins },
  { key: 'wood', label: 'Древесина', value: game.resources.wood.toLocaleString('ru-RU'), gain: '+8', icon: TreePine },
  { key: 'stone', label: 'Камень', value: game.resources.stone.toLocaleString('ru-RU'), gain: '+3', icon: Castle },
  { key: 'food', label: 'Пища', value: game.resources.food.toLocaleString('ru-RU'), gain: '−12', icon: Wheat },
  { key: 'people', label: 'Жители', value: `${game.people} / ${game.capacity}`, gain: '+1', icon: Users },
])

const chronicle = [
  ['Налётчики замечены', 'Враги появились к северу от долины.', '17 день', Shield],
  ['Башня завершена', 'Северная башня приступила к дозору.', '16 день', Castle],
  ['Торговля завершена', 'Купцы из Железного брода отбыли.', '15 день', Coins],
  ['Ополчение обучено', 'Восемь ратников вошли в гарнизон.', '14 день', Shield],
  ['Урожай собран', 'Поля принесли 612 мер зерна.', '13 день', Wheat],
]

const buildings: Array<{ label: string; kind: BuildingKind; icon: typeof House }> = [
  { label: 'Дорога', kind: 'road', icon: TreePine },
  { label: 'Дом', kind: 'house', icon: House },
  { label: 'Ферма', kind: 'farm', icon: Wheat },
  { label: 'Лесопилка', kind: 'lumberCamp', icon: TreePine },
  { label: 'Каменоломня', kind: 'quarry', icon: Hammer },
  { label: 'Амбар', kind: 'granary', icon: Warehouse },
  { label: 'Рынок', kind: 'market', icon: Coins },
  { label: 'Кузница', kind: 'smithy', icon: Hammer },
  { label: 'Казарма', kind: 'barracks', icon: Shield },
  { label: 'Башня', kind: 'watchtower', icon: Castle },
  { label: 'Стена', kind: 'wall', icon: Shield },
  { label: 'Ратуша', kind: 'townHall', icon: Castle },
]

const placedBuildings = computed(() => game.buildings.slice(initialBuildingCount))
const primaryThreat = computed(() => game.threats.find((threat) => threat.status !== 'disbanded'))

function chooseSpeed(value: 0 | 1 | 4) {
  speed.value = value
  notice.value = value === 0 ? 'Время остановлено' : `Скорость времени: ${value}×`
}

function buildAt(event: MouseEvent) {
  const element = event.currentTarget as HTMLElement
  const bounds = element.getBoundingClientRect()
  const width = bounds.width || 1000
  const height = bounds.height || 600
  const x = Math.max(0, Math.min(63, Math.round(((event.clientX - bounds.left) / width) * 63)))
  const y = Math.max(0, Math.min(63, Math.round(((event.clientY - bounds.top) / height) * 63)))
  const result = placeBuilding(game, selectedTool.value, { x, y })
  notice.value = result.ok ? `${buildings.find((item) => item.kind === selectedTool.value)?.label} заложена` : result.reason
}

function buildingStyle(x: number, y: number) {
  return { left: `${(x / 63) * 100}%`, top: `${(y / 63) * 100}%` }
}

function defendCity() {
  if (!primaryThreat.value) {
    notice.value = 'Разведка не видит доступных целей'
    return
  }
  battleVisible.value = true
  const result = resolveRaid(game, primaryThreat.value.id, 68)
  notice.value = result.outcome === 'victory'
    ? `Налёт отбит · враг потерял ${result.enemyLosses}, город — ${result.cityLosses}`
    : `Посад прорван · потери ${result.cityLosses}`
}

const timer = window.setInterval(() => {
  if (speed.value > 0) advanceGame(game, speed.value)
}, 3500)
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <main class="game-shell" data-testid="game-shell">
    <header class="topbar game-frame">
      <div class="resource-strip">
        <div v-for="resource in resources" :key="resource.label" class="resource" :title="resource.label" :data-resource="resource.key">
          <component :is="resource.icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
          <div><strong>{{ resource.value }}</strong><span>{{ resource.gain }}</span></div>
        </div>
      </div>
      <div class="settlement-mark">
        <span class="crest"><Castle :size="27" :stroke-width="1.7" /></span>
        <div><h1>Вересков Дол</h1><p>{{ game.season }} · Сумерки · {{ game.year }} год, {{ game.day }} день</p></div>
      </div>
      <div class="time-controls" aria-label="Скорость времени">
        <span class="speed-label" data-testid="speed-label">{{ speed }}×</span>
        <button :class="['square-button', { active: speed === 0 }]" data-speed="0" @click="chooseSpeed(0)"><Pause :size="18" /><span class="sr-only">Пауза</span></button>
        <button :class="['square-button', { active: speed === 1 }]" data-speed="1" @click="chooseSpeed(1)"><Play :size="18" /><span class="sr-only">Обычная скорость</span></button>
        <button :class="['square-button', { active: speed === 4 }]" data-speed="4" @click="chooseSpeed(4)"><FastForward :size="18" /><span class="sr-only">Быстро</span></button>
      </div>
    </header>

    <section class="world" aria-label="Карта поселения" data-testid="world" @click="buildAt">
      <img src="/assets/concepts/openfront-primary-screen.png" alt="Средневековый город Вересков Дол" />
      <div class="world-vignette"></div>
      <div v-if="primaryThreat" class="raid-marker">
        <Shield :size="20" />
        <div><strong>Северный дозор</strong><span>Всадники · примерно {{ primaryThreat.strength }}</span></div>
      </div>
      <div class="town-label"><span>Нижний посад</span><i>Порядок 72</i></div>
      <template v-if="battleVisible">
        <div
          v-for="index in 4"
          :key="`friendly-${index}`"
          class="battle-unit friendly"
          data-testid="friendly-unit"
          :style="{ left: `${48 + index * 2.2}%`, top: `${31 + (index % 2) * 4}%` }"
        ><Shield :size="18" /></div>
        <div
          v-for="index in 5"
          :key="`enemy-${index}`"
          class="battle-unit enemy"
          data-testid="enemy-unit"
          :style="{ left: `${62 + index * 2.4}%`, top: `${21 + (index % 2) * 4}%` }"
        ><Swords :size="18" /></div>
      </template>
      <div
        v-for="building in placedBuildings"
        :key="building.id"
        class="placed-building"
        data-testid="placed-building"
        :style="buildingStyle(building.x, building.y)"
      >
        <component :is="buildings.find((item) => item.kind === building.kind)?.icon || House" :size="27" />
        <span>{{ buildings.find((item) => item.kind === building.kind)?.label }}</span>
      </div>
      <div class="notice" data-testid="notice">{{ notice }}</div>
    </section>

    <aside class="chronicle game-frame">
      <div class="panel-heading"><ScrollText :size="18" /><h2>Летопись</h2><button aria-label="Свернуть">—</button></div>
      <article v-for="entry in chronicle" :key="entry[0] as string" class="chronicle-entry">
        <component :is="entry[3]" :size="24" :stroke-width="1.6" />
        <div><strong>{{ entry[0] }}</strong><p>{{ entry[1] }}</p></div>
        <time>{{ entry[2] }}</time>
      </article>
      <button class="wide-button">Показать старые записи</button>
    </aside>

    <aside class="intel game-frame">
      <div class="panel-heading"><Eye :size="18" /><h2>Разведка</h2><button aria-label="Свернуть">—</button></div>
      <div class="threat-row">
        <div class="threat critical"><Shield :size="24" /><strong>85</strong><span>Север</span></div>
        <div class="threat"><Shield :size="24" /><strong>?</strong><span>Восток</span></div>
        <div class="threat muted"><Shield :size="24" /><strong>0</strong><span>Юг</span></div>
      </div>
      <h3>Донесения</h3>
      <ul class="messages">
        <li class="danger">Вражеский отряд движется к Северным воротам.</li>
        <li>Небольшая группа замечена у реки.</li>
        <li class="safe">Наши купцы вне опасности.</li>
      </ul>
    </aside>

    <aside class="selection game-frame">
      <div class="panel-heading"><Warehouse :size="18" /><h2>Амбар</h2><span>II ранг</span></div>
      <div class="selected-building">
        <div class="building-portrait"><Warehouse :size="44" :stroke-width="1.3" /></div>
        <div><strong>1 200 / 1 200</strong><div class="meter"><i style="width: 100%"></i></div></div>
      </div>
      <p>Хранит зерно и припасы. Снижает порчу продуктов поблизости.</p>
      <dl><div><dt>Запасы</dt><dd>2 845 / 3 600</dd></div><div><dt>Работники</dt><dd>5 / 5</dd></div></dl>
      <div class="selection-actions"><button class="square-button"><Users :size="18" /></button><button class="square-button"><Hammer :size="18" /></button><button class="square-button danger-button"><Shield :size="18" /></button></div>
    </aside>

    <footer class="commandbar game-frame">
      <section class="build-menu">
        <div class="panel-heading"><Hammer :size="18" /><h2>Строительство</h2></div>
        <div class="building-tools">
          <button
            v-for="building in buildings"
            :key="building.kind"
            :data-kind="building.kind"
            :class="['build-button', { active: selectedTool === building.kind }]"
            @click="selectedTool = building.kind"
          >
            <component :is="building.icon" :size="29" :stroke-width="1.45" /><span>{{ building.label }}</span>
          </button>
        </div>
      </section>
      <section class="army-menu">
        <div class="panel-heading"><Shield :size="18" /><h2>Приказы дружине</h2></div>
        <div class="army-actions"><button data-action="hold"><Shield :size="23" />Держать строй</button><button class="attack" data-action="attack" @click="defendCity"><Swords :size="23" />Атаковать</button></div>
      </section>
    </footer>
  </main>
</template>

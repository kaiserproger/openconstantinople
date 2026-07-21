<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import { Hammer, Shield, Trash2 } from '@lucide/vue'
import EdgeDrawer from './components/EdgeDrawer.vue'
import GameWorld from './components/GameWorld.vue'
import ModeBar from './components/ModeBar.vue'
import TopHud from './components/TopHud.vue'
import {
  addressCrisis,
  advanceGame,
  createGame,
  demolishBuilding,
  placeBuilding,
  placePath,
  repairBuilding,
  revealThreat,
  resolveRaid,
  type BuildingKind,
} from './game/simulation'
import { decodeSave, encodeSave } from './game/persistence'
import { byzantineMacedonian } from './presets'

type Mode = 'streets' | 'quarters' | 'production' | 'defense'
type Drawer = 'chronicle' | 'court' | 'intel' | 'object'

const game = reactive(createGame('heather-17'))
revealThreat(game, 'raiders', 85)
const selectedTool = ref<BuildingKind | null>('road')
const mode = ref<Mode>('quarters')
const activeDrawer = ref<Drawer | null>(null)
const selectedBuildingId = ref<number | null>(null)
const speed = ref<0 | 1 | 4>(1)
const notice = ref('Выберите постройку и укажите место на карте')
const battleVisible = ref(false)
const gameWorld = ref<InstanceType<typeof GameWorld> | null>(null)
const stressMode = new URLSearchParams(window.location.search).has('stress')
let worldCounter = 1

const primaryThreat = computed(() => game.threats.find((threat) => threat.status !== 'disbanded'))
const selectedBuilding = computed(() => game.buildings.find((building) => building.id === selectedBuildingId.value) ?? null)
const topResources = computed(() => ({
  ...game.resources,
  people: game.people,
  capacity: game.capacity,
}))

function chooseSpeed(value: 0 | 1 | 4): void {
  speed.value = value
  notice.value = value === 0 ? 'Время остановлено' : `Скорость времени: ${value}×`
}

function chooseMode(value: Mode): void {
  mode.value = value
  selectedTool.value = null
  closeObjectDrawer()
}

function chooseTool(kind: BuildingKind): void {
  selectedTool.value = kind
  closeObjectDrawer()
  notice.value = `${byzantineMacedonian.buildings[kind]} · выберите место`
}

function buildAt(point: { x: number; y: number }): void {
  if (!selectedTool.value) return
  const kind = selectedTool.value
  const result = placeBuilding(game, kind, point)
  notice.value = result.ok ? `${byzantineMacedonian.buildings[kind]} заложена` : result.reason
}

function buildPath(points: Array<{ x: number; y: number }>): void {
  if (selectedTool.value !== 'road' && selectedTool.value !== 'wall') return
  const result = placePath(game, selectedTool.value, points)
  notice.value = result.ok ? `Завершено участков: ${result.placed}` : result.reason
}

function defendCity(): void {
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

function toggleDrawer(drawer: Drawer): void {
  if (activeDrawer.value === 'object') selectedBuildingId.value = null
  activeDrawer.value = activeDrawer.value === drawer ? null : drawer
}

function closeObjectDrawer(): void {
  if (activeDrawer.value === 'object') activeDrawer.value = null
  selectedBuildingId.value = null
}

function closeDrawer(): void {
  closeObjectDrawer()
  activeDrawer.value = null
}

function selectBuilding(buildingId: number): void {
  const building = game.buildings.find((item) => item.id === buildingId)
  if (!building) return
  selectedTool.value = null
  selectedBuildingId.value = buildingId
  activeDrawer.value = 'object'
  notice.value = `${byzantineMacedonian.buildings[building.kind]} · объект выбран`
}

function cancelInteraction(): void {
  const hadObject = selectedBuildingId.value !== null
  selectedTool.value = null
  closeObjectDrawer()
  notice.value = hadObject ? 'Выбор объекта снят' : 'Строительство отменено'
}

function repairSelected(): void {
  if (!selectedBuilding.value) return
  const result = repairBuilding(game, selectedBuilding.value.id)
  notice.value = result.ok ? 'Ремонт завершён' : result.reason
}

function demolishSelected(): void {
  if (!selectedBuilding.value) return
  const result = demolishBuilding(game, selectedBuilding.value.id)
  notice.value = result.ok ? 'Участок расчищен, пригодные материалы возвращены' : result.reason
  if (result.ok) closeObjectDrawer()
}

function handleCrisis(crisisId: number): void {
  const result = addressCrisis(game, crisisId)
  notice.value = result.ok ? result.summary : result.reason
}

function saveSettlement(): void {
  localStorage.setItem('openfront:autosave', encodeSave(game, {
    presetId: byzantineMacedonian.id,
    camera: gameWorld.value?.snapshotCamera() ?? { targetX: 32, targetZ: 32, zoom: 1, quarter: 0 },
  }))
  notice.value = 'Княжество сохранено'
}

function loadSettlement(): void {
  const saved = localStorage.getItem('openfront:autosave')
  if (!saved) {
    notice.value = 'Сохранение не найдено'
    return
  }
  const result = decodeSave(saved)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  Object.assign(game, result.state)
  closeObjectDrawer()
  battleVisible.value = false
  notice.value = 'Летопись княжества восстановлена'
  void nextTick(() => gameWorld.value?.restoreCamera(result.meta.camera))
}

function newWorld(): void {
  const next = createGame(`porphyry-${17 + worldCounter}`)
  worldCounter += 1
  Object.assign(game, next)
  closeObjectDrawer()
  revealThreat(game, worldCounter % 2 === 0 ? 'scouts' : 'raiders', 34 + worldCounter * 7)
  battleVisible.value = false
  notice.value = `Открыта новая фема · ${game.map.seed}`
}

const timer = window.setInterval(() => {
  if (speed.value > 0) advanceGame(game, speed.value)
}, 3500)
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <main :class="['game-shell', { 'stress-mode': stressMode }]" data-testid="game-shell">
    <section class="world" aria-label="Карта княжества" data-testid="world">
      <GameWorld
        ref="gameWorld"
        :seed="game.map.seed"
        :buildings="game.buildings"
        :selected-tool="selectedTool"
        :selected-building-id="selectedBuildingId"
        :battle-visible="battleVisible"
        :stress-mode="stressMode"
        @build="buildAt"
        @build-path="buildPath"
        @select="selectBuilding"
        @cancel="cancelInteraction"
      />
      <div class="world-vignette"></div>
      <div v-if="primaryThreat" class="raid-marker">
        <Shield :size="18" />
        <div><strong>{{ byzantineMacedonian.threats[0] }}</strong><span>Конница · сила около {{ primaryThreat.strength }}</span></div>
      </div>
      <div class="town-label"><span>{{ byzantineMacedonian.cityName }}</span><i>Порядок {{ game.order }} · легитимность {{ game.legitimacy }}</i></div>
      <div class="notice" data-testid="notice">{{ notice }}</div>
    </section>

    <TopHud
      :city-name="byzantineMacedonian.cityName"
      :seed="game.map.seed"
      :season="game.season"
      :year="game.year"
      :day="game.day"
      :speed="speed"
      :resources="topResources"
      @speed="chooseSpeed"
      @new-world="newWorld"
      @save="saveSettlement"
      @load="loadSettlement"
      @toggle-drawer="toggleDrawer"
    />

    <EdgeDrawer v-if="activeDrawer === 'chronicle'" title="Летопись" @close="closeDrawer">
      <article v-for="event in [...game.events].reverse().slice(0, 8)" :key="event.id" :class="['drawer-entry', event.tone]">
        <time>{{ event.day }} день</time><strong>{{ event.title }}</strong><p>{{ event.text }}</p>
      </article>
    </EdgeDrawer>

    <EdgeDrawer v-if="activeDrawer === 'intel'" title="Разведка" @close="closeDrawer">
      <div class="threat-summary"><Shield :size="28" /><strong>{{ primaryThreat?.strength ?? 0 }}</strong><span>Северо-восток</span></div>
      <h3>{{ byzantineMacedonian.threats[0] }}</h3>
      <p>Передовые разъезды движутся к дороге на Порфирополис. Состав войска уточняется.</p>
      <ul class="political-actors"><li v-for="actor in byzantineMacedonian.threats" :key="actor">{{ actor }}</li></ul>
    </EdgeDrawer>

    <EdgeDrawer v-if="activeDrawer === 'court'" title="Двор стратега" @close="closeDrawer">
      <div class="court-balance">
        <div><span>Порядок</span><strong>{{ game.order }}</strong><i><b :style="{ width: `${game.order}%` }"></b></i></div>
        <div><span>Легитимность</span><strong>{{ game.legitimacy }}</strong><i><b :style="{ width: `${game.legitimacy}%` }"></b></i></div>
      </div>
      <p v-if="game.crises.length === 0" class="court-calm">Кризисов нет. Двор сохраняет хрупкое равновесие.</p>
      <article v-for="crisis in game.crises" :key="crisis.id" class="crisis-card" :data-crisis="crisis.kind">
        <header><strong>{{ byzantineMacedonian.crises[crisis.kind].title }}</strong><span>{{ crisis.pressure }}</span></header>
        <div class="crisis-pressure"><i :style="{ width: `${crisis.pressure}%` }"></i></div>
        <small>{{ byzantineMacedonian.crises[crisis.kind].cost }}</small>
        <button data-action="address-crisis" @click="handleCrisis(crisis.id)">{{ byzantineMacedonian.crises[crisis.kind].action }}</button>
      </article>
    </EdgeDrawer>

    <EdgeDrawer
      v-if="activeDrawer === 'object' && selectedBuilding"
      :title="byzantineMacedonian.buildings[selectedBuilding.kind]"
      @close="closeDrawer"
    >
      <section class="object-card" data-testid="object-card">
        <div class="object-seal"><span>{{ selectedBuilding.id }}</span><small>участок</small></div>
        <dl>
          <div><dt>Состояние</dt><dd>{{ selectedBuilding.health }}%</dd></div>
          <div><dt>Готовность</dt><dd>{{ Math.round(selectedBuilding.progress * 100) }}%</dd></div>
          <div><dt>Координаты</dt><dd>{{ selectedBuilding.x }} · {{ selectedBuilding.y }}</dd></div>
        </dl>
        <div class="condition-track"><i :style="{ width: `${selectedBuilding.health}%` }"></i></div>
        <p>Расход ремонта зависит от повреждений. При разборе четверть пригодных материалов возвращается на склад.</p>
        <div class="object-actions">
          <button data-action="repair-building" :disabled="selectedBuilding.health >= 100" @click="repairSelected">
            <Hammer :size="17" /><span>Ремонтировать</span>
          </button>
          <button data-action="demolish-building" :disabled="selectedBuilding.kind === 'townHall'" @click="demolishSelected">
            <Trash2 :size="17" /><span>Разобрать</span>
          </button>
        </div>
        <small v-if="selectedBuilding.kind === 'townHall'" class="protected-note">Дворец — неразбираемый центр управления.</small>
      </section>
    </EdgeDrawer>

    <ModeBar
      :mode="mode"
      :selected-tool="selectedTool"
      :preset="byzantineMacedonian"
      @mode="chooseMode"
      @tool="chooseTool"
      @attack="defendCity"
    />
  </main>
</template>

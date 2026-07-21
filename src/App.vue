<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import { Crosshair, Flame, Hammer, Shield, Trash2, TrendingDown, TrendingUp, Wheat } from '@lucide/vue'
import EdgeDrawer from './components/EdgeDrawer.vue'
import GameWorld from './components/GameWorld.vue'
import ModeBar from './components/ModeBar.vue'
import TopHud from './components/TopHud.vue'
import {
  addressCrisis,
  advanceGame,
  createGame,
  demolishBuilding,
  dismissThreat,
  placeBuilding,
  placePath,
  recommendedCrisisResponse,
  repairBuilding,
  revealThreat,
  resolveRaid,
  settlementOutlook,
  type BuildingKind,
  type CrisisResponse,
  type Point,
} from './game/simulation'
import { decodeSave, encodeSave } from './game/persistence'
import { byzantineMacedonian } from './presets'

type Mode = 'streets' | 'quarters' | 'production' | 'defense'
type Drawer = 'chronicle' | 'court' | 'intel' | 'object'
const modeNames: Record<Mode, string> = { streets: 'Улицы', quarters: 'Кварталы', production: 'Производство', defense: 'Оборона' }

const game = reactive(createGame('heather-17'))
revealThreat(game, 'raiders', 85)
const selectedTool = ref<BuildingKind | null>(null)
const mode = ref<Mode>('quarters')
const activeDrawer = ref<Drawer | null>(null)
const selectedBuildingId = ref<number | null>(null)
const speed = ref<0 | 1 | 4>(1)
const notice = ref('Выберите раздел строительства или осмотрите город')
const battleVisible = ref(false)
const battleOutcome = ref<'victory' | 'defeat' | null>(null)
const burningBuildingIds = ref<number[]>([])
const tacticalCommand = ref(false)
const battleCommandPoint = ref<Point | null>(null)
const activeBattleThreatId = ref<number | null>(null)
const gameWorld = ref<InstanceType<typeof GameWorld> | null>(null)
const stressMode = new URLSearchParams(window.location.search).has('stress')
let worldCounter = 1
let battleTimer = 0

const primaryThreat = computed(() => game.threats.find((threat) => threat.status !== 'disbanded'))
const selectedBuilding = computed(() => game.buildings.find((building) => building.id === selectedBuildingId.value) ?? null)
const outlook = computed(() => settlementOutlook(game))
const threatStatus = computed(() => ({
  forming: 'собирает силы',
  approaching: 'движется к городу',
  raiding: 'штурмует посад',
  withdrawing: 'отступает',
  disbanded: 'рассеян',
}[primaryThreat.value?.status ?? 'forming']))
const constructionHint = computed(() => {
  if (!selectedTool.value) return null
  const name = byzantineMacedonian.buildings[selectedTool.value]
  return selectedTool.value === 'road' || selectedTool.value === 'wall'
    ? `${name} · Тяните ЛКМ по прямой, отпустите для строительства · Esc отмена`
    : `${name} · ЛКМ поставить · перетаскивание перемещает карту · Esc отмена`
})
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
  notice.value = `${modeNames[value]} · выберите инструмент`
}

function chooseTool(kind: BuildingKind): void {
  selectedTool.value = kind
  closeObjectDrawer()
  notice.value = ''
}

function buildAt(point: { x: number; y: number }): void {
  if (!selectedTool.value) return
  if (selectedTool.value === 'road' || selectedTool.value === 'wall') {
    buildPath([point])
    return
  }
  const kind = selectedTool.value
  const result = placeBuilding(game, kind, point)
  notice.value = result.ok ? `${byzantineMacedonian.buildings[kind]} заложена` : result.reason
}

function buildPath(points: Array<{ x: number; y: number }>): void {
  if (selectedTool.value !== 'road' && selectedTool.value !== 'wall') return
  const result = placePath(game, selectedTool.value, points)
  notice.value = result.ok
    ? selectedTool.value === 'road'
      ? `Проложено клеток улицы: ${result.placed}`
      : `Возведено секций стены: ${result.placed}`
    : result.reason
}

function defendCity(): void {
  if (!primaryThreat.value) {
    notice.value = 'Разведка не видит доступных целей'
    return
  }
  if (battleVisible.value || primaryThreat.value.status === 'withdrawing') {
    notice.value = 'Сражение уже идёт'
    return
  }
  window.clearTimeout(battleTimer)
  battleVisible.value = true
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleCommandPoint.value = null
  activeBattleThreatId.value = primaryThreat.value.id
  notice.value = 'Ополчение выступило · укажите точку обороны или положитесь на воеводу'
  battleTimer = window.setTimeout(() => resolveActiveRaid(false), 3200)
}

function selectMilitia(): void {
  if (!battleVisible.value || battleOutcome.value) return
  tacticalCommand.value = true
  selectedTool.value = null
  closeObjectDrawer()
  notice.value = 'Ополчение выбрано · укажите точку обороны на карте'
}

function commandMilitia(point: Point): void {
  if (!tacticalCommand.value || !battleVisible.value || battleOutcome.value) return
  tacticalCommand.value = false
  battleCommandPoint.value = { ...point }
  resolveActiveRaid(true)
}

function resolveActiveRaid(manualOrder: boolean): void {
  if (!battleVisible.value || battleOutcome.value || activeBattleThreatId.value === null) return
  window.clearTimeout(battleTimer)
  battleTimer = 0
  const threatId = activeBattleThreatId.value
  const result = resolveRaid(game, threatId, manualOrder ? 72 : 58)
  battleOutcome.value = result.outcome
  burningBuildingIds.value = result.burningBuildingIds
  notice.value = result.outcome === 'victory'
    ? `Налёт отбит ${manualOrder ? 'по вашему приказу' : 'воеводой'} · враг потерял ${result.enemyLosses}, город — ${result.cityLosses}`
    : `Без приказа посад прорван · потери ${result.cityLosses}`
  battleTimer = window.setTimeout(() => {
    battleTimer = 0
    battleVisible.value = false
    tacticalCommand.value = false
    battleCommandPoint.value = null
    activeBattleThreatId.value = null
    burningBuildingIds.value = []
    if (result.outcome === 'victory') dismissThreat(game, threatId, 'defeat')
  }, stressMode ? 8000 : 4800)
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
  if (tacticalCommand.value) {
    tacticalCommand.value = false
    notice.value = 'Приказ отменён · воевода продолжает оборону'
    return
  }
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

function handleCrisis(crisisId: number, response: CrisisResponse = 'fund'): void {
  const result = addressCrisis(game, crisisId, response)
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
  window.clearTimeout(battleTimer)
  battleTimer = 0
  closeObjectDrawer()
  battleVisible.value = false
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleCommandPoint.value = null
  activeBattleThreatId.value = null
  notice.value = 'Летопись княжества восстановлена'
  void nextTick(() => gameWorld.value?.restoreCamera(result.meta.camera))
}

function newWorld(): void {
  window.clearTimeout(battleTimer)
  battleTimer = 0
  const next = createGame(`porphyry-${17 + worldCounter}`)
  worldCounter += 1
  Object.assign(game, next)
  closeObjectDrawer()
  revealThreat(game, worldCounter % 2 === 0 ? 'scouts' : 'raiders', 34 + worldCounter * 7)
  battleVisible.value = false
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleCommandPoint.value = null
  activeBattleThreatId.value = null
  notice.value = `Открыта новая фема · ${game.map.seed}`
}

const timer = window.setInterval(() => {
  if (speed.value > 0) advanceGame(game, speed.value)
}, 3500)
onUnmounted(() => {
  window.clearInterval(timer)
  window.clearTimeout(battleTimer)
})
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
        :building-names="byzantineMacedonian.buildings"
        :building-details="byzantineMacedonian.buildingDetails"
        :battle-visible="battleVisible"
        :battle-outcome="battleOutcome"
        :tactical-command="tacticalCommand"
        :battle-command-point="battleCommandPoint"
        :burning-building-ids="burningBuildingIds"
        :stress-mode="stressMode"
        @build="buildAt"
        @build-path="buildPath"
        @select="selectBuilding"
        @battle-command="commandMilitia"
        @cancel="cancelInteraction"
      />
      <div class="world-vignette"></div>
      <div v-if="primaryThreat" class="raid-marker">
        <Shield :size="18" />
        <div><strong>{{ byzantineMacedonian.threats[0] }}</strong><span>{{ threatStatus }} · сила около {{ primaryThreat.strength }}</span></div>
      </div>
      <div :class="['realm-outlook', outlook.level]" data-testid="realm-outlook">
        <Wheat :size="17" />
        <div><strong>Амбары</strong><span v-if="outlook.reserveDays === null"><TrendingUp :size="12" /> +{{ outlook.dailyFood }} в день</span><span v-else><TrendingDown :size="12" /> {{ outlook.reserveDays }} дн. · {{ outlook.dailyFood }} в день</span></div>
      </div>
      <div v-if="battleVisible" class="battle-report" data-testid="battle-report">
        <Flame :size="17" />
        <div>
          <strong>Схватка у Северных ворот</strong>
          <span>{{ battleOutcome === 'victory' ? 'Враг дрогнул и отходит' : battleOutcome === 'defeat' ? 'Налётчики рвутся к амбарам' : 'Ополчение ждёт приказа' }}</span>
        </div>
        <button
          v-if="!battleOutcome"
          :class="{ active: tacticalCommand }"
          data-action="select-militia"
          @click="selectMilitia"
        ><Crosshair :size="15" /><span>{{ tacticalCommand ? 'Укажите точку' : 'Ополчение' }}</span></button>
      </div>
      <div class="town-label"><span>{{ byzantineMacedonian.cityName }}</span><i>Порядок {{ game.order }} · легитимность {{ game.legitimacy }}</i></div>
      <div v-if="constructionHint" class="construction-hint" data-testid="construction-hint">{{ constructionHint }}</div>
      <div v-if="notice" class="notice" data-testid="notice">{{ notice }}</div>
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
        <div class="crisis-actions">
          <button :class="{ recommended: recommendedCrisisResponse(game, crisis) === 'fund' }" data-action="address-crisis" @click="handleCrisis(crisis.id, 'fund')"><span>{{ byzantineMacedonian.crises[crisis.kind].action }}</span><small>{{ byzantineMacedonian.crises[crisis.kind].cost }}</small><b v-if="recommendedCrisisResponse(game, crisis) === 'fund'">Совет Двора</b></button>
          <button :class="{ recommended: recommendedCrisisResponse(game, crisis) === 'hardline' }" data-action="address-crisis-hardline" @click="handleCrisis(crisis.id, 'hardline')"><span>{{ byzantineMacedonian.crises[crisis.kind].alternative }}</span><small>{{ byzantineMacedonian.crises[crisis.kind].alternativeCost }}</small><b v-if="recommendedCrisisResponse(game, crisis) === 'hardline'">Совет Двора</b></button>
        </div>
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
        <div class="object-purpose"><strong>{{ byzantineMacedonian.buildingDetails[selectedBuilding.kind].role }}</strong><span>{{ byzantineMacedonian.buildingDetails[selectedBuilding.kind].effect }}</span></div>
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
      :attack-state="battleVisible || primaryThreat?.status === 'withdrawing' ? 'battle' : primaryThreat ? 'ready' : 'none'"
      :preset="byzantineMacedonian"
      @mode="chooseMode"
      @tool="chooseTool"
      @attack="defendCity"
    />
  </main>
</template>

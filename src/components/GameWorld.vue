<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Building, BuildingKind, Point } from '../game/simulation'
import { straightPath } from '../game/constructionPath'
import type { CameraSnapshot } from '../renderer/CameraController'
import type { WorldRenderer as WorldRendererType } from '../renderer/WorldRenderer'

const props = defineProps<{
  seed: string
  buildings: Building[]
  selectedTool: BuildingKind | null
  selectedBuildingId: number | null
  buildingNames: Record<BuildingKind, string>
  battleVisible: boolean
  stressMode: boolean
}>()

const emit = defineEmits<{
  build: [point: Point]
  buildPath: [points: Point[]]
  select: [buildingId: number]
  cancel: []
  cameraChange: [snapshot: CameraSnapshot]
}>()
const canvas = ref<HTMLCanvasElement | null>(null)
const rendererLost = ref(false)
let world: WorldRendererType | null = null
let resizeObserver: ResizeObserver | null = null
let disposed = false
const cameraState = reactive<CameraSnapshot>({ targetX: 32, targetZ: 32, zoom: 1, quarter: 0 })
const pathDragging = ref(false)
const hoveredBuildingId = ref<number | null>(null)
const hoverPosition = reactive({ x: 0, y: 0 })
const hoveredBuilding = computed(() => props.buildings.find((building) => building.id === hoveredBuildingId.value) ?? null)
let pointerStart: { clientX: number; clientY: number; point: Point } | null = null
let pointerLast: Point | null = null
let handledPointerClick = false

function syncWorld(): void {
  world?.setWorld(props.seed, props.buildings, props.battleVisible, props.stressMode)
}

function syncSelection(): void {
  world?.setSelectedBuilding(props.selectedBuildingId)
}

function fallbackPick(event: MouseEvent, bounds: DOMRect): Point {
  const width = bounds.width || 1000
  const height = bounds.height || 600
  return {
    x: Math.max(0, Math.min(63, Math.round(((event.clientX - bounds.left) / width) * 63))),
    y: Math.max(0, Math.min(63, Math.round(((event.clientY - bounds.top) / height) * 63))),
  }
}

function build(event: MouseEvent): void {
  if (handledPointerClick) {
    handledPointerClick = false
    return
  }
  if (!canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  if (!props.selectedTool) return
  const point = world?.pickGrid(event.clientX, event.clientY, bounds) ?? fallbackPick(event, bounds)
  if (props.selectedTool === 'road' || props.selectedTool === 'wall') emit('buildPath', [point])
  else emit('build', point)
}

function pointAt(event: MouseEvent | PointerEvent): Point | null {
  if (!canvas.value) return null
  const bounds = canvas.value.getBoundingClientRect()
  return world?.pickGrid(event.clientX, event.clientY, bounds) ?? fallbackPick(event as MouseEvent, bounds)
}

function updateCameraState(): void {
  if (!world) return
  Object.assign(cameraState, world.cameraSnapshot())
  emit('cameraChange', { ...cameraState })
}

function pointerDown(event: PointerEvent): void {
  const point = pointAt(event)
  if (!point) return
  pointerStart = { clientX: event.clientX, clientY: event.clientY, point }
  pointerLast = point
  hoveredBuildingId.value = null
  pathDragging.value = props.selectedTool === 'road' || props.selectedTool === 'wall'
  canvas.value?.setPointerCapture?.(event.pointerId)
}

function pointerMove(event: PointerEvent): void {
  if (!pointerStart && !props.selectedTool && canvas.value) {
    const bounds = canvas.value.getBoundingClientRect()
    hoveredBuildingId.value = world?.pickBuilding(event.clientX, event.clientY, bounds) ?? null
    hoverPosition.x = event.clientX - bounds.left + 14
    hoverPosition.y = event.clientY - bounds.top + 14
    return
  }
  hoveredBuildingId.value = null
  const point = pointAt(event)
  if (!point) return
  if (pointerStart && (props.selectedTool === 'road' || props.selectedTool === 'wall')) {
    world?.showPathPreview(props.selectedTool, straightPath(pointerStart.point, point))
    return
  }
  if (props.selectedTool) world?.showPreview(props.selectedTool, point)
  if (!pointerStart) return
  const moved = Math.hypot(event.clientX - pointerStart.clientX, event.clientY - pointerStart.clientY)
  if (moved <= 4 || props.selectedTool === 'road' || props.selectedTool === 'wall') return
  if (pointerLast) world?.pan((pointerLast.x - point.x) * 0.35, (pointerLast.y - point.y) * 0.35)
  pointerLast = point
  updateCameraState()
}

function pointerUp(event: PointerEvent): void {
  if (!pointerStart) return
  const end = pointAt(event) ?? pointerStart.point
  const moved = Math.hypot(event.clientX - pointerStart.clientX, event.clientY - pointerStart.clientY)
  if (props.selectedTool === 'road' || props.selectedTool === 'wall') {
    emit('buildPath', straightPath(pointerStart.point, end))
  } else if (moved <= 4) {
    const bounds = canvas.value?.getBoundingClientRect()
    const buildingId = bounds ? world?.pickBuilding(event.clientX, event.clientY, bounds) : null
    if (buildingId !== null && buildingId !== undefined) {
      world?.hidePreview()
      emit('select', buildingId)
    } else if (props.selectedTool) {
      emit('build', end)
    }
  }
  handledPointerClick = true
  pointerStart = null
  pointerLast = null
  pathDragging.value = false
  world?.hidePreview()
}

function wheel(event: WheelEvent): void {
  event.preventDefault()
  world?.zoom(-event.deltaY * 0.012)
  updateCameraState()
}

function keyDown(event: KeyboardEvent): void {
  if (event.code === 'KeyQ' || event.code === 'KeyE') {
    world?.rotateQuarter(event.code === 'KeyE' ? 1 : -1)
    updateCameraState()
  } else if (event.code === 'Escape') {
    pointerStart = null
    pointerLast = null
    pathDragging.value = false
    world?.hidePreview()
    emit('cancel')
  }
}

function hidePreview(): void {
  world?.hidePreview()
  hoveredBuildingId.value = null
}

function cancelPointerGesture(): void {
  pointerStart = null
  pointerLast = null
  pathDragging.value = false
  world?.hidePreview()
}

function snapshotCamera(): CameraSnapshot {
  return world?.cameraSnapshot() ?? { ...cameraState }
}

function restoreCamera(snapshot: CameraSnapshot): void {
  world?.restoreCamera(snapshot)
  Object.assign(cameraState, snapshot)
}

function contextLost(event: Event): void {
  event.preventDefault()
  rendererLost.value = true
  world?.pause()
}

function contextRestored(): void {
  world?.recover()
  rendererLost.value = false
}

function recoverRenderer(): void {
  if (world) world.requestRecovery()
  else rendererLost.value = false
}

defineExpose({ snapshotCamera, restoreCamera })

onMounted(async () => {
  if (!canvas.value) return
  window.addEventListener('keydown', keyDown)
  canvas.value.addEventListener('webglcontextlost', contextLost)
  canvas.value.addEventListener('webglcontextrestored', contextRestored)
  try {
    const { WorldRenderer } = await import('../renderer/WorldRenderer')
    if (!canvas.value || disposed) return
    world = new WorldRenderer(canvas.value)
    syncWorld()
    syncSelection()
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => world?.resize())
      resizeObserver.observe(canvas.value)
    }
  } catch (error) {
    console.warn('Voxel renderer unavailable; interaction fallback remains active.', error)
  }
})

watch(() => [props.seed, props.buildings.length, props.battleVisible, props.stressMode], syncWorld)
watch(() => props.selectedBuildingId, syncSelection)

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', keyDown)
  canvas.value?.removeEventListener('webglcontextlost', contextLost)
  canvas.value?.removeEventListener('webglcontextrestored', contextRestored)
  world?.dispose()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="voxel-world"
    :class="{ placing: selectedTool, 'line-building': pathDragging }"
    data-testid="voxel-world"
    :data-battle="String(battleVisible)"
    :data-tool="selectedTool ?? 'none'"
    :data-quarter="cameraState.quarter"
    :aria-label="selectedTool ? `Изометрическая карта, выбран инструмент: ${selectedTool}` : 'Изометрическая карта, режим осмотра'"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="cancelPointerGesture"
    @lostpointercapture="cancelPointerGesture"
    @pointerleave="hidePreview"
    @wheel="wheel"
    @click="build"
  ></canvas>
  <div
    v-if="hoveredBuilding"
    class="building-tooltip period-frame"
    data-testid="building-tooltip"
    :style="{ left: `${hoverPosition.x}px`, top: `${hoverPosition.y}px` }"
  >
    <strong>{{ buildingNames[hoveredBuilding.kind] }}</strong>
    <span>Состояние {{ hoveredBuilding.health }}%</span>
  </div>
  <span
    class="sr-only"
    data-testid="camera-state"
    :data-quarter="cameraState.quarter"
    :data-zoom="cameraState.zoom"
  >Положение изометрической камеры</span>
  <div v-if="rendererLost" class="renderer-recovery" data-testid="renderer-recovery" role="alert">
    <strong>Рендер мира приостановлен</strong>
    <button @click="recoverRenderer">Восстановить</button>
  </div>
</template>

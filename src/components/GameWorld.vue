<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Building, BuildingKind, Point } from '../game/simulation'
import type { CameraSnapshot } from '../renderer/CameraController'
import type { WorldRenderer as WorldRendererType } from '../renderer/WorldRenderer'

const props = defineProps<{
  seed: string
  buildings: Building[]
  selectedTool: BuildingKind | null
  battleVisible: boolean
  stressMode: boolean
}>()

const emit = defineEmits<{
  build: [point: Point]
  buildPath: [points: Point[]]
  cancel: []
  cameraChange: [snapshot: CameraSnapshot]
}>()
const canvas = ref<HTMLCanvasElement | null>(null)
const rendererLost = ref(false)
let world: WorldRendererType | null = null
let resizeObserver: ResizeObserver | null = null
let disposed = false
const cameraState = reactive<CameraSnapshot>({ targetX: 32, targetZ: 32, zoom: 1, quarter: 0 })
let pointerStart: { clientX: number; clientY: number; point: Point } | null = null
let pointerLast: Point | null = null
let handledPointerClick = false

function syncWorld(): void {
  world?.setWorld(props.seed, props.buildings, props.battleVisible, props.stressMode)
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
  if (props.selectedTool) emit('build', world?.pickGrid(event.clientX, event.clientY, bounds) ?? fallbackPick(event, bounds))
}

function pointAt(event: MouseEvent | PointerEvent): Point | null {
  if (!canvas.value) return null
  const bounds = canvas.value.getBoundingClientRect()
  return world?.pickGrid(event.clientX, event.clientY, bounds) ?? fallbackPick(event as MouseEvent, bounds)
}

function gridLine(from: Point, to: Point): Point[] {
  const points: Point[] = []
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let error = dx - dy
  while (true) {
    points.push({ x, y })
    if (x === to.x && y === to.y) break
    const twice = error * 2
    if (twice > -dy) { error -= dy; x += sx }
    if (twice < dx) { error += dx; y += sy }
  }
  return points
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
  canvas.value?.setPointerCapture?.(event.pointerId)
}

function pointerMove(event: PointerEvent): void {
  const point = pointAt(event)
  if (!point) return
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
  if (props.selectedTool && (props.selectedTool === 'road' || props.selectedTool === 'wall') && moved > 4) {
    emit('buildPath', gridLine(pointerStart.point, end))
  } else if (props.selectedTool && moved <= 4) {
    emit('build', end)
  }
  handledPointerClick = true
  pointerStart = null
  pointerLast = null
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
    world?.hidePreview()
    emit('cancel')
  }
}

function hidePreview(): void {
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
  try {
    const hasWebGL = Boolean(canvas.value.getContext('webgl2') || canvas.value.getContext('webgl'))
    if (hasWebGL) {
      const { WorldRenderer } = await import('../renderer/WorldRenderer')
      if (!canvas.value || disposed) return
      world = new WorldRenderer(canvas.value)
      syncWorld()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => world?.resize())
        resizeObserver.observe(canvas.value)
      }
    }
  } catch (error) {
    console.warn('Voxel renderer unavailable; interaction fallback remains active.', error)
  }
  window.addEventListener('keydown', keyDown)
  canvas.value.addEventListener('webglcontextlost', contextLost)
  canvas.value.addEventListener('webglcontextrestored', contextRestored)
})

watch(() => [props.seed, props.buildings.length, props.battleVisible, props.stressMode], syncWorld)

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
    data-testid="voxel-world"
    :data-battle="String(battleVisible)"
    :data-quarter="cameraState.quarter"
    :aria-label="`Изометрическая карта: ${selectedTool}`"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointerleave="hidePreview"
    @wheel="wheel"
    @click="build"
  ></canvas>
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

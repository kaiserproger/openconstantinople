<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Building, BuildingKind, Point } from '../game/simulation'
import { WorldRenderer } from '../renderer/WorldRenderer'

const props = defineProps<{
  seed: string
  buildings: Building[]
  selectedTool: BuildingKind
  battleVisible: boolean
  stressMode: boolean
}>()

const emit = defineEmits<{ build: [point: Point] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let world: WorldRenderer | null = null
let resizeObserver: ResizeObserver | null = null

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
  if (!canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  emit('build', world?.pickGrid(event.clientX, event.clientY, bounds) ?? fallbackPick(event, bounds))
}

onMounted(() => {
  if (!canvas.value) return
  try {
    const hasWebGL = Boolean(canvas.value.getContext('webgl2') || canvas.value.getContext('webgl'))
    if (hasWebGL) {
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
})

watch(() => [props.seed, props.buildings.length, props.battleVisible, props.stressMode], syncWorld)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  world?.dispose()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="voxel-world"
    data-testid="voxel-world"
    :data-battle="String(battleVisible)"
    :aria-label="`Изометрическая карта: ${selectedTool}`"
    @click="build"
  ></canvas>
</template>

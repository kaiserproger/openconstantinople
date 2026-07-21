<script setup lang="ts">
import { Anvil, Castle, Fence, Hammer, House, Landmark, Map, Shield, ShoppingBasket, Swords, TowerControl, TreePine, Warehouse, Wheat } from '@lucide/vue'
import type { Component } from 'vue'
import type { BuildingKind } from '../game/simulation'
import type { CivilizationPreset } from '../presets'

type Mode = 'streets' | 'quarters' | 'production' | 'defense'
const props = defineProps<{
  mode: Mode
  selectedTool: BuildingKind | null
  preset: CivilizationPreset
  attackState: 'ready' | 'battle' | 'none'
}>()
defineEmits<{ mode: [mode: Mode]; tool: [kind: BuildingKind]; attack: [] }>()

const modes: Array<{ id: Mode; label: string; icon: Component }> = [
  { id: 'streets', label: 'Улицы', icon: Map },
  { id: 'quarters', label: 'Кварталы', icon: House },
  { id: 'production', label: 'Производство', icon: Anvil },
  { id: 'defense', label: 'Оборона', icon: Shield },
]

const toolGroups: Record<Mode, Array<{ kind: BuildingKind; icon: Component }>> = {
  streets: [{ kind: 'road', icon: Map }, { kind: 'market', icon: ShoppingBasket }],
  quarters: [{ kind: 'house', icon: House }, { kind: 'granary', icon: Warehouse }, { kind: 'townHall', icon: Landmark }],
  production: [{ kind: 'farm', icon: Wheat }, { kind: 'lumberCamp', icon: TreePine }, { kind: 'quarry', icon: Hammer }, { kind: 'smithy', icon: Anvil }],
  defense: [{ kind: 'barracks', icon: Castle }, { kind: 'watchtower', icon: TowerControl }, { kind: 'wall', icon: Fence }],
}
</script>

<template>
  <footer class="mode-dock period-frame" data-testid="mode-bar">
    <div class="mode-tabs">
      <button v-for="item in modes" :key="item.id" :class="{ active: mode === item.id }" :data-mode="item.id" @click="$emit('mode', item.id)">
        <component :is="item.icon" :size="19" /><span>{{ item.label }}</span>
      </button>
    </div>
    <div class="tool-rail">
      <span class="rail-title">{{ modes.find((item) => item.id === mode)?.label }}</span>
      <button
        v-for="tool in toolGroups[props.mode]"
        :key="tool.kind"
        :class="{ active: selectedTool === tool.kind }"
        :data-kind="tool.kind"
        @click="$emit('tool', tool.kind)"
      >
        <component :is="tool.icon" :size="22" /><span>{{ preset.buildings[tool.kind] }}</span>
        <small v-if="tool.kind === 'road' || tool.kind === 'wall'">тянуть линию</small>
      </button>
      <button class="battle-command" data-action="attack" :disabled="attackState !== 'ready'" @click="$emit('attack')"><Swords :size="22" /><span>{{ attackState === 'battle' ? 'Бой идёт' : attackState === 'none' ? 'Угроз нет' : 'Отразить налёт' }}</span></button>
    </div>
  </footer>
</template>

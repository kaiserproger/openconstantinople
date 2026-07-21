<script setup lang="ts">
import { Castle, Coins, Crown, Dices, Eye, FastForward, FolderOpen, Pause, Play, Save, ScrollText, ShieldAlert, TreePine, Users, Wheat } from '@lucide/vue'

defineProps<{
  cityName: string
  seed: string
  season: string
  year: number
  day: number
  speed: 0 | 1 | 4
  resources: { silver: number; wood: number; stone: number; food: number; people: number; capacity: number }
}>()

defineEmits<{
  speed: [value: 0 | 1 | 4]
  newWorld: []
  save: []
  load: []
  toggleDrawer: [drawer: 'chronicle' | 'court' | 'intel']
}>()
</script>

<template>
  <header class="top-hud period-frame" data-testid="top-hud">
    <div class="city-seal"><Castle :size="23" /><div><strong>{{ cityName }}</strong><span>{{ season }} · {{ year }} г. · день {{ day }} · <i data-testid="seed">{{ seed }}</i></span></div></div>
    <div class="hud-resources">
      <span data-resource="silver" title="Номисмы"><Coins :size="16" /><b>{{ resources.silver.toLocaleString('ru-RU') }}</b><em>Номисмы</em></span>
      <span data-resource="wood" title="Древесина"><TreePine :size="16" /><b>{{ resources.wood }}</b></span>
      <span data-resource="stone" title="Камень"><Castle :size="16" /><b>{{ resources.stone }}</b></span>
      <span data-resource="food" title="Зерно"><Wheat :size="16" /><b>{{ resources.food.toLocaleString('ru-RU') }}</b></span>
      <span data-resource="people" title="Жители"><Users :size="16" /><b>{{ resources.people }}/{{ resources.capacity }}</b></span>
    </div>
    <nav class="hud-actions" aria-label="Управление княжеством">
      <button data-action="toggle-chronicle" title="Летопись" @click="$emit('toggleDrawer', 'chronicle')"><ScrollText :size="17" /></button>
      <button data-action="toggle-court" title="Двор" @click="$emit('toggleDrawer', 'court')"><Crown :size="17" /></button>
      <button data-action="toggle-intel" title="Разведка" @click="$emit('toggleDrawer', 'intel')"><Eye :size="17" /></button>
      <button data-action="new-world" title="Новый мир" @click="$emit('newWorld')"><Dices :size="17" /></button>
      <button data-action="save" title="Сохранить" @click="$emit('save')"><Save :size="17" /></button>
      <button data-action="load" title="Загрузить" @click="$emit('load')"><FolderOpen :size="17" /></button>
      <span class="speed-value" data-testid="speed-label">{{ speed }}×</span>
      <button :class="{ active: speed === 0 }" data-speed="0" title="Пауза" @click="$emit('speed', 0)"><Pause :size="16" /></button>
      <button :class="{ active: speed === 1 }" data-speed="1" title="Ход времени" @click="$emit('speed', 1)"><Play :size="16" /></button>
      <button :class="{ active: speed === 4 }" data-speed="4" title="Ускорить" @click="$emit('speed', 4)"><FastForward :size="16" /></button>
      <ShieldAlert class="threat-glyph" :size="18" aria-label="Есть внешняя угроза" />
    </nav>
  </header>
</template>

<script setup lang="ts">
import { Castle, Coins, Crown, Dices, Eye, FastForward, FolderOpen, MapPinned, Pause, Play, RadioTower, Save, ScrollText, ShieldAlert, TreePine, Users, Wheat } from '@lucide/vue'
import type { MatchConnectionStatus } from '../multiplayer/MatchClient'

defineProps<{
  cityName: string
  seed: string
  season: string
  year: number
  day: number
  campaignDay: number
  speed: 0 | 1 | 4
  resources: { silver: number; wood: number; stone: number; food: number; people: number; capacity: number }
  realmMode: boolean
  matchStatus: MatchConnectionStatus
}>()

defineEmits<{
  speed: [value: 0 | 1 | 4]
  newWorld: []
  save: []
  load: []
  toggleDrawer: [drawer: 'chronicle' | 'court' | 'intel' | 'multiplayer']
  toggleRealm: []
}>()
</script>

<template>
  <header class="top-hud period-frame" data-testid="top-hud">
    <div class="city-seal">
      <Castle :size="23" />
      <div>
        <strong>{{ cityName }}</strong>
        <span v-if="realmMode">Стратегическая карта · день {{ campaignDay }} · <i data-testid="seed">{{ seed }}</i></span>
        <span v-else>{{ season }} · {{ year }} г. · день {{ day }} · <i data-testid="seed">{{ seed }}</i></span>
      </div>
    </div>
    <div class="hud-resources">
      <span data-resource="silver" title="Номисмы"><Coins :size="16" /><b>{{ resources.silver.toLocaleString('ru-RU') }}</b><em>Номисмы</em></span>
      <span data-resource="wood" title="Древесина"><TreePine :size="16" /><b>{{ resources.wood }}</b></span>
      <span data-resource="stone" title="Камень"><Castle :size="16" /><b>{{ resources.stone }}</b></span>
      <span data-resource="food" title="Зерно"><Wheat :size="16" /><b>{{ resources.food.toLocaleString('ru-RU') }}</b></span>
      <span data-resource="people" title="Жители"><Users :size="16" /><b>{{ resources.people }}/{{ resources.capacity }}</b></span>
    </div>
    <nav class="hud-actions" aria-label="Управление княжеством">
      <button :class="{ active: realmMode }" data-action="toggle-realm" title="Карта державы" @click="$emit('toggleRealm')"><MapPinned :size="17" /></button>
      <button data-action="toggle-chronicle" title="Летопись" @click="$emit('toggleDrawer', 'chronicle')"><ScrollText :size="17" /></button>
      <button data-action="toggle-court" title="Двор" @click="$emit('toggleDrawer', 'court')"><Crown :size="17" /></button>
      <button data-action="toggle-intel" title="Разведка" @click="$emit('toggleDrawer', 'intel')"><Eye :size="17" /></button>
      <button
        :class="['match-button', `status-${matchStatus}`, { active: matchStatus === 'online' }]"
        data-action="toggle-multiplayer"
        title="Сетевой матч"
        @click="$emit('toggleDrawer', 'multiplayer')"
      ><RadioTower :size="17" /></button>
      <button data-action="new-world" title="Новый мир" @click="$emit('newWorld')"><Dices :size="17" /></button>
      <button data-action="save" title="Сохранить" @click="$emit('save')"><Save :size="17" /></button>
      <button data-action="load" title="Загрузить" @click="$emit('load')"><FolderOpen :size="17" /></button>
      <span class="speed-value" data-testid="speed-label">{{ matchStatus === 'online' ? 'сеть' : `${speed}×` }}</span>
      <button :class="{ active: speed === 0 && matchStatus !== 'online' }" data-speed="0" title="Пауза" :disabled="matchStatus === 'online'" @click="$emit('speed', 0)"><Pause :size="16" /></button>
      <button :class="{ active: speed === 1 && matchStatus !== 'online' }" data-speed="1" title="Ход времени" :disabled="matchStatus === 'online'" @click="$emit('speed', 1)"><Play :size="16" /></button>
      <button :class="{ active: speed === 4 && matchStatus !== 'online' }" data-speed="4" title="Ускорить" :disabled="matchStatus === 'online'" @click="$emit('speed', 4)"><FastForward :size="16" /></button>
      <ShieldAlert class="threat-glyph" :size="18" aria-label="Есть внешняя угроза" />
    </nav>
  </header>
</template>

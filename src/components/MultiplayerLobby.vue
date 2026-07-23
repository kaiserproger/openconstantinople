<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Clock3, Link, RadioTower, Shield, Swords, Unplug, Users } from '@lucide/vue'
import type { NationDefinition } from '../game/nations'
import type { MatchConnectionStatus } from '../multiplayer/MatchClient'
import type { MatchPhase, MatchPlayer } from '../multiplayer/protocol'

const props = defineProps<{
  status: MatchConnectionStatus
  phase: MatchPhase
  roomId: string
  localNationId: string
  selfReady: boolean
  nations: readonly NationDefinition[]
  players: MatchPlayer[]
  error: string
}>()

const emit = defineEmits<{
  join: [details: { roomId: string; playerName: string; nationId: string }]
  ready: []
  leave: []
}>()

const room = ref(props.roomId || 'porphyry')
const playerName = ref('')
const nationId = ref(props.localNationId || props.nations[0]?.id || '')
const connected = computed(() => props.status === 'online')
const readyCount = computed(() => props.players.filter((player) => player.ready).length)
const roomValid = computed(() => /^[a-z0-9-]{3,24}$/i.test(room.value.trim()))

watch(() => props.localNationId, (value) => {
  if (value) nationId.value = value
})

function occupied(nation: NationDefinition): MatchPlayer | null {
  return props.players.find((player) => player.nationId === nation.id) ?? null
}

function join(): void {
  if (playerName.value.trim().length < 2 || !roomValid.value || !nationId.value) return
  emit('join', {
    roomId: room.value.trim(),
    playerName: playerName.value.trim(),
    nationId: nationId.value,
  })
}
</script>

<template>
  <section class="multiplayer-lobby" data-testid="multiplayer-lobby">
    <header class="match-banner">
      <RadioTower :size="27" />
      <div>
        <small>Сетевой поход</small>
        <strong>{{ connected ? phase === 'lobby' ? `Сбор в комнате ${roomId}` : phase === 'finished' ? `Матч ${roomId} завершён` : `Матч ${roomId}` : 'Общий мир для нескольких правителей' }}</strong>
        <span v-if="connected && phase === 'lobby'">{{ readyCount }}/{{ players.length }} правителей готовы · нужно минимум двое</span>
        <span v-else>{{ connected ? `${players.length} правителей в комнате` : 'Сервер проверяет владение нацией и приказы' }}</span>
      </div>
    </header>

    <template v-if="!connected">
      <label class="match-field">
        <span><Users :size="14" /> Имя правителя</span>
        <input v-model="playerName" data-field="player-name" maxlength="24" placeholder="Алексий" autocomplete="off" />
      </label>
      <label class="match-field">
        <span><Link :size="14" /> Код комнаты</span>
        <input v-model="room" data-field="room-id" maxlength="24" placeholder="porphyry" autocomplete="off" />
      </label>

      <div class="nation-choice">
        <span class="rail-title">Выберите нацию</span>
        <button
          v-for="nation in nations"
          :key="nation.id"
          :class="['nation-option', `nation-${nation.mapStyle}`, { active: nationId === nation.id }]"
          :data-nation="nation.id"
          :disabled="Boolean(occupied(nation))"
          @click="nationId = nation.id"
        >
          <Shield :size="18" />
          <span><b>{{ nation.shortName }}</b><small>{{ occupied(nation)?.name ?? nation.name }}</small></span>
          <Check v-if="nationId === nation.id" :size="16" />
        </button>
      </div>

      <p v-if="error" class="match-error" data-testid="match-error">{{ error }}</p>
      <button
        class="match-primary"
        data-action="join-match"
        :disabled="status === 'connecting' || playerName.trim().length < 2 || !roomValid"
        @click="join"
      >
        <RadioTower :size="18" />
        <span>{{ status === 'connecting' ? 'Соединение…' : 'Войти в матч' }}</span>
      </button>
    </template>

    <template v-else>
      <div class="match-roster" data-testid="match-roster">
        <article v-for="player in players" :key="player.id" :class="{ ready: player.ready }" :data-player-nation="player.nationId">
          <Check v-if="player.ready" :size="17" />
          <Shield v-else :size="17" />
          <div>
            <strong>{{ player.name }}</strong>
            <span>{{ nations.find((nation) => nation.id === player.nationId)?.name ?? player.nationId }} · {{ phase === 'lobby' ? player.ready ? 'готов' : 'ожидает' : 'в матче' }}</span>
          </div>
        </article>
      </div>
      <p v-if="phase === 'lobby'" class="match-note">
        <Clock3 :size="15" /> Кампания и серверные дни начнутся одновременно после готовности всех правителей.
      </p>
      <p v-else class="match-note">
        <Swords :size="15" /> Стратегическая карта синхронизирована сервером. Городская сцена пока остаётся личной.
      </p>
      <button
        v-if="phase === 'lobby'"
        :class="['match-primary', 'match-ready', { active: selfReady }]"
        data-action="match-ready"
        @click="$emit('ready')"
      >
        <Check v-if="selfReady" :size="18" />
        <Swords v-else :size="18" />
        <span>{{ selfReady ? 'Снять готовность' : 'Готов к войне' }}</span>
      </button>
      <button class="match-secondary" data-action="leave-match" @click="$emit('leave')">
        <Unplug :size="17" /><span>Покинуть матч</span>
      </button>
    </template>
  </section>
</template>

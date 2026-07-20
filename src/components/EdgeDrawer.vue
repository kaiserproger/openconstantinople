<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ title: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <aside class="edge-drawer period-frame" data-testid="edge-drawer">
    <header><h2>{{ title }}</h2><button aria-label="Закрыть" @click="$emit('close')"><X :size="17" /></button></header>
    <div class="drawer-content"><slot /></div>
  </aside>
</template>

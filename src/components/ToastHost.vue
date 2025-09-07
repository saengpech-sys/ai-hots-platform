<template>
  <div class="fixed top-5 right-5 z-[9999] space-y-2 select-none">
    <transition-group name="toast-fade" tag="div">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="w-[320px] rounded-xl shadow-lg border p-3 flex gap-3 items-start bg-white/95 backdrop-blur"
        :class="typeClass(t.type)"
      >
        <div class="shrink-0 p-1 rounded-full" :class="dotClass(t.type)"></div>
        <div class="min-w-0">
          <div v-if="t.title" class="font-semibold text-slate-800">{{ t.title }}</div>
          <div class="text-sm text-slate-700 break-words">{{ t.message }}</div>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            v-if="t.actionLabel && t.onClick"
            class="text-[12px] px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-800"
            @click="handleAction(t)"
          >
            {{ t.actionLabel }}
          </button>
          <button class="text-slate-500 hover:text-slate-900" title="ปิด" @click="remove(t.id)">
            ✕
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { toasts, removeToast } from '@/utils/toast'

function handleAction(t) {
  try {
    t.onClick && t.onClick()
  } finally {
    removeToast(t.id)
  }
}

function typeClass(type) {
  switch (type) {
    case 'success':
      return 'border-emerald-300'
    case 'error':
      return 'border-rose-300'
    case 'warning':
      return 'border-amber-300'
    default:
      return 'border-slate-200'
  }
}
function dotClass(type) {
  switch (type) {
    case 'success':
      return 'bg-emerald-500'
    case 'error':
      return 'bg-rose-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-sky-500'
  }
}
function remove(id) {
  removeToast(id)
}
</script>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>

<template>
  <div class="flex flex-wrap gap-3 items-end">
    <div>
      <label class="block text-xs font-medium mb-1">รายวิชา</label>
      <select
        class="border rounded px-2 py-1 text-sm min-w-[170px]"
        v-model="local.courseId"
        @change="emitChange"
      >
        <option disabled value="">-- เลือก --</option>
        <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title || c.id }}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium mb-1">ช่วง (วัน)</label>
      <select
        class="border rounded px-2 py-1 text-sm"
        v-model.number="local.days"
        @change="emitChange"
      >
        <option :value="7">7</option>
        <option :value="30">30</option>
        <option :value="60">60</option>
        <option :value="90">90</option>
        <option :value="0">ทั้งหมด</option>
      </select>
    </div>
    <div class="flex gap-2">
      <button class="btn-primary" @click="$emit('refresh')">รีเฟรช</button>
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  courses: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'refresh'])
const local = reactive({
  courseId: props.modelValue.courseId || '',
  days: props.modelValue.days ?? 30,
})
watch(
  () => props.modelValue,
  (v) => {
    if (v.courseId !== local.courseId) local.courseId = v.courseId || ''
    if (v.days !== local.days) local.days = v.days ?? 30
  },
)
function emitChange() {
  emit('update:modelValue', { courseId: local.courseId, days: local.days })
}
</script>

<style scoped>
.btn-primary {
  @apply bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition;
}
</style>

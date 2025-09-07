<template>
  <div class="border rounded p-4 bg-white h-full flex flex-col">
    <h3 class="font-semibold mb-2 text-sm">{{ title }}</h3>
    <div v-if="!data?.length" class="text-xs text-gray-500">{{ noData }}</div>
    <div ref="root" class="flex-1 min-h-[180px]"></div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
const props = defineProps({
  data: { type: Array, default: () => [] },
  title: String,
  noData: String,
})
const root = ref(null)
let chart
function buildBins(values, bins = 12) {
  const arr = Array.from({ length: bins }).map(() => 0)
  for (const v of values) {
    if (typeof v !== 'number') continue
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v / 100) * bins)))
    arr[idx]++
  }
  return arr
}
function build() {
  if (!root.value) return
  const bins = 12
  const counts = buildBins(props.data, bins)
  const labels = Array.from({ length: bins }).map((_, i) => {
    const step = 100 / bins
    const s = Math.round(i * step)
    const e = Math.round((i + 1) * step)
    return `${s}-${e}`
  })
  const x = labels.map((_, i) => i)
  const y = counts
  chart = new uPlot(
    {
      width: root.value.clientWidth || 300,
      height: 180,
      series: [
        {},
        {
          label: 'Count',
          paths: (u, sidx, i0, i1) => null,
          points: { show: false },
          draw: (u) => {
            const ctx = u.ctx
            const scaleX = u.scales.x
            const scaleY = u.scales.y
            const xScale = u.series[0].scale
            const yScale = u.series[1].scale
            for (let i = 0; i < y.length; i++) {
              const xPos = u.valToPos(i, xScale, true)
              const yPos = u.valToPos(y[i], yScale, true)
              const zeroY = u.valToPos(0, yScale, true)
              const barW = (u.plot.width / y.length) * 0.7
              ctx.fillStyle = '#2563eb'
              ctx.fillRect(xPos - barW / 2, yPos, barW, zeroY - yPos)
            }
          },
        },
      ],
      axes: [{ values: (u, vals) => vals.map((v) => labels[v] || '') }, {}],
      scales: { x: { auto: false }, y: { auto: true } },
    },
    [x, y],
    root.value,
  )
}
function rebuild() {
  if (chart) {
    chart.destroy()
    chart = null
  }
  if (props.data?.length) build()
}
watch(
  () => props.data,
  () => rebuild(),
  { deep: true },
)
onMounted(() => {
  rebuild()
  window.addEventListener('resize', rebuild)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', rebuild)
  chart && chart.destroy()
})
</script>

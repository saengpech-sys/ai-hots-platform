<template>
  <div class="border rounded p-4 bg-white h-full flex flex-col">
    <h3 class="font-semibold mb-2 text-sm">แนวโน้มคะแนนรายวัน</h3>
    <div v-if="!data?.length" class="text-xs text-gray-500">ไม่มีข้อมูล</div>
    <div ref="el" class="flex-1 min-h-[180px]"></div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, TooltipComponent, GridComponent, CanvasRenderer])
const props = defineProps({ data: { type: Array, default: () => [] } })
const el = ref(null)
let chart
function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const dates = props.data.map((d) => d.date)
  const scores = props.data.map((d) => d.avgScore)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { fontSize: 10 } },
    series: [
      {
        name: 'Avg Score',
        type: 'line',
        data: scores,
        smooth: true,
        lineStyle: { width: 2 },
        symbolSize: 6,
        areaStyle: { opacity: 0.1 },
      },
    ],
  })
  chart.resize()
}
watch(
  () => props.data,
  () => {
    render()
  },
  { deep: true },
)
onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})
function resize() {
  chart && chart.resize()
}
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart && chart.dispose()
})
</script>

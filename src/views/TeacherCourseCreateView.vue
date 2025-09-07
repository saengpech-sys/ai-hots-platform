<template>
  <div class="bg-slate-50 min-h-screen p-8">
    <div class="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
      <h1 class="text-3xl font-bold text-slate-800 mb-6">สร้างรายวิชาใหม่</h1>
      <div class="space-y-4">
        <input v-model="course.title" placeholder="ชื่อรายวิชา" class="w-full input-style" />
        <textarea
          v-model="course.description"
          placeholder="คำอธิบายรายวิชา"
          class="w-full input-style"
          rows="3"
        ></textarea>
        <input
          v-model="course.subject_area"
          placeholder="หมวดหมู่วิชา (เช่น สังคมศึกษา)"
          class="w-full input-style"
        />
        <input
          v-model="course.main_topic"
          placeholder="หัวข้อหลักของวิชา"
          class="w-full input-style"
        />
        <textarea
          v-model="course.prerequisite_knowledge"
          placeholder="ความรู้พื้นฐานที่นักเรียนควรมี"
          class="w-full input-style"
          rows="2"
        ></textarea>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-slate-600 mb-1">กลยุทธ์เลือกทักษะ</label>
            <select v-model="course.skill_strategy" class="w-full input-style">
              <option value="weakest">weakest (ค่าเริ่มต้น)</option>
              <option value="random">random</option>
            </select>
          </div>
          <div class="flex items-center gap-2 mt-2 md:mt-6">
            <input id="enableRandomBtn" type="checkbox" v-model="course.enable_random_button" />
            <label for="enableRandomBtn" class="text-sm text-slate-700"
              >แสดงปุ่ม “สุ่มสถานการณ์ใหม่”</label
            >
          </div>
        </div>
        <div>
          <label class="block text-sm text-slate-600 mb-1">ทักษะที่อนุญาต (เลือกคอมม่าแยก)</label>
          <input
            v-model="targetSkillsText"
            placeholder="การวิเคราะห์ (Analyzing), การประเมินค่า (Evaluating), การสร้างสรรค์ (Creating)"
            class="w-full input-style"
          />
          <p class="text-xs text-slate-500 mt-1">ปล่อยว่าง = อนุญาตทุกทักษะ</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-slate-600 mb-1">มาตรฐานการเรียนรู้</label>
            <textarea
              v-model="standardsText"
              rows="4"
              class="w-full input-style"
              placeholder="พิมพ์ทีละบรรทัด หรือคั่นด้วยคอมม่า"
            ></textarea>
            <p class="text-xs text-slate-500 mt-1">จะถูกบันทึกเป็นรายการ Array ในรายวิชา</p>
          </div>
          <div>
            <label class="block text-sm text-slate-600 mb-1">ตัวชี้วัด</label>
            <textarea
              v-model="indicatorsText"
              rows="4"
              class="w-full input-style"
              placeholder="พิมพ์ทีละบรรทัด หรือคั่นด้วยคอมม่า"
            ></textarea>
            <p class="text-xs text-slate-500 mt-1">จะถูกบันทึกเป็นรายการ Array ในรายวิชา</p>
          </div>
        </div>
        <!-- Course policy -->
        <div class="p-4 rounded-xl border bg-slate-50">
          <div class="font-medium text-slate-800 mb-2">นโยบายความซื่อสัตย์ (ตัวเลือก)</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="course.block_paste" />
              <span class="text-sm text-slate-700">บล็อกการวาง (Paste) ในหน้าทำภารกิจ</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="course.require_stepwise" />
              <span class="text-sm text-slate-700">แนะนำให้ตอบแบบเป็นขั้นตอน</span>
            </label>
            <div>
              <label class="block text-sm text-slate-600 mb-1">เวลาขั้นต่ำก่อนส่ง (วินาที)</label>
              <input
                type="number"
                min="0"
                class="w-full input-style"
                v-model.number="course.min_time_sec"
              />
              <p class="text-xs text-slate-500 mt-1">ปล่อยว่างหรือ 0 = ไม่บังคับ</p>
            </div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">ความยาวขั้นต่ำ (ตัวอักษร)</label>
              <input
                type="number"
                min="0"
                class="w-full input-style"
                v-model.number="course.min_length_chars"
              />
              <p class="text-xs text-slate-500 mt-1">ปล่อยว่างหรือ 0 = ไม่บังคับ</p>
            </div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">สัดส่วนการพิมพ์ขั้นต่ำ (0–1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                class="w-full input-style"
                v-model.number="course.min_typing_ratio"
              />
              <p class="text-xs text-slate-500 mt-1">เช่น 0.6 หมายถึง อย่างน้อย 60% ต้องพิมพ์เอง</p>
            </div>
          </div>
        </div>
        <button
          @click="handleCreateCourse"
          class="w-full px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"
        >
          สร้างรายวิชา
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createCourse } from '@/services/firestoreService'
import { toast } from '@/utils/toast'

const router = useRouter()
const course = reactive({
  title: '',
  description: '',
  subject_area: '',
  main_topic: '',
  prerequisite_knowledge: '',
  skill_strategy: 'weakest',
  enable_random_button: true,
  block_paste: true,
  require_stepwise: false,
  min_time_sec: 0,
  min_length_chars: 0,
  min_typing_ratio: 0,
})
const targetSkillsText = ref('')
const standardsText = ref('')
const indicatorsText = ref('')

const handleCreateCourse = async () => {
  if (!course.title || !course.subject_area) {
    toast.warning('กรุณากรอกชื่อและหมวดหมู่วิชา')
    return
  }
  try {
    const payload = { ...course }
    const parsed = targetSkillsText.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parsed.length) payload.target_skills = parsed
    const toArray = (txt) =>
      txt
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean)
    const standardsArr = toArray(standardsText.value)
    const indicatorsArr = toArray(indicatorsText.value)
    if (standardsArr.length) payload.standards = standardsArr
    if (indicatorsArr.length) payload.indicators = indicatorsArr
    await createCourse(payload)
    toast.success('สร้างรายวิชาสำเร็จ')
    router.push('/teacher/my-courses')
  } catch (error) {
    console.error('Error creating course: ', error)
    toast.error('เกิดข้อผิดพลาดในการสร้างรายวิชา')
  }
}
</script>

<style scoped></style>

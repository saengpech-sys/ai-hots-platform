<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
    <div class="absolute inset-0 bg-slate-900/50" @click="emit('close')" />
    <div class="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-xl shadow-xl flex flex-col">
      <header class="p-4 border-b flex items-start gap-3">
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-slate-800">นโยบายความเป็นส่วนตัว & ความยินยอม</h2>
          <p class="text-xs text-slate-500 mt-0.5">อัปเดตล่าสุด: {{ lastUpdated }}</p>
        </div>
        <button @click="emit('close')" class="text-slate-500 hover:text-slate-700">✕</button>
      </header>
      <div class="overflow-y-auto p-4 space-y-4 text-sm leading-relaxed">
        <section>
          <h3 class="font-semibold mb-1">วัตถุประสงค์หลัก</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li>จัดการการเรียนรู้และประเมินผล</li>
            <li>เสริมแรงผ่านระบบ Gamification (XP / Level / Leaderboard)</li>
            <li>ปรับปรุงคุณภาพภารกิจด้วย AI (OpenAI API)</li>
            <li>วิเคราะห์เชิงสถิติเพื่อพัฒนาการเรียนการสอน</li>
          </ul>
        </section>
        <section>
          <h3 class="font-semibold mb-1">หมวดข้อมูลส่วนบุคคลที่เก็บ</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li v-for="c in categories" :key="c">{{ c }}</li>
          </ul>
        </section>
        <section>
          <h3 class="font-semibold mb-1">การประมวลผลด้วย AI</h3>
          <p>
            ระบบจะส่งข้อความ prompt/คำตอบบางส่วนไปยังผู้ให้บริการ OpenAI ต่างประเทศ
            โดยมีการตัดข้อมูลระบุตัวตนหลักออกตามสมควร เพื่อสร้างสถานการณ์และให้คำแนะนำการประเมินผล
          </p>
        </section>
        <section>
          <h3 class="font-semibold mb-1">สิทธิของท่าน</h3>
          <ul class="list-disc pl-5 space-y-1">
            <li>ขอเข้าถึง / ขอสำเนาข้อมูล</li>
            <li>ขอแก้ไข / ลบ หรือทำให้เป็นนิรนาม</li>
            <li>เพิกถอนความยินยอม (ไม่กระทบการประมวลผลที่ผ่านมา)</li>
            <li>ปิดการใช้ Gamification</li>
          </ul>
        </section>
        <section class="border rounded p-3 bg-slate-50">
          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" v-model="accept" />
            <span>
              ข้าพเจ้าได้อ่านและเข้าใจนโยบาย และ
              <b>ให้ความยินยอม</b> ในการประมวลผลข้อมูลส่วนบุคคลตามที่ระบุ
            </span>
          </label>
          <label class="flex items-start gap-2 text-xs mt-3">
            <input type="checkbox" v-model="allowGamificationLocal" />
            <span>เปิดใช้ระบบ Gamification (ยกเลิกภายหลังได้)</span>
          </label>
        </section>
      </div>
      <footer class="p-4 border-t flex items-center gap-3">
        <button
          class="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
          :disabled="!accept || loading"
          @click="onConfirm"
        >
          บันทึก
        </button>
        <button @click="emit('close')" class="px-4 py-2 rounded-md border" :disabled="loading">
          ปิด
        </button>
        <div v-if="error" class="ml-auto text-xs text-rose-600">{{ error }}</div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import {
  CURRENT_CONSENT_VERSION,
  PRIVACY_NOTICE_LAST_UPDATED,
  PERSONAL_DATA_CATEGORIES,
} from '@/config/privacy'
import { updateStudentConsent } from '@/services/firestoreService'
import { getAuthInstance } from '@/firebase/config'

const props = defineProps({
  open: { type: Boolean, default: false },
  currentVersion: { type: String, default: null },
  allowGamification: { type: Boolean, default: true },
})
const emit = defineEmits(['close', 'saved'])

const accept = ref(false)
const allowGamificationLocal = ref(true)
const loading = ref(false)
const error = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) {
      accept.value = false
      allowGamificationLocal.value = props.allowGamification
      error.value = ''
    }
  },
)

const lastUpdated = PRIVACY_NOTICE_LAST_UPDATED
const categories = PERSONAL_DATA_CATEGORIES

async function onConfirm() {
  const auth = await getAuthInstance()
  if (!auth.currentUser) {
    error.value = 'ต้องล็อกอิน'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await updateStudentConsent(auth.currentUser.uid, {
      version: CURRENT_CONSENT_VERSION,
      allowGamification: allowGamificationLocal.value,
    })
    emit('saved', {
      version: CURRENT_CONSENT_VERSION,
      allowGamification: allowGamificationLocal.value,
    })
    emit('close')
  } catch (e) {
    error.value = String(e?.message || e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>

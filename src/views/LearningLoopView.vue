<template>
  <div ref="rootRef" class="bg-slate-50 min-h-screen no-select protect-root">
    <div v-if="overlay" class="protect-overlay">
      <div>
        <div class="text-xl font-semibold mb-1">ปกป้องเนื้อหา</div>
        <div class="text-slate-700">การจับภาพหน้าจอ/การพิมพ์ถูกปิดใช้งานบนหน้านี้</div>
      </div>
    </div>
    <div class="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <!-- Header -->
      <header class="text-center mb-8">
        <h1 class="text-3xl sm:text-4xl font-bold text-slate-800">ภารกิจฝึกการคิด</h1>
        <p class="text-slate-500 mt-2">ฝึกฝนทักษะการคิดขั้นสูงผ่านสถานการณ์จำลอง</p>
      </header>

      <!-- Loading View -->
      <div
        v-if="store.status === 'generating' || store.status === 'evaluating'"
        class="text-center p-10 bg-white rounded-lg shadow-md"
      >
        <div class="flex justify-center items-center mb-4">
          <svg
            class="animate-spin h-8 w-8 text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
        <p class="text-lg font-semibold text-indigo-600">AI กำลังทำงานอย่างเต็มที่...</p>
        <p class="text-slate-500">กรุณารอสักครู่ ระบบกำลังสร้างสรรค์ภารกิจสำหรับคุณ</p>
      </div>

      <!-- Scenario & Task View -->
      <div
        v-if="store.status === 'readyForTask' && store.currentScenario && store.currentAssessment"
      >
        <div
          v-if="store.currentScenario?.course_settings?.enable_random_button !== false"
          class="flex justify-end mb-3"
        >
          <button
            @click="startNewScenario"
            class="px-4 py-2 text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200"
          >
            สุ่มสถานการณ์ใหม่
          </button>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-2xl shadow-lg mb-6 border border-slate-200">
          <span
            class="inline-block bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1 rounded-full mb-4"
            >สถานการณ์</span
          >
          <div v-if="store.currentScenario?.skill_targeted" class="mb-2">
            <span class="text-sm text-slate-500">ทักษะที่วัด:</span>
            <span
              class="ml-2 inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700"
            >
              {{ store.currentScenario.skill_targeted }}
            </span>
          </div>
          <h2 class="text-2xl font-semibold text-slate-900 mb-3">
            {{ store.currentScenario.scenario_title }}
          </h2>
          <div
            class="prose prose-lg max-w-none text-slate-600"
            v-html="store.currentScenario.scenario_html"
          ></div>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200">
          <h3 class="text-xl font-semibold text-slate-900 mb-4">📝 ภารกิจของคุณ:</h3>
          <p class="mb-4 text-slate-600 text-lg">{{ store.currentAssessment.assessment_task }}</p>
          <div v-if="policy.require_stepwise" class="mb-3 text-sm text-slate-600">
            เคล็ดลับ: เขียนคำตอบเป็นขั้นตอน เช่น 1) วิเคราะห์โจทย์ 2) ระบุหลักฐาน 3) ให้เหตุผล 4)
            สรุปผล
          </div>
          <textarea
            v-model="studentAnswer"
            rows="12"
            class="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-lg allow-select"
            @keydown="onKeydownAnswer"
            @input="onInputAnswer"
            @paste="onPasteAnswer"
            @drop.prevent
            @dragover.prevent
            placeholder="เขียนคำตอบและแสดงเหตุผลของคุณที่นี่..."
          ></textarea>
          <!-- Visible, real-time submission conditions -->
          <div class="mt-4 p-3 rounded-lg border bg-slate-50 text-sm">
            <div class="font-medium text-slate-800 mb-2">เงื่อนไขก่อนส่ง</div>
            <ul class="space-y-1">
              <li v-if="policy.min_length_chars > 0" class="flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white"
                  :class="passLen ? 'bg-emerald-500' : 'bg-slate-400'"
                >
                  <svg
                    v-if="passLen"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path d="M9 16.125 4.875 12l-1.5 1.5L9 19.125l12-12-1.5-1.5L9 16.125Z" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      d="M12 22.5a10.5 10.5 0 1 1 0-21 10.5 10.5 0 0 1 0 21Zm0-1.5a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-.75-5.25h1.5v1.5h-1.5v-1.5Zm0-9h1.5v7.5h-1.5V6.75Z"
                    />
                  </svg>
                </span>
                <span class="text-slate-700">
                  ความยาวขั้นต่ำ {{ policy.min_length_chars }} ตัวอักษร
                  <span class="ml-1 text-slate-500">(ปัจจุบัน {{ answerLen }})</span>
                  <span v-if="!passLen" class="ml-1 text-rose-600"
                    >ขาดอีก {{ remainLen }} ตัวอักษร</span
                  >
                </span>
              </li>
              <li v-if="policy.min_time_sec > 0" class="flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white"
                  :class="passTime ? 'bg-emerald-500' : 'bg-slate-400'"
                >
                  <svg
                    v-if="passTime"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      d="M12 22.5a10.5 10.5 0 1 1 0-21 10.5 10.5 0 0 1 0 21ZM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm.75-9.75V6.75h-1.5v5.25H16.5v-1.5h-3.75Z"
                    />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      d="M12 22.5a10.5 10.5 0 1 1 0-21 10.5 10.5 0 0 1 0 21Zm0-1.5a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-.75-5.25h1.5v1.5h-1.5v-1.5Zm0-9h1.5v7.5h-1.5V6.75Z"
                    />
                  </svg>
                </span>
                <span class="text-slate-700">
                  เวลาขั้นต่ำ {{ policy.min_time_sec }} วินาที
                  <span class="ml-1 text-slate-500">(ผ่านไปแล้ว {{ elapsedSec }})</span>
                  <span v-if="!passTime" class="ml-1 text-rose-600"
                    >รออีก ~{{ remainTime }} วินาที</span
                  >
                  <button
                    v-if="timerStalled && !passTime"
                    @click="unlockTimer()"
                    class="ml-2 px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300"
                  >
                    ตัวจับเวลาค้าง: ปลดล็อก
                  </button>
                </span>
              </li>
              <li v-if="policy.min_typing_ratio > 0" class="flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white"
                  :class="passTyping ? 'bg-emerald-500' : 'bg-slate-400'"
                >
                  <svg
                    v-if="passTyping"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      d="M20.25 4.5H3.75A1.5 1.5 0 0 0 2.25 6v12A1.5 1.5 0 0 0 3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5ZM6 9.75h5.25v1.5H6v-1.5Zm0 3H18v1.5H6v-1.5Z"
                    />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      d="M12 22.5a10.5 10.5 0 1 1 0-21 10.5 10.5 0 0 1 0 21Zm0-1.5a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-.75-5.25h1.5v1.5h-1.5v-1.5Zm0-9h1.5v7.5h-1.5V6.75Z"
                    />
                  </svg>
                </span>
                <span class="text-slate-700">
                  พิมพ์เอง ≥ {{ Math.round(policy.min_typing_ratio * 100) }}%
                  <span class="ml-1 text-slate-500">(ปัจจุบัน {{ inputRatioPct }})</span>
                  <span v-if="!passTyping" class="ml-1 text-rose-600">พิมพ์เพิ่มอีกเล็กน้อย</span>
                </span>
              </li>
              <li v-if="policy.block_paste" class="flex items-center gap-2 text-slate-600">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white"
                  >i</span
                >
                <span>ผู้สอนได้เปิด “บล็อกการวาง (Paste)”</span>
              </li>
            </ul>
          </div>
          <button
            :disabled="!canSubmit"
            @click="handleSubmit"
            class="mt-4 w-full sm:w-auto px-8 py-3 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-transform"
            :class="
              canSubmit
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-300 text-slate-600 cursor-not-allowed'
            "
          >
            {{ canSubmit ? 'ส่งคำตอบ' : 'กรุณาทำตามเงื่อนไขก่อนส่ง' }}
          </button>
        </div>
      </div>

      <!-- Feedback View -->
      <div v-if="store.status === 'showingFeedback' && store.currentFeedback">
        <div class="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200">
          <h2 class="text-2xl font-semibold text-slate-900 mb-4">ผลการประเมินและ Feedback 💡</h2>
          <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <p class="font-semibold text-blue-800">สรุปจาก AI Coach:</p>
            <p class="text-blue-700">{{ store.currentFeedback.summary_feedback }}</p>
            <div v-if="store.currentFeedback.common_error_tag" class="mt-2 text-xs text-blue-700">
              แท็กข้อผิดพลาดที่พบบ่อย:
              <span class="bg-white/60 px-1 rounded font-medium text-slate-800">{{
                errorTagLabelTh(store.currentFeedback.common_error_tag)
              }}</span>
              <span class="ml-1 text-slate-600"
                >— {{ errorTagDescTh(store.currentFeedback.common_error_tag) }}</span
              >
            </div>
          </div>
          <!-- Scenario meta badges -->
          <div class="mb-4 flex flex-wrap gap-2">
            <span
              v-if="store.currentMission?.difficulty"
              class="px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-700"
              >ระดับความยาก: {{ store.currentMission.difficulty }}</span
            >
            <span
              v-if="store.currentMission?.skill_targeted || store.currentScenario?.skill_targeted"
              class="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700"
              >ทักษะ:
              {{
                store.currentMission?.skill_targeted || store.currentScenario?.skill_targeted
              }}</span
            >
          </div>
          <div class="mb-6">
            <h3 class="font-semibold text-slate-800 mb-3 text-lg">คะแนนตามเกณฑ์การประเมิน:</h3>
            <ul class="space-y-2">
              <li
                v-for="(score, criteria) in store.currentFeedback.rubric_scores"
                :key="criteria"
                class="flex items-center"
              >
                <span class="font-medium text-slate-700 flex-1">{{ criteria }}:</span>
                <span
                  class="font-semibold px-3 py-1 text-sm rounded-full"
                  :class="getScoreBadgeClass(score)"
                  >{{ score }}</span
                >
              </li>
            </ul>
          </div>

          <!-- Reflection & one-time revision -->
          <div class="mb-6">
            <h3 class="font-semibold text-slate-800 mb-2 text-lg">สะท้อนคิด (Reflection)</h3>
            <p class="text-slate-600 text-sm mb-2">
              โปรดตอบสั้นๆ:
              {{ metaPrompt || 'จากข้อเสนอแนะของ AI คุณจะปรับปรุงคำตอบตรงไหน เพราะอะไร?' }}
            </p>
            <textarea
              v-model="metaResponse"
              rows="4"
              class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
              placeholder="พิมพ์การสะท้อนคิดของคุณที่นี่..."
            ></textarea>
          </div>

          <div class="mb-6">
            <h3 class="font-semibold text-slate-800 mb-2 text-lg">
              ลองแก้ไขคำตอบอีกครั้ง (Revision) — ได้ 1 ครั้ง
            </h3>
            <textarea
              v-model="revisionText"
              rows="8"
              class="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out"
              placeholder="เขียนคำตอบฉบับแก้ไข โดยอิงจาก Feedback และรูบริก"
            ></textarea>
            <div class="text-xs text-slate-500 mt-1">
              ระบบจะบันทึกคะแนน/ปัจจัยพฤติกรรมและตรวจความคล้ายให้โดยอัตโนมัติ
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              @click="handleNext"
              class="w-full sm:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
            >
              เริ่มภารกิจถัดไป
            </button>
            <button
              v-if="!didRevise"
              :disabled="!revisionText.trim()"
              @click="handleRevise"
              class="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform"
            >
              ส่งฉบับแก้ไข (ครั้งเดียว)
            </button>
            <button
              v-if="store.currentScenario?.course_settings?.enable_random_button !== false"
              @click="startNewScenario"
              class="w-full sm:w-auto px-8 py-3 bg-amber-100 text-amber-800 font-semibold rounded-lg shadow-md hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 transition-transform transform hover:scale-105"
            >
              สุ่มสถานการณ์ใหม่
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLearningLoopStore } from '@/stores/learningLoopStore'
import { updateSubmission } from '@/services/firestoreService'
import { errorTagLabelTh, errorTagDescTh } from '@/utils/errorTags'
import { toast } from '@/utils/toast'
import { similarityCheck } from '@/services/aiService'

const store = useLearningLoopStore()
const route = useRoute()
const router = useRouter()
const studentAnswer = ref('')
const currentCourseId = ref('')
const metaResponse = ref('')
const didRevise = ref(false)
const revisionText = ref('')
const metaPrompt = ref('')
const metaPrompts = [
  'สิ่งที่คุณทำได้ดีในภารกิจนี้คืออะไร และจะนำไปต่อยอดอย่างไร?',
  'ถ้าย้อนกลับไปเริ่มใหม่ คุณจะปรับวิธีคิด/วิธีทำตรงไหน?',
  'หลักฐาน/เหตุผลไหนที่สนับสนุนข้อสรุปของคุณมากที่สุด? เพราะอะไร?',
  'ขั้นตอนใดที่ทำให้คุณติดขัด และคุณแก้ปัญหานั้นอย่างไร?',
]

const overlay = ref(false)
const rootRef = ref(null)
function flashOverlay(ms = 1800) {
  overlay.value = true
  setTimeout(() => (overlay.value = false), ms)
}

// Anti-copy: input telemetry
const typedKeys = ref(0)
const pastedChars = ref(0)
const blockedPasteAttempts = ref(0)
const suddenJump = ref(false)
// Speech-to-text heuristic counters
const speechBlocks = ref(0)
const speechChars = ref(0)
// Off-focus telemetry (mobile-friendly)
const blurCount = ref(0)
const blurMs = ref(0)
const blurMaxMs = ref(0)
const focusChanges = ref(0)
let blurStartedAt = null
let blurWarned = false
const blockPaste = computed(() => store.currentScenario?.course_settings?.block_paste === true)
const policy = computed(() => ({
  block_paste: store.currentScenario?.course_settings?.block_paste ?? true,
  min_time_sec: store.currentScenario?.course_settings?.min_time_sec ?? 0,
  min_length_chars: store.currentScenario?.course_settings?.min_length_chars ?? 0,
  min_typing_ratio: store.currentScenario?.course_settings?.min_typing_ratio ?? 0,
  require_stepwise: store.currentScenario?.course_settings?.require_stepwise ?? false,
  warn_offtab_sec: store.currentScenario?.course_settings?.warn_offtab_sec ?? 0,
  offtab_ms_threshold: store.currentScenario?.course_settings?.offtab_ms_threshold ?? 120000,
  offtab_count_threshold: store.currentScenario?.course_settings?.offtab_count_threshold ?? 3,
}))
const answerLen = computed(() => String(studentAnswer.value || '').length)
const elapsedSec = computed(() =>
  store.beginAt ? Math.max(0, Math.round((Date.now() - store.beginAt) / 1000)) : 0,
)
// Detect stalled timer (e.g., tab sleep or clock skew). If no increment for >10s while policy requires time.
const lastElapsed = ref(0)
const lastElapsedTs = ref(Date.now())
const timerStalled = ref(false)
const stallEvents = ref(0)
setInterval(() => {
  const e = elapsedSec.value
  if (e !== lastElapsed.value) {
    lastElapsed.value = e
    lastElapsedTs.value = Date.now()
    if (timerStalled.value) {
      // recover
      try {
        console.debug('timer.recovered', { at: Date.now(), elapsed: e })
      } catch {}
    }
    timerStalled.value = false
  } else {
    if (
      (policy.value.min_time_sec || 0) > 0 &&
      Date.now() - lastElapsedTs.value > 10000 &&
      e < (policy.value.min_time_sec || 0)
    ) {
      if (!timerStalled.value) {
        stallEvents.value += 1
        try {
          console.warn('timer.stalled', {
            at: Date.now(),
            elapsed: e,
            stallEvents: stallEvents.value,
          })
        } catch {}
      }
      timerStalled.value = true
    }
  }
}, 1500)
const inputRatio = computed(() => {
  const total = typedKeys.value + pastedChars.value
  return total > 0 ? typedKeys.value / total : 0
})
const inputRatioPct = computed(() => `${Math.round(inputRatio.value * 100)}%`)
const canSubmit = computed(() => {
  // base requirement: has some content
  if (!studentAnswer.value.trim()) return false
  if ((policy.value.min_length_chars || 0) > 0 && answerLen.value < policy.value.min_length_chars)
    return false
  if (
    (policy.value.min_time_sec || 0) > 0 &&
    elapsedSec.value < policy.value.min_time_sec &&
    !timerStalled.value
  )
    return false
  if ((policy.value.min_typing_ratio || 0) > 0 && inputRatio.value < policy.value.min_typing_ratio)
    return false
  return true
})
// UI helpers for checklist
const passLen = computed(() =>
  (policy.value.min_length_chars || 0) > 0
    ? answerLen.value >= policy.value.min_length_chars
    : true,
)
const remainLen = computed(() =>
  Math.max(0, (policy.value.min_length_chars || 0) - answerLen.value),
)
const passTime = computed(() =>
  (policy.value.min_time_sec || 0) > 0
    ? elapsedSec.value >= policy.value.min_time_sec || timerStalled.value
    : true,
)
const remainTime = computed(() => Math.max(0, (policy.value.min_time_sec || 0) - elapsedSec.value))
const passTyping = computed(() =>
  (policy.value.min_typing_ratio || 0) > 0
    ? inputRatio.value >= policy.value.min_typing_ratio
    : true,
)

// --- Voice / Mobile Input Heuristic ---
// ปัญหา: บนมือถือเมื่อใช้พิมพ์ด้วยเสียง (speech-to-text) จะไม่มี keydown event ทำให้ typedKeys ไม่เพิ่ม
// ส่งผลให้สัดส่วนการพิมพ์ (typing ratio) ต่ำผิดจริง และไม่ผ่านเงื่อนไข
// แนวทาง: ดัก @input แล้ววัดการเพิ่มความยาว (delta) หากไม่ใช่ paste และไม่ใช่การกระโดดใหญ่ผิดปกติ ให้ถือเป็นการ "พิมพ์" (typed)
// ข้อจำกัด: การวาง (paste) ผ่าน context menu ระบบ (โดยไม่ได้ trigger onPaste) อาจถูกนับเป็น typing หากเป็นชิ้นเล็ก ซึ่งยอมรับได้เชิง UX
const lastValueLen = ref(0)
let recentlyPasted = false

function markRecentlyPasted() {
  recentlyPasted = true
  setTimeout(() => {
    recentlyPasted = false
  }, 120) // หน่วงสั้น ๆ ให้ onInput รอบเดียวกันไม่ถูกนับซ้ำ
}

function onInputAnswer() {
  try {
    const cur = String(studentAnswer.value || '')
    if (lastValueLen.value === 0 && cur.length > 0) {
      // first load / initial set
      lastValueLen.value = cur.length
      return
    }
    if (cur.length > lastValueLen.value) {
      const delta = cur.length - lastValueLen.value
      // หากเพิ่ง paste จะไม่เพิ่ม typedKeys (onPaste จะจัดการ pastedChars อยู่แล้ว)
      if (!recentlyPasted) {
        // ถ้าเพิ่มทีเดียวใหญ่มาก (เช่น > 800 ตัว) ถือว่าน่าจะเป็น paste ซ่อน → นับเป็น pastedChars
        if (delta > 800) {
          pastedChars.value += delta
        } else if (delta > 0) {
          // Heuristic: voice dictation มักเพิ่มทีละ block 5–40 ตัวอักษรเร็วๆ (ไม่มี keydown)
          if (delta >= 5 && delta <= 120) {
            speechBlocks.value += 1
            speechChars.value += delta
          }
          typedKeys.value += delta
        }
      }
    }
    lastValueLen.value = cur.length
  } catch {}
}

function onKeydownAnswer(e) {
  // Count printable characters (ignore control/navigation keys)
  const k = e.key
  if (!k) return
  // Ignore combos
  if (e.ctrlKey || e.metaKey || e.altKey) return
  // Count typical printable keys (1-char and not whitespace-only unless space)
  if (k.length === 1) {
    typedKeys.value += 1
  }
}
async function onPasteAnswer(e) {
  if (blockPaste.value) {
    e.preventDefault()
    toast.info('ครูปิดการวาง (Paste) ในแบบฝึกข้อนี้')
    flashOverlay(900)
    blockedPasteAttempts.value += 1
    return
  }
  try {
    const txt = (e.clipboardData || window.clipboardData)?.getData?.('text') || ''
    pastedChars.value += txt.length
    markRecentlyPasted()
    const beforeLen = String(studentAnswer.value || '').length
    if (beforeLen < 20 && txt.length >= 200) suddenJump.value = true
  } catch {}
}

onMounted(() => {
  if (store.status !== 'idle') return
  const courseId = route.query.courseId
  if (courseId) {
    currentCourseId.value = String(courseId)
    const forceNew = route.query.forceNew === '1'
    store.startLoopForCourse(currentCourseId.value, { forceNew })
    if (forceNew) {
      // clean query flag so refresh doesn't always force
      router.replace({ name: 'learning-loop', query: { courseId: currentCourseId.value } })
    }
  } else {
    // Require course context: redirect to My Courses to choose one
    router.replace('/my-courses')
  }
  // Prevent copying text on this page (allow inside inputs/textarea)
  const onCopy = (e) => {
    const el = e.target?.closest?.('input, textarea, [contenteditable="true"], .allow-copy')
    if (!el) e.preventDefault()
  }
  const onSelectStart = (e) => {
    const el = e.target?.closest?.('input, textarea, [contenteditable="true"], .allow-copy')
    if (!el) e.preventDefault()
  }
  const onContextMenu = (e) => {
    // Disable right-click context menu outside inputs/textarea
    const el = e.target?.closest?.('input, textarea, [contenteditable="true"], .allow-copy')
    if (!el) e.preventDefault()
  }
  const onKeyDown = async (e) => {
    // Block PrintScreen and printing shortcuts
    const key = String(e.key || '').toLowerCase()
    if (key === 'printscreen') {
      e.preventDefault?.()
      try {
        await navigator.clipboard?.writeText?.('Screenshots are disabled on this page')
      } catch {}
      flashOverlay()
    }
    if ((e.ctrlKey || e.metaKey) && key === 'p') {
      e.preventDefault()
      flashOverlay(1200)
    }
  }
  document.addEventListener('copy', onCopy, true)
  document.addEventListener('cut', onCopy, true)
  document.addEventListener('selectstart', onSelectStart, true)
  document.addEventListener('contextmenu', onContextMenu, true)
  window.addEventListener('keydown', onKeyDown, true)
  // initialize baseline length for voice typing heuristic
  lastValueLen.value = String(studentAnswer.value || '').length
  // Mobile-friendly focus tracking using visibilitychange + pagehide
  const onVisibility = () => {
    try {
      const hidden = document.visibilityState === 'hidden'
      if (hidden) {
        blurStartedAt = Date.now()
        blurCount.value += 1
      } else {
        if (blurStartedAt) {
          const delta = Math.max(0, Date.now() - blurStartedAt)
          blurMs.value += delta
          blurMaxMs.value = Math.max(blurMaxMs.value, delta)
          blurStartedAt = null
        }
        focusChanges.value += 1
        // Warn if a single off-tab exceeds policy.warn_offtab_sec (non-blocking)
        if (!blurWarned && (policy.value.warn_offtab_sec || 0) > 0) {
          if (blurMaxMs.value >= (policy.value.warn_offtab_sec || 0) * 1000) {
            toast.warning('กลับมาที่หน้าทำภารกิจเพื่อโฟกัสงานนะครับ/ค่ะ')
            blurWarned = true
          }
        }
      }
    } catch {}
  }
  const onPageHide = () => {
    try {
      if (blurStartedAt) {
        const delta = Math.max(0, Date.now() - blurStartedAt)
        blurMs.value += delta
        blurMaxMs.value = Math.max(blurMaxMs.value, delta)
        blurStartedAt = null
      }
      // Count as a blur event if not already counted
      blurCount.value += 1
    } catch {}
  }
  const onWindowBlur = () => {
    // Fallback for desktop browsers; guard to avoid double-counting with visibilitychange
    try {
      if (document.visibilityState !== 'hidden' && !blurStartedAt) {
        blurStartedAt = Date.now()
        blurCount.value += 1
      }
    } catch {}
  }
  const onWindowFocus = () => {
    try {
      if (blurStartedAt) {
        const delta = Math.max(0, Date.now() - blurStartedAt)
        blurMs.value += delta
        blurMaxMs.value = Math.max(blurMaxMs.value, delta)
        blurStartedAt = null
      }
      focusChanges.value += 1
      if (!blurWarned && (policy.value.warn_offtab_sec || 0) > 0) {
        if (blurMaxMs.value >= (policy.value.warn_offtab_sec || 0) * 1000) {
          toast.warning('กลับมาที่หน้าทำภารกิจเพื่อโฟกัสงานนะครับ/ค่ะ')
          blurWarned = true
        }
      }
    } catch {}
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('focus', onWindowFocus)
  onBeforeUnmount(() => {
    document.removeEventListener('copy', onCopy, true)
    document.removeEventListener('cut', onCopy, true)
    document.removeEventListener('selectstart', onSelectStart, true)
    document.removeEventListener('contextmenu', onContextMenu, true)
    window.removeEventListener('keydown', onKeyDown, true)
    // finalize and remove focus listeners
    try {
      if (blurStartedAt) {
        blurMs.value += Math.max(0, Date.now() - blurStartedAt)
        blurStartedAt = null
      }
    } catch {}
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('blur', onWindowBlur)
    window.removeEventListener('focus', onWindowFocus)
  })
})

// Start timer when assessment is ready
watch(
  () => store.status,
  async (val) => {
    if (val === 'readyForTask') {
      store.beginAt = Date.now()
    }
    if (val === 'showingFeedback') {
      metaPrompt.value = metaPrompts[Math.floor(Math.random() * metaPrompts.length)]
      try {
        const sid = store.currentFeedback?._submissionId
        if (sid) {
          const seconds = store.beginAt
            ? Math.max(0, Math.round((Date.now() - store.beginAt) / 1000))
            : null
          const totalInput = typedKeys.value + pastedChars.value
          const ratio = totalInput > 0 ? typedKeys.value / totalInput : null
          const offtabFlag =
            (blurMs.value || 0) >= (policy.value.offtab_ms_threshold || 0) ||
            (blurCount.value || 0) >= (policy.value.offtab_count_threshold || 0)
          const offtab = {
            count: blurCount.value,
            ms: blurMs.value,
            max_ms: blurMaxMs.value,
            flag: offtabFlag,
            thresholds: {
              ms: policy.value.offtab_ms_threshold || 0,
              count: policy.value.offtab_count_threshold || 0,
            },
          }
          await updateSubmission(sid, {
            meta_typing_keystrokes: typedKeys.value,
            meta_paste_chars: pastedChars.value,
            meta_speech_blocks: speechBlocks.value,
            meta_speech_chars: speechChars.value,
            meta_input_ratio: ratio,
            meta_time_spent_sec: seconds,
            meta_paste_blocked_attempts: blockedPasteAttempts.value,
            meta_sudden_jump: suddenJump.value,
            meta_blur_count: blurCount.value,
            meta_blur_ms: blurMs.value,
            meta_blur_max_ms: blurMaxMs.value,
            meta_focus_changes: focusChanges.value,
            meta_offtab: offtab,
            meta_timer_stall_events: stallEvents.value,
            ...(timerStalled.value ? { meta_timer_stalled_final: true } : {}),
            ...(blurWarned ? { meta_offtab_warn: true } : {}),
          })
          // Non-blocking server heuristic + weighted score
          try {
            const { analyzeHeuristic } = await import('@/services/aiService')
            const risk = await analyzeHeuristic({
              answer: String(studentAnswer.value || ''),
              telemetry: { typed: typedKeys.value, pasted: pastedChars.value, time_sec: seconds },
            })
            const scores = store.currentFeedback?.rubric_scores || {}
            const labelWeight = { ดีเยี่ยม: 100, ดี: 75, พอใช้: 50, ต้องปรับปรุง: 25 }
            const vals = Object.values(scores).map((v) => labelWeight[v] || 0)
            const baseScore = vals.length
              ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
              : null
            let factor = 1
            if (seconds != null && baseScore != null) {
              const len = String(studentAnswer.value || '').length
              if (len > 400 && ratio !== null && ratio < 0.25 && seconds < 90) factor = 0.75
              else if (len > 250 && ratio !== null && ratio < 0.35 && seconds < 60) factor = 0.85
            }
            const weighted = baseScore != null ? Math.round(baseScore * factor) : null
            const updates = {
              ...(risk ? { meta_llm_risk: risk } : {}),
              ...(baseScore != null
                ? { meta_weighted_score: weighted, meta_behavior_factor: factor }
                : {}),
            }
            // Similarity API (best-effort)
            try {
              const sim = await similarityCheck({
                answer: String(studentAnswer.value || ''),
                courseId: store.currentScenario?.courseId_ref || store.currentMission?.courseId_ref,
                scenarioId: store.currentScenario?._id,
              })
              if (sim) updates.meta_similarity = sim
            } catch (_e) {}

            // Compute confidence score (0..1) for research
            try {
              const simMax =
                updates?.meta_similarity?.max ?? store.currentFeedback?.meta_similarity?.max ?? null
              const llmFlag = (risk?.flag || '').toString()
              let conf = 0.5
              // typing ratio contribution
              const trMin = policy.value.min_typing_ratio || 0
              const tr = ratio != null ? ratio : 0
              const trNorm = trMin > 0 ? Math.min(1, tr / trMin) : tr
              conf += 0.25 * Math.max(0, Math.min(1, trNorm))
              // time contribution
              const tMin = policy.value.min_time_sec || 0
              const tNorm = tMin > 0 && seconds != null ? Math.min(1, seconds / tMin) : 1
              conf += 0.25 * Math.max(0, Math.min(1, tNorm))
              // penalties
              if (simMax != null) {
                if (simMax >= 0.85) conf -= 0.3
                else if (simMax >= 0.7) conf -= 0.15
              }
              if (llmFlag === 'high') conf -= 0.25
              else if (llmFlag === 'medium') conf -= 0.15
              if (suddenJump.value) conf -= 0.15
              if (offtabFlag) conf -= 0.15
              conf = Math.max(0, Math.min(1, conf))
              updates.meta_confidence = {
                score: conf,
                factors: {
                  typing_ratio: ratio,
                  time_sec: seconds,
                  min_typing_ratio: trMin,
                  min_time_sec: tMin,
                  similarity_max: simMax,
                  llm_flag: llmFlag,
                  sudden_jump: !!suddenJump.value,
                  offtab_flag: offtabFlag,
                },
              }
            } catch (_) {}
            if (Object.keys(updates).length) await updateSubmission(sid, updates)
          } catch (_) {
            // ignore
          }
        }
      } catch {}
    }
  },
  { immediate: true },
)

function handleSubmit() {
  if (!canSubmit.value) {
    toast.warning('ยังไม่ครบเงื่อนไขการส่ง — ตรวจสอบรายการด้านล่าง')
    return
  }
  store.submitAndEvaluate(studentAnswer.value)
}

async function saveMeta() {
  try {
    const sid = store.currentFeedback?._submissionId
    if (sid && metaPrompt.value && metaResponse.value) {
      await updateSubmission(sid, {
        meta_prompt: metaPrompt.value,
        meta_response: metaResponse.value,
      })
    }
  } catch {}
}

async function handleNext() {
  studentAnswer.value = ''
  store.beginAt = null
  typedKeys.value = 0
  pastedChars.value = 0
  blockedPasteAttempts.value = 0
  suddenJump.value = false
  speechBlocks.value = 0
  speechChars.value = 0
  blurCount.value = 0
  blurMs.value = 0
  blurMaxMs.value = 0
  focusChanges.value = 0
  blurWarned = false
  await saveMeta()
  metaResponse.value = ''
  didRevise.value = false
  revisionText.value = ''
  if (currentCourseId.value) {
    store.startLoopForCourse(currentCourseId.value)
  } else {
    router.replace('/my-courses')
  }
}

function startNewScenario() {
  if (currentCourseId.value) {
    store.beginAt = null
    typedKeys.value = 0
    pastedChars.value = 0
    blockedPasteAttempts.value = 0
    suddenJump.value = false
    speechBlocks.value = 0
    speechChars.value = 0
    store.startLoopForCourse(currentCourseId.value, { forceNew: true })
  } else {
    router.replace('/my-courses')
  }
}

function unlockTimer() {
  timerStalled.value = false
  lastElapsedTs.value = Date.now() - (policy.value.min_time_sec * 1000 || 0)
  try {
    console.info('timer.unlock', { at: Date.now() })
  } catch {}
}

function getScoreBadgeClass(score) {
  const scoreClasses = {
    ดีเยี่ยม: 'bg-green-100 text-green-800',
    ดี: 'bg-blue-100 text-blue-800',
    พอใช้: 'bg-yellow-100 text-yellow-800',
    ต้องปรับปรุง: 'bg-red-100 text-red-800',
  }
  return scoreClasses[score] || 'bg-slate-100 text-slate-800'
}

async function handleRevise() {
  try {
    if (didRevise.value) return
    if (!revisionText.value.trim()) {
      toast.warning('กรุณาเขียนฉบับแก้ไขก่อนส่ง')
      return
    }
    // Save reflection meta first (non-blocking await)
    await saveMeta()
    // Submit revision; this will not grant XP or complete mission
    await store.submitAndEvaluate(revisionText.value, { isRevision: true })
    didRevise.value = true
    toast.success('ส่งฉบับแก้ไขเรียบร้อย — ตรวจสอบ Feedback ใหม่ด้านบน')
  } catch (e) {
    toast.error(`ส่งฉบับแก้ไขไม่สำเร็จ: ${e?.message || 'กรุณาลองใหม่'}`)
  }
}
</script>

<style scoped>
.no-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.allow-select,
input,
textarea,
[contenteditable='true'] {
  -webkit-user-select: text;
  user-select: text;
}
.protect-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  text-align: center;
  pointer-events: none;
}
@media print {
  .protect-root {
    display: none !important;
  }
}
</style>

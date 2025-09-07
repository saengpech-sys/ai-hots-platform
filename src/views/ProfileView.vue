<template>
  <div class="bg-slate-50 min-h-screen p-8">
    <div class="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
      <h1 class="text-3xl font-bold text-slate-800 mb-6">โปรไฟล์ของฉัน</h1>

      <div v-if="profile" class="space-y-6">
        <!-- Avatar upload -->
        <div class="flex items-center gap-4">
          <img
            :src="avatarDisplayUrl || placeholder"
            alt="avatar"
            class="h-16 w-16 rounded-full object-cover bg-slate-200"
          />
          <div class="min-w-[220px]">
            <input type="file" accept="image/*" @change="onAvatarChange" />
            <div class="text-xs text-slate-500 mt-1">ขนาดแนะนำ ≥ 256x256 พิกเซล</div>
            <!-- Smooth progress bar -->
            <div v-if="uploading" class="mt-2 w-full">
              <div class="h-1.5 bg-slate-200 rounded">
                <div
                  class="h-1.5 bg-indigo-500 rounded transition-all"
                  :style="{ width: Math.max(2, uploadPct) + '%' }"
                />
              </div>
              <div class="text-[10px] text-slate-500 mt-1">อัปโหลด {{ uploadPct }}%</div>
            </div>
          </div>
        </div>
        <!-- XP Progress -->
        <div>
          <div class="flex items-center justify-between text-sm text-slate-600 mb-1">
            <span>Level {{ level }}</span>
            <span>{{ progressXp }}/{{ xpToNext }} XP</span>
          </div>
          <div class="h-2 bg-slate-200 rounded">
            <div class="h-2 bg-emerald-500 rounded" :style="{ width: progressPct + '%' }"></div>
          </div>
        </div>
        <div>
          <label for="name" class="block text-sm font-medium text-slate-700">ชื่อ</label>
          <input
            id="name"
            v-model="profile.name"
            type="text"
            class="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label for="interests" class="block text-sm font-medium text-slate-700"
            >ความสนใจ (ขั้นด้วยจุลภาค ,)</label
          >
          <input
            id="interests"
            v-model="interestsStr"
            type="text"
            placeholder="เช่น ฟุตบอล, ดาราศาสตร์, ทำอาหาร"
            class="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label for="learningStyle" class="block text-sm font-medium text-slate-700"
            >สไตล์การเรียนรู้ที่ชอบ</label
          >
          <input
            id="learningStyle"
            v-model="profile.learningStyle"
            type="text"
            placeholder="เช่น ชอบดูวิดีโอและภาพประกอบ"
            class="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label for="futureGoal" class="block text-sm font-medium text-slate-700"
            >เป้าหมายในอนาคต</label
          >
          <input
            id="futureGoal"
            v-model="profile.futureGoal"
            type="text"
            placeholder="เช่น อยากเป็นวิศวกรซอฟต์แวร์"
            class="mt-1 block w-full px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          @click="saveProfile"
          class="w-full px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"
        >
          บันทึกข้อมูล
        </button>
      </div>
      <div v-else>กำลังโหลดข้อมูล...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { auth } from '@/firebase/config'
import {
  getStudentProfile,
  updateStudentProfile,
  uploadUserImage,
} from '@/services/firestoreService'

const profile = ref(null)
const placeholder = '/avatar.svg'
const tempPreviewUrl = ref(null)
const uploading = ref(false)
const uploadPct = ref(0)
const avatarDisplayUrl = computed(() => tempPreviewUrl.value || profile.value?.photoURL || '')
const xp = computed(() => profile.value?.xp ?? 0)
const level = computed(() => {
  const x = xp.value
  let n = Math.floor((1 + Math.sqrt(1 + x / 25)) / 2)
  while (50 * n * (n - 1) > x) n--
  while (50 * (n + 1) * n <= x) n++
  return Math.max(1, n)
})
const xpBase = computed(() => 50 * level.value * (level.value - 1))
const xpNext = computed(() => 50 * (level.value + 1) * level.value)
const progressXp = computed(() => xp.value - xpBase.value)
const xpToNext = computed(() => Math.max(1, xpNext.value - xpBase.value))
const progressPct = computed(() =>
  Math.min(100, Math.max(0, (progressXp.value / xpToNext.value) * 100)),
)

// ใช้ computed property เพื่อจัดการ array ของ interests
const interestsStr = computed({
  get: () => profile.value?.interests?.join(', ') || '',
  set: (value) => {
    if (profile.value) {
      profile.value.interests = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  },
})

onMounted(async () => {
  const user = auth.currentUser
  if (user) {
    const p = await getStudentProfile(user.uid)
    // ถ้าชื่อเป็นอีเมล ให้เคลียร์เพื่อให้ผู้ใช้กรอกชื่อจริง
    if (typeof p.name === 'string' && p.name.includes('@')) {
      p.name = ''
    }
    profile.value = p
  }
})

async function onAvatarChange(e) {
  const file = e.target?.files?.[0]
  if (!file) return
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    // Instant local preview
    if (tempPreviewUrl.value) URL.revokeObjectURL(tempPreviewUrl.value)
    tempPreviewUrl.value = URL.createObjectURL(file)
    uploading.value = true
    uploadPct.value = 0
    const url = await uploadUserImage(uid, file, 'student-avatars', (pct) => {
      uploadPct.value = Math.max(0, Math.min(100, Math.round(pct)))
    })
    // Cache-busting version param for immediate refresh across the app
    const sep = url.includes('?') ? '&' : '?'
    const versioned = `${url}${sep}v=${Date.now()}`
    profile.value.photoURL = versioned
    await updateStudentProfile(uid, { photoURL: versioned })
    // Clear temp preview after small delay to let image swap smoothly
    setTimeout(() => {
      if (tempPreviewUrl.value) {
        URL.revokeObjectURL(tempPreviewUrl.value)
        tempPreviewUrl.value = null
      }
    }, 300)
    uploading.value = false
    uploadPct.value = 100
  } catch (_) {
    uploading.value = false
    // keep preview if upload failed; user can retry
    alert('อัปโหลดไม่สำเร็จ')
  }
}

onUnmounted(() => {
  if (tempPreviewUrl.value) {
    URL.revokeObjectURL(tempPreviewUrl.value)
    tempPreviewUrl.value = null
  }
})

const saveProfile = async () => {
  const user = auth.currentUser
  if (user && profile.value) {
    // validation: require interests, learningStyle, futureGoal
    const interestsOk =
      Array.isArray(profile.value.interests) && profile.value.interests.filter(Boolean).length > 0
    const styleOk =
      typeof profile.value.learningStyle === 'string' &&
      profile.value.learningStyle.trim().length > 0
    const goalOk =
      typeof profile.value.futureGoal === 'string' && profile.value.futureGoal.trim().length > 0
    if (!interestsOk) return alert('กรุณากรอกความสนใจอย่างน้อย 1 รายการ')
    if (!styleOk) return alert('กรุณากรอกสไตล์การเรียนรู้ที่ชอบ')
    if (!goalOk) return alert('กรุณากรอกเป้าหมายในอนาคต')

    await updateStudentProfile(user.uid, profile.value)
    alert('บันทึกข้อมูลสำเร็จ!')
  }
}
</script>

<template>
  <div class="bg-slate-50 min-h-screen p-6 md:p-8">
    <div class="mx-auto max-w-4xl space-y-6">
      <h1 class="text-2xl font-bold text-slate-800">Portfolio ครูผู้สอน</h1>
      <section class="bg-white rounded-xl shadow p-5">
        <div class="flex items-center gap-4 mb-4">
          <img
            :src="teacherAvatarDisplay || placeholder"
            alt="avatar"
            class="h-16 w-16 rounded-full object-cover bg-slate-200"
          />
          <div class="min-w-[220px]">
            <input type="file" accept="image/*" @change="onPickTeacherImage" />
            <div class="text-xs text-slate-500">
              อัปโหลดรูป (ไม่บังคับ) • รองรับไฟล์ภาพ ขนาดไม่เกิน ~2MB
            </div>
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input v-model="form.displayName" class="input-style" placeholder="ชื่อ-นามสกุล" />
          <input v-model="form.email" class="input-style" placeholder="อีเมล" />
          <input
            v-model="form.affiliation"
            class="input-style"
            placeholder="สังกัด (เช่น สพม.สระบุรี)"
          />
          <input v-model="form.school" class="input-style" placeholder="โรงเรียน" />
          <input
            v-model="form.subjectGroup"
            class="input-style"
            placeholder="กลุ่มสาระการเรียนรู้"
          />
          <input v-model="form.phone" class="input-style" placeholder="เบอร์ติดต่อ" />
        </div>
        <div class="mt-4">
          <button
            :disabled="saving"
            @click="save"
            class="px-4 py-2 rounded-md bg-indigo-600 text-white"
          >
            {{ saving ? 'กำลังบันทึก…' : 'บันทึก' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { getAuthInstance } from '@/firebase/config'
import {
  getTeacherProfile,
  upsertTeacherProfile,
  uploadUserImage,
} from '@/services/firestoreService'

const placeholder = '/avatar.svg'
const form = ref({
  displayName: '',
  photoURL: '',
  affiliation: '',
  school: '',
  subjectGroup: '',
  phone: '',
  email: '',
})
const saving = ref(false)
const tempPreview = ref(null)
const uploading = ref(false)
const uploadPct = ref(0)
const teacherAvatarDisplay = computed(() => tempPreview.value || form.value.photoURL || '')

onMounted(async () => {
  const auth = await getAuthInstance()
  const uid = auth.currentUser?.uid
  if (!uid) return
  const p = (await getTeacherProfile(uid)) || {}
  form.value = {
    displayName: p.displayName || auth.currentUser?.displayName || '',
    photoURL: p.photoURL || auth.currentUser?.photoURL || '',
    affiliation: p.affiliation || '',
    school: p.school || '',
    subjectGroup: p.subjectGroup || '',
    phone: p.phone || '',
    email: p.email || auth.currentUser?.email || '',
  }
})

async function onPickTeacherImage(e) {
  const file = e.target.files?.[0]
  const auth = await getAuthInstance()
  const uid = auth.currentUser?.uid
  if (!file || !uid) return
  try {
    if (tempPreview.value) URL.revokeObjectURL(tempPreview.value)
    tempPreview.value = URL.createObjectURL(file)
    uploading.value = true
    uploadPct.value = 0
    const url = await uploadUserImage(uid, file, 'teacher-avatars', (pct) => {
      uploadPct.value = Math.max(0, Math.min(100, Math.round(pct)))
    })
    const sep = url.includes('?') ? '&' : '?'
    const versioned = `${url}${sep}v=${Date.now()}`
    form.value.photoURL = versioned
    await upsertTeacherProfile(uid, { photoURL: versioned })
    setTimeout(() => {
      if (tempPreview.value) {
        URL.revokeObjectURL(tempPreview.value)
        tempPreview.value = null
      }
    }, 300)
    uploading.value = false
    uploadPct.value = 100
  } catch (err) {
    console.error('Upload failed:', err)
    alert('อัปโหลดรูปไม่สำเร็จ (อาจติด CORS). โปรดลองรีเฟรช และตั้งค่า CORS ของ Storage')
    uploading.value = false
  }
}

onUnmounted(() => {
  if (tempPreview.value) {
    URL.revokeObjectURL(tempPreview.value)
    tempPreview.value = null
  }
})

async function save() {
  const auth = await getAuthInstance()
  const uid = auth.currentUser?.uid
  if (!uid) return
  saving.value = true
  try {
    await upsertTeacherProfile(uid, { ...form.value })
    alert('บันทึกโปรไฟล์ครูสำเร็จ')
  } catch (e) {
    console.error(e)
    alert('บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped></style>

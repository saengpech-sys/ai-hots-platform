<template>
  <div class="flex items-center justify-center min-h-screen bg-slate-50">
    <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg">
      <h2 class="text-3xl font-bold text-center text-slate-800">ยินดีต้อนรับ</h2>
      <div class="space-y-4">
        <div>
          <label for="email" class="text-sm font-medium text-slate-600">อีเมล</label>
          <input
            v-model="email"
            id="email"
            type="email"
            required
            class="w-full px-4 py-2 mt-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label for="password" class="text-sm font-medium text-slate-600">รหัสผ่าน</label>
          <input
            v-model="password"
            id="password"
            type="password"
            required
            class="w-full px-4 py-2 mt-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <div class="mt-2 text-right">
            <button
              type="button"
              class="text-sm text-indigo-600 hover:underline"
              @click="handleResetPassword"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
        </div>
      </div>
      <div v-if="error" class="text-red-500 text-sm text-center">{{ error }}</div>
      <div v-if="info" class="text-emerald-600 text-sm text-center">{{ info }}</div>
      <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          @click="handleLogin"
          class="w-full px-6 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          เข้าสู่ระบบ
        </button>
        <button
          @click="handleRegister"
          class="w-full px-6 py-3 font-semibold text-indigo-600 bg-indigo-100 rounded-lg hover:bg-indigo-200"
        >
          สมัครสมาชิก
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/firebase/config'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'

const email = ref('')
const password = ref('')
const error = ref(null)
const info = ref(null)
const router = useRouter()

const handleLogin = async () => {
  try {
    error.value = null
    info.value = null
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/') // ไปยังหน้า Learning Loop หลังล็อกอินสำเร็จ
  } catch (err) {
    error.value = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  }
}

const handleRegister = async () => {
  try {
    error.value = null
    info.value = null
    await createUserWithEmailAndPassword(auth, email.value, password.value)
    router.push('/') // ไปยังหน้า Learning Loop หลังสมัครสำเร็จ
  } catch (err) {
    error.value = err.message
  }
}

const handleResetPassword = async () => {
  try {
    error.value = null
    info.value = null
    const mail = String(email.value || '').trim()
    if (!mail) {
      error.value = 'กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน'
      return
    }
    await sendPasswordResetEmail(auth, mail, {
      // กลับมาที่หน้าล็อกอินหลังรีเซ็ตสำเร็จ
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    })
    info.value = 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย/สแปม'
  } catch (err) {
    const code = err?.code || ''
    if (code === 'auth/user-not-found') error.value = 'ไม่พบบัญชีอีเมลนี้ในระบบ'
    else if (code === 'auth/invalid-email') error.value = 'อีเมลไม่ถูกต้อง'
    else error.value = 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ โปรดลองอีกครั้ง'
  }
}
</script>

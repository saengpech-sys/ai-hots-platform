<template>
  <div class="max-w-xl mx-auto p-4 sm:p-6">
    <h1 class="text-2xl font-bold mb-4">แบบฟอร์มยืนยันผู้ปกครอง</h1>
    <p class="text-sm text-slate-600 mb-6">
      ผู้ปกครองกรุณากรอกข้อมูลเพื่อยืนยันความยินยอมสำหรับการใช้ระบบนี้
      ข้อมูลจะถูกจัดเก็บอย่างปลอดภัย การยืนยันนี้ใช้รหัสนักเรียน 5 หลัก ของบุตรหลาน
    </p>
    <form @submit.prevent="submit" class="space-y-4" novalidate>
      <div>
        <label class="block text-sm font-medium mb-1">ชื่อผู้ปกครอง *</label>
        <input v-model.trim="parentName" type="text" class="input" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">รหัสนักเรียน (5 หลัก) *</label>
        <input v-model.trim="studentCode" maxlength="5" pattern="\\d{5}" class="input" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">ลายเซ็น / ข้อความยืนยัน *</label>
        <textarea
          v-model.trim="signature"
          rows="3"
          class="input resize-none"
          required
          placeholder="พิมพ์ชื่อหรือลงข้อความยืนยัน"
        ></textarea>
      </div>
      <div class="pt-2">
        <button
          :disabled="loading"
          class="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm disabled:opacity-50"
        >
          {{ loading ? 'กำลังส่ง...' : 'ส่งแบบฟอร์ม' }}
        </button>
      </div>
      <div v-if="error" class="text-xs text-red-600">{{ error }}</div>
      <div v-if="success" class="text-xs text-emerald-600">ส่งสำเร็จ ขอบคุณสำหรับความร่วมมือ</div>
    </form>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { apiPost } from '@/services/apiClient'

const parentName = ref('')
const studentCode = ref('')
const signature = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function submit() {
  error.value = ''
  success.value = false
  if (!/^\d{5}$/.test(studentCode.value)) {
    error.value = 'รหัสนักเรียนไม่ถูกต้อง'
    return
  }
  loading.value = true
  try {
    await apiPost(
      '/api/parental-consent',
      {},
      {
        parentName: parentName.value,
        studentCode: studentCode.value,
        signature: signature.value,
      },
    )
    success.value = true
    parentName.value = ''
    studentCode.value = ''
    signature.value = ''
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    loading.value = false
  }
}
</script>
<style scoped>
.input {
  width: 100%;
  border: 1px solid #cbd5e1; /* slate-300 */
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  background: #fff;
  outline: none;
}
.input:focus {
  border-color: #059669; /* emerald-600-ish */
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}
</style>

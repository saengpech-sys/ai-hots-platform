// src/App.vue
<template>
  <Navbar v-if="isLoggedIn" />
  <RouterView />
  <ToastHost />
  <ReloadBanner />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import ReloadBanner from '@/components/ReloadBanner.vue'
import ToastHost from '@/components/ToastHost.vue'
import { getAuthInstance } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

const isLoggedIn = ref(false)

// คอยดักฟังสถานะการล็อกอินจาก Firebase ตลอดเวลา
onMounted(async () => {
  const auth = await getAuthInstance()
  onAuthStateChanged(auth, (user) => {
    isLoggedIn.value = !!user
  })
})
</script>

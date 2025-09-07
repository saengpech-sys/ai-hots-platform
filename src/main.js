// src/main.js
import './assets/style.css' // นำเข้าไฟล์ CSS หลัก

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/animate.css'
import { log } from '@/utils/logger'

// Handle failed dynamic imports (often due to stale cached entry referencing purged chunk)
window.addEventListener('error', (e) => {
  if (
    e?.message &&
    /Failed to fetch dynamically imported module/i.test(e.message) &&
    !window.__VITE_RELOAD_ONCE
  ) {
    window.__VITE_RELOAD_ONCE = true
    const url = new URL(window.location.href)
    url.searchParams.set('v', Date.now().toString(36))
    window.location.replace(url.toString())
  }
  // Also log generic errors
  if (e?.error) {
    try {
      log.error(
        'global.error',
        { message: e.message, filename: e.filename, lineno: e.lineno },
        e.error,
      )
    } catch {}
  }
})

window.addEventListener('unhandledrejection', (e) => {
  try {
    const reason = e.reason
    const msg = typeof reason === 'string' ? reason : reason?.message || 'unhandledrejection'
    log.error('global.unhandledrejection', { message: msg })
  } catch {}
})

const app = createApp(App)

app.use(createPinia()) // ติดตั้ง Pinia
app.use(router) // ติดตั้ง Router

// Simple scroll-reveal directive
app.directive('reveal', {
  mounted(el, binding) {
    const base = 'op-0 translate-y-3'
    const visible = 'op-100 translate-y-0'
    el.classList.add('reveal', 'op-0')
    const threshold = Math.max(0, Math.min(1, binding.value?.threshold ?? 0.1))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('reveal-show')
            io.unobserve(el)
          }
        })
      },
      { threshold },
    )
    io.observe(el)
  },
})

app.mount('#app')

import { ref, reactive, watch } from 'vue'

// Consider persisting chosen locale in localStorage cookie or user profile later
const currentLocale = ref('th')
const messages = reactive({})
let loaded = new Set()

async function loadLocaleOnce(code) {
  if (loaded.has(code)) return
  if (code === 'th') {
    const mod = await import('@/config/locale/th')
    messages[code] = mod.th
  } else if (code === 'en') {
    const mod = await import('@/config/locale/en')
    messages[code] = mod.en
  } else {
    // fallback silently
    return
  }
  loaded.add(code)
}

export async function setLocale(code) {
  await loadLocaleOnce(code)
  if (messages[code]) {
    currentLocale.value = code
  }
}

export async function ensureInitialLocale() {
  await loadLocaleOnce(currentLocale.value)
}

export function useL() {
  return { locale: currentLocale, messages }
}

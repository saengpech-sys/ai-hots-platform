import { ref, onMounted, onUnmounted } from 'vue'

// Poll /version.json every POLL_MS. If hash changes, trigger update flag.
export function useVersionWatcher(pollMs = 60000) {
  const needsReload = ref(false)
  const currentHash = ref(null)
  let timer = null

  async function check() {
    try {
      const resp = await fetch('/version.json?_=' + Date.now())
      if (!resp.ok) return
      const data = await resp.json().catch(() => null)
      if (!data?.hash) return
      if (!currentHash.value) {
        currentHash.value = data.hash
        return
      }
      if (data.hash !== currentHash.value) {
        needsReload.value = true
      }
    } catch {}
  }

  onMounted(() => {
    check()
    timer = setInterval(check, pollMs)
  })
  onUnmounted(() => timer && clearInterval(timer))
  return { needsReload, reloadNow: () => window.location.reload() }
}

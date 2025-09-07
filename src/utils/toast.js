import { reactive } from 'vue'

// Reactive toast queue
export const toasts = reactive([])
let _id = 1

export function removeToast(id) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

export function showToast({
  message,
  title = '',
  type = 'info',
  duration = 3500,
  actionLabel = '',
  onClick = null,
} = {}) {
  if (!message && !title) return
  const id = _id++
  const item = { id, message, title, type, actionLabel, onClick }
  toasts.push(item)
  if (duration > 0) setTimeout(() => removeToast(id), duration)
  return id
}

export const toast = {
  success: (message, opts = {}) => showToast({ message, type: 'success', ...opts }),
  error: (message, opts = {}) => showToast({ message, type: 'error', ...opts }),
  info: (message, opts = {}) => showToast({ message, type: 'info', ...opts }),
  warning: (message, opts = {}) => showToast({ message, type: 'warning', ...opts }),
}

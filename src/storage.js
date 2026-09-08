// localStorage wrapper that never throws (Safari private mode, quota, disabled storage).
// Falls back to an in-memory map so the game keeps working for the session.

const memory = new Map()

function ls() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function getItem(key) {
  const store = ls()
  if (store) {
    try { const v = store.getItem(key); if (v !== null) return v } catch { /* fall through */ }
  }
  return memory.has(key) ? memory.get(key) : null
}

export function setItem(key, value) {
  memory.set(key, value)
  const store = ls()
  if (!store) return false
  try { store.setItem(key, value); return true } catch { return false }
}

export function removeItem(key) {
  memory.delete(key)
  const store = ls()
  if (!store) return
  try { store.removeItem(key) } catch { /* ignore */ }
}

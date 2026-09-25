import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage, plus a copy in Android SharedPreferences inside the app. The WebView writes
 * localStorage to disk seconds late, so money won just before the app is swiped away could be
 * lost; SharedPreferences is flushed to disk when the app goes to the background.
 */
let restored = !Capacitor.isNativePlatform()
export const durable: StateStorage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => {
    localStorage.setItem(k, v)
    if (restored) void Preferences.set({ key: k, value: v })
  },
  removeItem: (k) => {
    localStorage.removeItem(k)
    if (restored) void Preferences.remove({ key: k })
  },
}

const stamp = (v: string | null) => {
  try {
    return (JSON.parse(v ?? '') as { state?: { balanceAt?: number } }).state?.balanceAt ?? -1
  } catch {
    return -1
  }
}

/** On the app, before first render: if the SharedPreferences copy is newer, put it back. True if it was. */
export async function restore(key: string): Promise<boolean> {
  if (restored) return false
  const { value } = await Preferences.get({ key }).catch(() => ({ value: null }))
  restored = true
  const local = localStorage.getItem(key)
  if (value === null || value === local || stamp(value) < stamp(local)) {
    if (local) void Preferences.set({ key, value: local })
    return false
  }
  localStorage.setItem(key, value)
  return true
}

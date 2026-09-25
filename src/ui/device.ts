import { Capacitor } from '@capacitor/core'

/**
 * Phone layout: the Android app, or any touch screen too short for the desktop
 * table. Decided once at startup (the app is locked to landscape).
 */
export const MOBILE =
  typeof window !== 'undefined' &&
  (Capacitor.isNativePlatform() || window.matchMedia('(pointer: coarse) and (max-height: 600px)').matches)

export const NATIVE = typeof window !== 'undefined' && Capacitor.isNativePlatform()

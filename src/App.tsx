import { useEffect } from 'react'
import { GlobalDefs } from './components/GlobalDefs'
import { SettingsDialog } from './components/Dialogs'
import { Lobby } from './screens/Lobby'
import { TableScreen } from './screens/TableScreen'
import { Stats } from './screens/Stats'
import { RouletteScreen } from './games/roulette/RouletteScreen'
import { SlotsScreen } from './games/slots/SlotsScreen'
import { BlackjackScreen } from './games/blackjack/BlackjackScreen'
import { busy } from './games/casino'
import { useGame } from './game/store'
import { initAudio, setMasterVolume } from './audio/sound'
import { startCloud } from './cloud/sync'
import { App as NativeApp } from '@capacitor/app'
import { NATIVE } from './ui/device'
import { get, set } from './game/store'

export default function App() {
  const screen = useGame((s) => s.screen)
  const volume = useGame((s) => s.settings.volume)
  const muted = useGame((s) => s.settings.muted)

  useEffect(() => {
    setMasterVolume(volume, muted)
  }, [volume, muted])

  useEffect(() => {
    // Browsers only allow audio after a user gesture.
    const unlock = () => initAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    void startCloud()
    if (!NATIVE) return
    // Android back: close what's open, then step back toward the lobby, then exit.
    const sub = NativeApp.addListener('backButton', () => {
      const s = get()
      if (s.dialog === 'bust') return
      if (s.dialog) return set({ dialog: null })
      // Any other open dialog (e.g. a hand breakdown on the Stats page) closes like Esc would.
      const open = document.querySelector('dialog[open]')
      if (open) return void open.dispatchEvent(new Event('cancel', { cancelable: true }))
      if (s.screen === 'table' && s.settings.panelOpen) return set({ settings: { ...s.settings, panelOpen: false } })
      if (s.screen === 'table') return set({ dialog: 'leave' })
      if (s.screen === 'blackjack' || s.screen === 'roulette' || s.screen === 'slots') return void (busy || set({ dialog: 'leave' }))
      if (s.screen === 'stats') return set({ screen: 'lobby' })
      void NativeApp.exitApp()
    })
    return () => void sub.then((h) => h.remove())
  }, [])

  return (
    <>
      <GlobalDefs />
      {screen === 'lobby' ? (
        <Lobby />
      ) : screen === 'stats' ? (
        <Stats />
      ) : screen === 'slots' ? (
        <SlotsScreen />
      ) : screen === 'roulette' ? (
        <RouletteScreen />
      ) : screen === 'blackjack' ? (
        <BlackjackScreen />
      ) : (
        <TableScreen />
      )}
      <SettingsDialog />
    </>
  )
}

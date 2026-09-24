import { useEffect } from 'react'
import { GlobalDefs } from './components/GlobalDefs'
import { SettingsDialog } from './components/Dialogs'
import { Lobby } from './screens/Lobby'
import { TableScreen } from './screens/TableScreen'
import { Stats } from './screens/Stats'
import { useGame } from './game/store'
import { initAudio, setMasterVolume } from './audio/sound'
import { startCloud } from './cloud/sync'

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
  }, [])

  return (
    <>
      <GlobalDefs />
      {screen === 'lobby' ? <Lobby /> : screen === 'stats' ? <Stats /> : <TableScreen />}
      <SettingsDialog />
    </>
  )
}

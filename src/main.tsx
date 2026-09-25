import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { restore } from './game/durable'
import { set, useGame } from './game/store'

// On the app, the SharedPreferences copy of your money may be newer than the WebView's storage.
void restore('cards:v1')
  .then(async (newer) => {
    if (!newer) return
    await useGame.persist.rehydrate()
    set({}) // save the merged result (table chips returned to the bankroll)
  })
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )

// On very large screens (1440p, 4K) scale the whole UI so side panels and HUD stay readable.
const fitZoom = () => {
  document.documentElement.style.zoom = String(Math.max(1, Math.min(window.innerHeight / 1080, window.innerWidth / 1920)))
}
fitZoom()
window.addEventListener('resize', fitZoom)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// On very large screens (1440p, 4K) scale the whole UI so side panels and HUD stay readable.
const fitZoom = () => {
  document.documentElement.style.zoom = String(Math.max(1, Math.min(window.innerHeight / 1080, window.innerWidth / 1920)))
}
fitZoom()
window.addEventListener('resize', fitZoom)

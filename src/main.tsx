import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { devView, readDevSwitch } from './profile/devView'
import { useProfiles } from './profile/useProfiles'
import { startScoreLog } from './profile/scoreLog'

// the old admin panel's browser data is no longer used
try {
  localStorage.removeItem('bakugan-admin')
  indexedDB.deleteDatabase('bakugan-admin-files')
} catch {
  // storage unavailable (private mode): nothing to clean
}

// an address with ?dev= switches the owner's view and reloads without it
void readDevSwitch().then((reloading) => {
  if (reloading) return
  // the rankings' 24-hour change for the player's own profiles
  startScoreLog()
  // the owner's own browser: its profiles, those made later included, get the owner's Bakugan
  if (devView()) {
    useProfiles.getState().grantOwnerBakugan()
    useProfiles.subscribe(() => useProfiles.getState().grantOwnerBakugan())
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

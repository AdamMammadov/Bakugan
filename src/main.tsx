import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { devView, readDevSwitch } from './profile/devView'
import { useProfiles } from './profile/useProfiles'

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
  // the owner's own browser: its profiles get the owner's Bakugan
  if (devView()) useProfiles.getState().grantOwnerBakugan()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

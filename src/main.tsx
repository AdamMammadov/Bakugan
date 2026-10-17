import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readDevSwitch } from './profile/devView'

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
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

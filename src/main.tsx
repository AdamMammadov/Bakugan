import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAdminData } from './admin/apply'

// admin-panel changes (new Bakugan, uploaded models) are merged in before the first render
applyAdminData()
  .catch((e) => console.error('Admin data could not be applied', e))
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )

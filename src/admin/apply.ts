import { BAKUGAN, type Bakugan } from '../data/bakugan'
import { IDB_PREFIX, loadFile } from './files'
import { useAdmin } from './useAdmin'

/** Built-in Bakugan as shipped, before any admin changes. */
export const BUILT_IN: Bakugan[] = BAKUGAN.map((b) => structuredClone(b))

async function resolveModels(models: Bakugan['models']): Promise<Bakugan['models']> {
  if (!models) return models
  const out = { ...models }
  for (const key of ['ball', 'monster'] as const) {
    const ref = out[key]
    if (ref?.startsWith(IDB_PREFIX)) {
      const blob = await loadFile(ref.slice(IDB_PREFIX.length)).catch(() => undefined)
      out[key] = blob ? URL.createObjectURL(blob) : undefined
    }
  }
  return out
}

/**
 * Merges the admin panel's changes into the game data before the app renders:
 * overrides on built-in Bakugan, then the admin-made Bakugan.
 */
export async function applyAdminData() {
  const { custom, overrides } = useAdmin.getState()
  for (const b of BAKUGAN) {
    const o = overrides[b.id]
    if (!o) continue
    Object.assign(b, o, { models: o.models ? await resolveModels({ ...b.models, ...o.models }) : b.models })
    b.brawlG = b.baseG + 100
  }
  for (const c of custom) {
    BAKUGAN.push({ ...c, brawlG: c.baseG + 100, models: await resolveModels(c.models) })
  }
}

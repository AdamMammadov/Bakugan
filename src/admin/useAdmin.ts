import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bakugan } from '../data/bakugan'

/**
 * Admin data, kept in this browser: new Bakugan and changes to the built-in ones.
 * It is merged into the game at start-up (see apply.ts). Model files live in IndexedDB.
 */
export type BakuganOverride = Partial<Pick<Bakugan, 'name' | 'brawler' | 'series' | 'baseG' | 'description' | 'models' | 'abilities' | 'evolutions'>>

interface AdminState {
  /** SHA-256 of the admin PIN; null until one is set. */
  pinHash: string | null
  custom: Bakugan[]
  overrides: Record<string, BakuganOverride>
  setPin: (hash: string) => void
  saveCustom: (b: Bakugan) => void
  removeCustom: (id: string) => void
  saveOverride: (id: string, o: BakuganOverride) => void
  resetOverride: (id: string) => void
  importData: (data: { custom: Bakugan[]; overrides: Record<string, BakuganOverride> }) => void
}

export const useAdmin = create<AdminState>()(
  persist(
    (set) => ({
      pinHash: null,
      custom: [],
      overrides: {},
      setPin: (pinHash) => set({ pinHash }),
      saveCustom: (b) => set((s) => ({ custom: [...s.custom.filter((x) => x.id !== b.id), b] })),
      removeCustom: (id) => set((s) => ({ custom: s.custom.filter((x) => x.id !== id) })),
      saveOverride: (id, o) => set((s) => ({ overrides: { ...s.overrides, [id]: o } })),
      resetOverride: (id) =>
        set((s) => {
          const overrides = { ...s.overrides }
          delete overrides[id]
          return { overrides }
        }),
      importData: ({ custom, overrides }) => set({ custom, overrides }),
    }),
    { name: 'bakugan-admin', version: 1 },
  ),
)

export async function hashPin(pin: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bakugan-admin:${pin}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

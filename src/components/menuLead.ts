import { asset } from '../asset'
import { BAKUGAN, formBrawlG, formModels, formOf } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import { starterFor, useProfiles, type Profile } from '../profile/useProfiles'
import { SKIN_BY_ID } from '../season/season'

/**
 * The main menu's lead Bakugan: a picture of its 3D stage is kept in the browser, so the next visit shows it at
 * once while three.js and the model load; and the model is fetched first, ahead of the others.
 */
const KEY = 'bakugan-menu-lead'

/** The Bakugan the player leads with: the first of their team, else their first; a guest's is the starter. */
export function leadOf(profile: Profile | null, element: ElementId) {
  const owned = profile && (profile.collection.find((o) => o.id === profile.team[0]) ?? profile.collection[0])
  const id = owned?.id ?? starterFor(element)
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const form = owned?.form ?? 0
  return { bakugan, form, skin: owned?.skin, name: formOf({ bakugan, form }).name, g: formBrawlG({ bakugan, form }) }
}

export const leadKey = (id: string, form: number, skin?: string) => `${id}-${form}-${skin ?? ''}`

/** The saved picture of this lead, if there is one. */
export function leadPicture(key: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key: string; url: string } | null
    return saved?.key === key ? saved.url : null
  } catch {
    return null
  }
}

/** Keeps a picture of the lead (only one: a new lead replaces the old). */
export function saveLeadPicture(key: string, url: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ key, url }))
  } catch {
    // storage full or blocked: the menu just waits for the model next time
  }
}

/** Starts downloading the lead's model (and the 3D stage's code) before anything else asks for models. */
export function preloadLead(id: string, form: number, skin?: string) {
  const bakugan = BAKUGAN.find((b) => b.id === id)
  const url = (skin && SKIN_BY_ID[skin]?.models?.[id]) || (bakugan && formModels({ bakugan, form })?.monster)
  if (url) void import('@react-three/drei').then(({ useGLTF }) => useGLTF.preload(asset(url)))
  void import('./MenuStage')
}

/** The active player's lead, fetched while the title screen waits for a click. */
export function preloadActiveLead() {
  const { profiles, activeId } = useProfiles.getState()
  const profile = profiles.find((p) => p.id === activeId)
  if (!profile) return
  const lead = leadOf(profile, profile.element)
  preloadLead(lead.bakugan.id, lead.form, lead.skin)
}

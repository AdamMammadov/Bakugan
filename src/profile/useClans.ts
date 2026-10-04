import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ElementId } from '../data/elements'

/**
 * Clans of brawlers with a shared chat. Saved in this browser for now, so every player profile on
 * this device can found, join and talk in clans; online clans come with the server (PvP) update.
 */

export interface ClanMessage {
  id: string
  author: string
  text: string
  at: number
}

export interface Clan {
  id: string
  name: string
  /** Short tag shown next to member names, e.g. [VEST]. */
  tag: string
  element: ElementId
  motto: string
  createdAt: number
  leaderId: string
  members: string[]
  messages: ClanMessage[]
}

export type ClanInput = Pick<Clan, 'name' | 'tag' | 'element' | 'motto'>

const MAX_MESSAGES = 300

interface ClansState {
  clans: Clan[]
  create: (founder: string, input: ClanInput) => string
  join: (clanId: string, profileId: string) => void
  leave: (profileId: string) => void
  kick: (clanId: string, profileId: string) => void
  send: (clanId: string, author: string, text: string) => void
}

const without = (clans: Clan[], profileId: string) =>
  clans
    .map((c) => {
      if (!c.members.includes(profileId)) return c
      const members = c.members.filter((m) => m !== profileId)
      // leadership passes to the longest-standing member
      return { ...c, members, leaderId: c.leaderId === profileId ? (members[0] ?? '') : c.leaderId }
    })
    .filter((c) => c.members.length > 0)

export const useClans = create<ClansState>()(
  persist(
    (set) => ({
      clans: [],
      create: (founder, input) => {
        const id = `c${Date.now().toString(36)}`
        set((s) => ({
          clans: [
            ...without(s.clans, founder),
            { ...input, id, createdAt: Date.now(), leaderId: founder, members: [founder], messages: [] },
          ],
        }))
        return id
      },
      join: (clanId, profileId) =>
        set((s) => ({
          clans: without(s.clans, profileId).map((c) => (c.id === clanId ? { ...c, members: [...c.members, profileId] } : c)),
        })),
      leave: (profileId) => set((s) => ({ clans: without(s.clans, profileId) })),
      kick: (clanId, profileId) =>
        set((s) => ({
          clans: s.clans.map((c) => (c.id === clanId ? { ...c, members: c.members.filter((m) => m !== profileId) } : c)),
        })),
      send: (clanId, author, text) =>
        set((s) => ({
          clans: s.clans.map((c) =>
            c.id === clanId
              ? {
                  ...c,
                  messages: [...c.messages, { id: `m${Date.now().toString(36)}`, author, text: text.slice(0, 400), at: Date.now() }].slice(
                    -MAX_MESSAGES,
                  ),
                }
              : c,
          ),
        })),
    }),
    { name: 'bakugan-clans', version: 1 },
  ),
)

export const clanOf = (clans: Clan[], profileId: string | null | undefined) =>
  profileId ? (clans.find((c) => c.members.includes(profileId)) ?? null) : null

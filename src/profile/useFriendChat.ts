import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { botById, isBot } from './bots'
import { botLine, convoLang, reply, type Ask, type Lang } from './chatBrain'
import { presenceOf, wake } from './presence'
import { clanOf, useClans } from './useClans'
import { friendStatus, useProfiles } from './useProfiles'

/**
 * Direct messages between a player and their friends, saved in this browser. CPU friends answer with the
 * same reply engine as the clan chat; another player on this device reads them when they switch to their
 * profile. Online chat between devices comes with the server (PvP) update.
 */

export interface DirectMessage {
  id: string
  author: string
  text: string
  at: number
  /** A CPU friend's question, so the player's short answer to it is understood. */
  ask?: Ask
}

/** Messages kept per conversation. */
const MAX_MESSAGES = 150

/** One conversation per pair of brawlers, whoever started it. */
export const threadKey = (a: string, b: string) => [a, b].sort().join('|')
const readKey = (me: string, other: string) => `${me}>${threadKey(me, other)}`

interface FriendChatState {
  threads: Record<string, DirectMessage[]>
  /** When a player last read a conversation (`me>key`). */
  read: Record<string, number>
  /** CPU friends writing an answer right now, per conversation (not saved). */
  typing: Record<string, boolean>
  /** The friend to show when the Friends page opens (not saved). */
  focus: string | null
  send: (from: string, to: string, text: string) => void
  /** A new CPU friend says hello once (their line is dated just after they accepted). */
  hello: (me: string, friendId: string, at: number) => void
  markRead: (me: string, other: string) => void
  /** Drops a deleted player's conversations. */
  forget: (profileId: string) => void
  setFocus: (id: string | null) => void
}

const message = (author: string, text: string, at = Date.now(), ask?: Ask): DirectMessage => ({
  id: `d${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  author,
  text: text.slice(0, 400),
  at,
  ...(ask ? { ask } : {}),
})

const append = (list: DirectMessage[] | undefined, m: DirectMessage) => [...(list ?? []), m].slice(-MAX_MESSAGES)

/** The language a player writes in: their newest clear message in any conversation or clan. */
function playerLang(me: string): Lang {
  const mine = [
    ...Object.values(useFriendChat.getState().threads).flat(),
    ...useClans.getState().clans.flatMap((c) => c.messages.filter((m) => !m.system)),
  ]
    .filter((m) => m.author === me)
    .sort((a, b) => a.at - b.at)
  return convoLang(mine.map((m) => m.text)) ?? 'en'
}

/** Answers on the way per conversation, and the newest message still owed one. */
const replying: Record<string, boolean> = {}
const owed: Record<string, { from: string; text: string } | undefined> = {}

/** A CPU friend types for a moment (longer when they first have to come online), then answers. */
function answer(from: string, bot: string, text: string) {
  const key = threadKey(from, bot)
  if (replying[key]) {
    owed[key] = { from, text }
    return
  }
  const online = presenceOf(bot, Date.now()).online
  wake(bot)
  replying[key] = true
  useFriendChat.setState((s) => ({ typing: { ...s.typing, [key]: true } }))
  window.setTimeout(
    () => {
      const { profiles } = useProfiles.getState()
      const player = profiles.find((p) => p.id === from) ?? null
      const thread = useFriendChat.getState().threads[key] ?? []
      const i = thread.findLastIndex((m) => m.author === from && m.text === text)
      const clan = clanOf(useClans.getState().clans, bot)
      const r = reply({
        text,
        botId: bot,
        player,
        place: { kind: 'dm', clan, friends: true },
        history: thread.slice(0, i < 0 ? thread.length : i).slice(-16),
        profiles,
        now: Date.now(),
      })
      replying[key] = false
      useFriendChat.setState((s) => ({
        typing: { ...s.typing, [key]: false },
        threads: { ...s.threads, [key]: append(s.threads[key], message(bot, r.text, Date.now(), r.ask)) },
      }))
      const next = owed[key]
      owed[key] = undefined
      if (next) answer(next.from, bot, next.text)
    },
    (online ? 1200 : 3500) + Math.random() * 2200 + Math.min(2500, text.length * 25),
  )
}

export const useFriendChat = create<FriendChatState>()(
  persist(
    (set, get) => ({
      threads: {},
      read: {},
      typing: {},
      focus: null,
      send: (from, to, text) => {
        const key = threadKey(from, to)
        const m = message(from, text)
        set((s) => ({
          threads: { ...s.threads, [key]: append(s.threads[key], m) },
          read: { ...s.read, [readKey(from, to)]: m.at },
        }))
        const me = useProfiles.getState().profiles.find((p) => p.id === from) ?? null
        if (isBot(to) && botById(to) && friendStatus(me, to) === 'friend') answer(from, to, text)
      },
      hello: (me, friendId, at) => {
        const key = threadKey(me, friendId)
        if (get().threads[key]?.length || !isBot(friendId)) return
        const { profiles } = useProfiles.getState()
        const player = profiles.find((p) => p.id === me) ?? null
        const clan = clanOf(useClans.getState().clans, friendId)
        const line = botLine(
          'friendHello',
          { botId: friendId, player, place: { kind: 'dm', clan, friends: true }, profiles, now: at, name: player?.firstName },
          playerLang(me),
        )
        set((s) => ({ threads: { ...s.threads, [key]: [message(friendId, line.text, at, line.ask)] } }))
      },
      markRead: (me, other) => {
        const last = get().threads[threadKey(me, other)]?.at(-1)?.at ?? 0
        if ((get().read[readKey(me, other)] ?? 0) >= last) return
        set((s) => ({ read: { ...s.read, [readKey(me, other)]: last } }))
      },
      forget: (profileId) =>
        set((s) => ({
          threads: Object.fromEntries(Object.entries(s.threads).filter(([k]) => !k.split('|').includes(profileId))),
          read: Object.fromEntries(Object.entries(s.read).filter(([k]) => !k.startsWith(`${profileId}>`))),
        })),
      setFocus: (focus) => set({ focus }),
    }),
    {
      name: 'bakugan-dms',
      version: 1,
      partialize: (s) => ({ threads: s.threads, read: s.read }),
    },
  ),
)

/** Messages a player has not read yet from `other`. */
export const unreadFrom = (s: Pick<FriendChatState, 'threads' | 'read'>, me: string, other: string) => {
  const seen = s.read[readKey(me, other)] ?? 0
  return (s.threads[threadKey(me, other)] ?? []).filter((m) => m.author !== me && m.at > seen).length
}

/** Unread messages from all of a player's friends. */
export function useUnread(me: string | null | undefined, friends: string[]) {
  return useFriendChat((s) => (me ? friends.reduce((n, f) => n + unreadFrom(s, me, f), 0) : 0))
}

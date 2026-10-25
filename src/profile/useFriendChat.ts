import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { botById, isBot } from './bots'
import { botLine, convoLang, reply, type Ask, type Lang } from './chatBrain'
import { isAvailable } from './presence'
import { clanOf, useClans } from './useClans'
import { friendStatus, useProfiles } from './useProfiles'

/**
 * Direct messages between a player and their friends, saved in this browser. CPU friends answer with the
 * same reply engine as the clan chat, but only while they are online: a message to an offline friend (or
 * one in a match) is delivered and waits, and they read and answer it when they are next on. Another player
 * on this device reads them when they switch to their profile. Online chat between devices comes with the
 * server (PvP) update.
 */

/** A line about a battle invite between the two (shown as a note in the thread, not a bubble). */
export interface InviteNote {
  kind: 'duel' | 'tag'
  /** Who sent the invite. */
  by: string
  to: string
  event: 'sent' | 'accepted' | 'declined' | 'missed' | 'cancelled'
  /** Missed while the player had do not disturb on. */
  dnd?: boolean
}

export interface DirectMessage {
  id: string
  author: string
  text: string
  at: number
  /** A CPU friend's question, so the player's short answer to it is understood. */
  ask?: Ask
  invite?: InviteNote
}

/** A CPU friend owes an answer in a conversation (they were away when the player wrote). */
export interface Pending {
  /** The player who wrote. */
  from: string
  since: number
  /** They missed an invite while in a match, and say sorry when back. */
  invite?: boolean
}

/** Messages kept per conversation. */
const MAX_MESSAGES = 150

/** One conversation per pair of brawlers, whoever started it. */
export const threadKey = (a: string, b: string) => [a, b].sort().join('|')
const readKey = (me: string, other: string) => `${me}>${threadKey(me, other)}`
const otherIn = (key: string, me: string) => key.split('|').find((id) => id !== me) ?? me

type BotKey = 'inviteNo' | 'inviteBusy' | 'inviteLate' | 'inviteOk'

interface FriendChatState {
  threads: Record<string, DirectMessage[]>
  /** When a player last read a conversation (`me>key`). */
  read: Record<string, number>
  /** When the CPU friend in a conversation last read it (for Delivered / Seen). */
  seen: Record<string, number>
  /** Conversations a CPU friend still has to answer, once online. */
  pending: Record<string, Pending>
  /** CPU friends writing an answer right now, per conversation (not saved). */
  typing: Record<string, boolean>
  /** The friend to show when the Friends page opens (not saved). */
  focus: string | null
  send: (from: string, to: string, text: string) => void
  /** A new CPU friend says hello once (their line is dated just after they accepted). */
  hello: (me: string, friendId: string, at: number) => void
  /** Adds an invite note to the conversation of `note.by` and `note.to`. */
  note: (note: InviteNote) => void
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

const without = <T>(map: Record<string, T>, key: string) => Object.fromEntries(Object.entries(map).filter(([k]) => k !== key))

/** The language a player writes in: their newest clear message in any conversation or clan. */
function playerLang(me: string): Lang {
  const mine = [
    ...Object.values(useFriendChat.getState().threads)
      .flat()
      .filter((m) => !m.invite),
    ...useClans.getState().clans.flatMap((c) => c.messages.filter((m) => !m.system)),
  ]
    .filter((m) => m.author === me)
    .sort((a, b) => a.at - b.at)
  return convoLang(mine.map((m) => m.text)) ?? 'en'
}

/** The plain-English text of an invite note, as `me` sees it (`name`: the other brawler's first name). */
export function noteText(n: InviteNote, me: string, name: string) {
  const mine = n.by === me
  const duel = n.kind === 'duel'
  switch (n.event) {
    case 'sent':
      return mine
        ? `⚔ You invited ${name} to ${duel ? 'a friendly battle' : 'a tag battle as your partner'}`
        : `⚔ ${name} invited you to ${duel ? 'a friendly battle' : 'a tag battle as their partner'}`
    case 'accepted':
      return mine ? `✓ ${name} accepted your invite` : `✓ You accepted ${name}’s invite`
    case 'declined':
      return mine ? `✕ ${name} declined your invite` : `✕ You declined ${name}’s invite`
    case 'missed':
      if (mine) return `⌛ No answer from ${name}: the invite expired`
      return n.dnd
        ? `🔕 ${name} invited you to ${duel ? 'a friendly battle' : 'a tag battle'} while you were on do not disturb`
        : `⌛ You missed ${name}’s invite to ${duel ? 'a friendly battle' : 'a tag battle'}`
    case 'cancelled':
      return mine ? `You cancelled the invite to ${name}` : `${name} cancelled the invite`
  }
}

/** Answers on the way per conversation, and the newest message still owed one. */
const replying: Record<string, boolean> = {}
const owed: Record<string, { from: string; text: string } | undefined> = {}
/** Conversations a friend who just came online is about to read. */
const reading: Record<string, boolean> = {}

const typing = (key: string, on: boolean) => useFriendChat.setState((s) => ({ typing: { ...s.typing, [key]: on } }))

/** A CPU friend who is online reads the conversation, types for a moment, then answers `text`. */
function answer(from: string, bot: string, text: string) {
  const key = threadKey(from, bot)
  if (replying[key]) {
    owed[key] = { from, text }
    return
  }
  replying[key] = true
  useFriendChat.setState((s) => ({ typing: { ...s.typing, [key]: true }, seen: { ...s.seen, [key]: Date.now() } }))
  window.setTimeout(
    () => {
      const { profiles } = useProfiles.getState()
      const player = profiles.find((p) => p.id === from) ?? null
      const thread = (useFriendChat.getState().threads[key] ?? []).filter((m) => !m.invite)
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
        seen: { ...s.seen, [key]: Date.now() },
        threads: { ...s.threads, [key]: append(s.threads[key], message(bot, r.text, Date.now(), r.ask)) },
      }))
      const next = owed[key]
      owed[key] = undefined
      if (next) answer(next.from, bot, next.text)
    },
    1200 + Math.random() * 2200 + Math.min(2500, text.length * 25),
  )
}

/** A CPU friend says one of their own lines to `me` (about an invite), after typing for `delay` ms. */
export function botSays(me: string, bot: string, key: BotKey, delay = 1500 + Math.random() * 1500) {
  const k = threadKey(me, bot)
  const { profiles } = useProfiles.getState()
  const player = profiles.find((p) => p.id === me) ?? null
  const clan = clanOf(useClans.getState().clans, bot)
  const line = botLine(
    key,
    { botId: bot, player, place: { kind: 'dm', clan, friends: true }, profiles, now: Date.now() },
    playerLang(me),
  )
  if (delay > 0) typing(k, true)
  window.setTimeout(() => {
    useFriendChat.setState((s) => ({
      typing: { ...s.typing, [k]: replying[k] ? s.typing[k] : false },
      seen: { ...s.seen, [k]: Date.now() },
      threads: { ...s.threads, [k]: append(s.threads[k], message(bot, line.text, Date.now(), line.ask)) },
    }))
  }, delay)
  return line.text
}

/** The friend owes `from` an answer once they are back online (kept across reloads). */
export function owe(from: string, bot: string, invite = false, at = Date.now()) {
  const key = threadKey(from, bot)
  useFriendChat.setState((s) => {
    const was = s.pending[key]
    return {
      pending: {
        ...s.pending,
        [key]: { from, since: was?.since ?? at, ...(invite || was?.invite ? { invite: true } : {}) },
      },
    }
  })
}

/**
 * CPU friends who are back online read what was written to them while they were away (a little while after
 * they come on) and answer. Called every half minute while the game is open.
 */
export function checkPending(now = Date.now()) {
  const { pending } = useFriendChat.getState()
  for (const [key, p] of Object.entries(pending)) {
    const bot = otherIn(key, p.from)
    const me = useProfiles.getState().profiles.find((x) => x.id === p.from) ?? null
    if (!isBot(bot) || friendStatus(me, bot) !== 'friend') {
      useFriendChat.setState((s) => ({ pending: without(s.pending, key) }))
      continue
    }
    if (reading[key] || !isAvailable(bot, now)) continue
    reading[key] = true
    window.setTimeout(
      () => {
        reading[key] = false
        const cur = useFriendChat.getState().pending[key]
        if (!cur) return
        useFriendChat.setState((s) => ({ pending: without(s.pending, key), seen: { ...s.seen, [key]: Date.now() } }))
        if (cur.invite) botSays(cur.from, bot, 'inviteLate', 2000 + Math.random() * 1500)
        // the newest message they were sent while away
        const last = (useFriendChat.getState().threads[key] ?? []).findLast((m) => m.author === cur.from && !m.invite)
        if (last && last.at >= cur.since) window.setTimeout(() => answer(cur.from, bot, last.text), cur.invite ? 4000 : 0)
      },
      2000 + Math.random() * 18_000,
    )
  }
}

export const useFriendChat = create<FriendChatState>()(
  persist(
    (set, get) => ({
      threads: {},
      read: {},
      seen: {},
      pending: {},
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
        if (!isBot(to) || !botById(to) || friendStatus(me, to) !== 'friend') return
        // online friends answer now; the others when they are back (writing does not bring them online)
        if (isAvailable(to, m.at) && !get().pending[key]) answer(from, to, text)
        else owe(from, to, false, m.at)
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
      note: (n) => {
        const key = threadKey(n.by, n.to)
        // the sender of the invite writes "sent", "missed" and "cancelled"; the other side the answer
        const author = n.event === 'accepted' || n.event === 'declined' ? n.to : n.by
        const name =
          useProfiles.getState().profiles.find((p) => p.id === n.to)?.firstName ?? botById(n.to)?.name.split(' ')[0] ?? 'them'
        const m = { ...message(author, noteText(n, n.by, name)), invite: n }
        set((s) => ({ threads: { ...s.threads, [key]: append(s.threads[key], m) } }))
      },
      markRead: (me, other) => {
        const last = get().threads[threadKey(me, other)]?.at(-1)?.at ?? 0
        if ((get().read[readKey(me, other)] ?? 0) >= last) return
        set((s) => ({ read: { ...s.read, [readKey(me, other)]: last } }))
      },
      forget: (profileId) => {
        const keep = (k: string) => !k.split('|').includes(profileId)
        set((s) => ({
          threads: Object.fromEntries(Object.entries(s.threads).filter(([k]) => keep(k))),
          read: Object.fromEntries(Object.entries(s.read).filter(([k]) => !k.startsWith(`${profileId}>`))),
          seen: Object.fromEntries(Object.entries(s.seen).filter(([k]) => keep(k))),
          pending: Object.fromEntries(Object.entries(s.pending).filter(([k]) => keep(k))),
        }))
      },
      setFocus: (focus) => set({ focus }),
    }),
    {
      name: 'bakugan-dms',
      version: 1,
      partialize: (s) => ({ threads: s.threads, read: s.read, seen: s.seen, pending: s.pending }),
    },
  ),
)

/** Messages a player has not read yet from `other` (notes about the player's own invites aside: they saw those). */
export const unreadFrom = (s: Pick<FriendChatState, 'threads' | 'read'>, me: string, other: string) => {
  const seen = s.read[readKey(me, other)] ?? 0
  return (s.threads[threadKey(me, other)] ?? []).filter((m) => m.author !== me && m.at > seen && m.invite?.by !== me).length
}

/** When `other` last read the conversation with `me`: a CPU friend, or another player on this device. */
export const seenBy = (s: Pick<FriendChatState, 'seen' | 'read'>, me: string, other: string) =>
  isBot(other) ? (s.seen[threadKey(me, other)] ?? 0) : (s.read[readKey(other, me)] ?? 0)

/** Unread messages from all of a player's friends. */
export function useUnread(me: string | null | undefined, friends: string[]) {
  return useFriendChat((s) => (me ? friends.reduce((n, f) => n + unreadFrom(s, me, f), 0) : 0))
}

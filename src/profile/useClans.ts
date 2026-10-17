import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ElementId } from '../data/elements'
import { BOT_CLANS, botClanMembers, BOTS, isBot, type BotClan } from './bots'
import { chatLine, recruitedLine, replyTo, wantsReply, welcomeLine } from './clanChat'
import { useProfiles } from './useProfiles'

/**
 * Clans of brawlers with a shared chat, saved in this browser. The CPU clans (bots.ts) are always there and
 * open to join; players can also found their own and recruit free CPU brawlers into it. CPU members answer
 * in the chat now and then. Online clans with real players come with the server (PvP) update.
 */

export interface ClanMessage {
  id: string
  /** Profile id or bot id. */
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
  /** Player profile ids and bot ids ("bot-3"), longest-standing first. */
  members: string[]
  messages: ClanMessage[]
  /** A CPU clan: its bots come from bots.ts on every load; only its players and chat are saved. */
  cpu?: boolean
}

export type ClanInput = Pick<Clan, 'name' | 'tag' | 'element' | 'motto'>

const MAX_MESSAGES = 200

interface ClansState {
  clans: Clan[]
  /** Bots writing an answer right now, per clan id (not saved). */
  typing: Record<string, string[]>
  create: (founder: string, input: ClanInput) => string
  join: (clanId: string, profileId: string) => void
  leave: (profileId: string) => void
  kick: (clanId: string, memberId: string) => void
  send: (clanId: string, author: string, text: string) => void
  /** Adds a free CPU brawler to a player's clan; returns its id, or null when none is free. */
  recruit: (clanId: string) => string | null
  /** Now and then lets a CPU member say something on their own (called while the clan chat is open). */
  chatter: (clanId: string) => void
}

const playersIn = (c: Clan) => c.members.filter((m) => !isBot(m))

const without = (clans: Clan[], memberId: string) =>
  clans
    .map((c) => {
      if (!c.members.includes(memberId)) return c
      const members = c.members.filter((m) => m !== memberId)
      // leadership passes to the longest-standing player
      const leaderId = c.leaderId === memberId ? (members.find((m) => !isBot(m)) ?? members[0] ?? '') : c.leaderId
      return { ...c, members, leaderId }
    })
    // a player clan with no players left is disbanded (its bots are free again); CPU clans stay
    .filter((c) => c.cpu || playersIn(c).length > 0)

const message = (author: string, text: string, at = Date.now()): ClanMessage => ({
  id: `m${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  author,
  text: text.slice(0, 400),
  at,
})

const post = (clans: Clan[], clanId: string, m: ClanMessage) =>
  clans.map((c) => (c.id === clanId ? { ...c, messages: [...c.messages, m].slice(-MAX_MESSAGES) } : c))

const firstName = (profileId: string | null | undefined) =>
  useProfiles.getState().profiles.find((p) => p.id === profileId)?.firstName ?? 'brawler'

const randomBot = (clan: Clan, not?: string) => {
  const bots = clan.members.filter((m) => isBot(m) && m !== not)
  return bots.length ? bots[Math.floor(Math.random() * bots.length)] : null
}

/**
 * A bot "types" for a moment, then posts (if it is still in the clan). The line is picked when it posts,
 * knowing the chat's latest lines so it does not repeat one.
 */
function botSays(clanId: string, botId: string, line: (recent: string[]) => string, delay: number) {
  const typing = (fn: (ids: string[]) => string[]) =>
    useClans.setState((s) => ({ typing: { ...s.typing, [clanId]: fn(s.typing[clanId] ?? []) } }))
  typing((ids) => [...ids, botId])
  window.setTimeout(() => {
    typing((ids) => ids.filter((id) => id !== botId))
    const clan = useClans.getState().clans.find((c) => c.id === clanId)
    if (!clan?.members.includes(botId)) return
    const text = line(clan.messages.slice(-12).map((m) => m.text))
    useClans.setState((s) => ({ clans: post(s.clans, clanId, message(botId, text)) }))
  }, delay)
}

function cpuClan(c: BotClan): Clan {
  const members = botClanMembers(c.tag)
  return {
    id: `cpu-${c.tag}`,
    name: c.name,
    tag: c.tag,
    element: c.element,
    motto: c.motto,
    createdAt: new Date(`${c.founded}T00:00:00`).getTime(),
    leaderId: members[0],
    members,
    messages: [],
    cpu: true,
  }
}

/** A few recent lines so a CPU clan's chat is not empty the first time it is opened. */
function seedChat(clan: Clan): ClanMessage[] {
  const bots = clan.members.filter(isBot)
  const now = Date.now()
  const chat = [message(clan.leaderId, `Welcome to [${clan.tag}]! Be friendly, brawl hard, have fun.`, now - 26 * 3_600_000)]
  for (const [i, hours] of [5, 2.5, 0.8, 0.2].entries()) {
    const bot = bots[(i * 3 + 1) % bots.length]
    chat.push(
      message(bot, chatLine(bot, { name: 'everyone', tag: clan.tag, recent: chat.map((m) => m.text) }), now - hours * 3_600_000),
    )
  }
  return chat
}

/** The CPU clans (bots from bots.ts, players and chat from the save) followed by the players' own clans. */
function withCpuClans(saved: Clan[]): Clan[] {
  const clanBots = new Set(BOTS.filter((b) => b.clan).map((b) => b.id))
  const cpu = BOT_CLANS.map((bc) => {
    const fresh = cpuClan(bc)
    const old = saved.find((c) => c.id === fresh.id)
    const clan = { ...fresh, members: [...fresh.members, ...(old ? playersIn(old) : [])] }
    return { ...clan, messages: old?.messages.length ? old.messages : seedChat(clan) }
  })
  // a bot that belongs to a CPU clan cannot also be in a player's clan
  const own = saved.filter((c) => !c.cpu).map((c) => ({ ...c, members: c.members.filter((m) => !clanBots.has(m)) }))
  return [...cpu, ...own]
}

/** Answers waiting to be posted, per clan, so a burst of messages does not get a burst of replies. */
const pending: Record<string, number> = {}

export const useClans = create<ClansState>()(
  persist(
    (set, get) => ({
      clans: withCpuClans([]),
      typing: {},
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
      join: (clanId, profileId) => {
        set((s) => ({
          clans: without(s.clans, profileId).map((c) => (c.id === clanId ? { ...c, members: [...c.members, profileId] } : c)),
        }))
        const clan = get().clans.find((c) => c.id === clanId)
        const bot = clan && randomBot(clan)
        const ctx = { name: firstName(profileId), tag: clan?.tag ?? '' }
        if (bot) botSays(clanId, bot, (recent) => welcomeLine(bot, { ...ctx, recent }), 1500 + Math.random() * 1500)
      },
      leave: (profileId) => set((s) => ({ clans: without(s.clans, profileId) })),
      kick: (clanId, memberId) =>
        set((s) => ({
          clans: s.clans.map((c) => (c.id === clanId ? { ...c, members: c.members.filter((m) => m !== memberId) } : c)),
        })),
      send: (clanId, author, text) => {
        set((s) => ({ clans: post(s.clans, clanId, message(author, text)) }))
        const clan = get().clans.find((c) => c.id === clanId)
        if (!clan || isBot(author) || (pending[clanId] ?? 0) >= 2) return
        // CPU members answer now and then; greetings, questions and the like nearly always
        if (Math.random() > (wantsReply(text) ? 0.9 : 0.55)) return
        const ctx = { name: firstName(author), tag: clan.tag }
        const lastBot = [...clan.messages].reverse().find((m) => isBot(m.author))?.author
        const first = randomBot(clan, lastBot) ?? randomBot(clan)
        if (!first) return
        const answers: [string, (recent: string[]) => string, number][] = [
          [first, (recent) => replyTo(text, first, { ...ctx, recent }), 1300 + Math.random() * 2200],
        ]
        // sometimes a second member chimes in
        const second = Math.random() < 0.25 ? randomBot(clan, first) : null
        if (second) {
          const answer = Math.random() < 0.5
          const line = (recent: string[]) =>
            answer ? replyTo(text, second, { ...ctx, recent }) : chatLine(second, { ...ctx, recent })
          answers.push([second, line, 4000 + Math.random() * 3000])
        }
        for (const [bot, line, delay] of answers) {
          pending[clanId] = (pending[clanId] ?? 0) + 1
          botSays(clanId, bot, line, delay)
          window.setTimeout(() => (pending[clanId] -= 1), delay)
        }
      },
      recruit: (clanId) => {
        const clan = get().clans.find((c) => c.id === clanId && !c.cpu)
        if (!clan) return null
        const taken = new Set(get().clans.flatMap((c) => c.members))
        const free = BOTS.filter((b) => !b.clan && !taken.has(b.id))
        if (!free.length) return null
        const bot = free[Math.floor(Math.random() * free.length)].id
        set((s) => ({ clans: s.clans.map((c) => (c.id === clanId ? { ...c, members: [...c.members, bot] } : c)) }))
        const ctx = { name: firstName(clan.leaderId), tag: clan.tag }
        botSays(clanId, bot, (recent) => recruitedLine(bot, { ...ctx, recent }), 1200)
        return bot
      },
      chatter: (clanId) => {
        const clan = get().clans.find((c) => c.id === clanId)
        const last = clan?.messages.at(-1)
        if (!clan || (last && Date.now() - last.at < 45_000) || Math.random() > 0.35) return
        const bot = randomBot(clan, last?.author)
        const ctx = { name: firstName(useProfiles.getState().activeId), tag: clan.tag }
        if (bot) botSays(clanId, bot, (recent) => chatLine(bot, { ...ctx, recent }), 2000)
      },
    }),
    {
      name: 'bakugan-clans',
      version: 3,
      partialize: (s) => ({ clans: s.clans }),
      // v2: cleared together with the profiles their members belonged to
      // v3: the CPU clans joined the list (rebuilt from bots.ts on every load, see merge)
      migrate: (state, version) => (version < 2 ? { clans: [] } : (state as { clans: Clan[] })),
      merge: (saved, current) => ({ ...current, clans: withCpuClans((saved as { clans?: Clan[] } | undefined)?.clans ?? []) }),
    },
  ),
)

export const clanOf = (clans: Clan[], memberId: string | null | undefined) =>
  memberId ? (clans.find((c) => c.members.includes(memberId)) ?? null) : null

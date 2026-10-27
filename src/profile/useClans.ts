import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ElementId } from '../data/elements'
import { BOT_CLANS, botById, botClanMembers, isBot, type BotClan } from './bots'
import { botLine, toEveryone, type Ask } from './chatBrain'
import { addressee, asker, clanLang, clanLine, clanReply } from './clanChat'
import { advance, CATCH_UP, freeBots, keepAway, MAX_MEMBERS, STEP, systemLine } from './clanLife'
import { botXp } from './clanStats'
import { useProfiles } from './useProfiles'

/**
 * Clans of brawlers with a shared chat, saved in this browser. The CPU clans (bots.ts) are always there and
 * open to join; players can also found their own. CPU brawlers ask to join players' clans, come and go
 * (clanLife.ts) and answer in the chat. Online clans with real players come with the server (PvP) update.
 */

export interface ClanMessage {
  id: string
  /** Profile id or bot id. */
  author: string
  text: string
  at: number
  /** A line about the clan itself ("Sam joined the clan."), not something a member said. */
  system?: boolean
  /** A CPU member's question ("When?"), so the player's short answer to it is understood. */
  ask?: Ask
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
  /** A CPU clan: open to everyone, its name and look come from bots.ts. */
  cpu?: boolean
  /** A player's clan: CPU brawlers join without asking (otherwise they send a request). */
  open?: boolean
  /** CPU brawlers waiting for an answer to their join request. */
  requests?: { id: string; at: number }[]
  /** When each member joined (members from before this was saved have none). */
  since?: Record<string, number>
  /** CPU brawlers who lately left, were removed or turned down, and when: they keep away for a few days. */
  away?: Record<string, number>
  /** Clan XP banked: the players' brawls, and what members who left earned (CPU members' own is worked out). */
  xp?: number
  /** Members the leader made officers (CPU clans: their two longest-standing members when unset). */
  officers?: string[]
  /** The badge's look; the attribute's colour and a hexagon when unset. */
  emblem?: { shape?: 'hex' | 'shield' | 'circle' | 'star' | 'crown'; color?: string }
}

export type ClanRole = 'leader' | 'officer' | 'member'

export const officersOf = (c: Clan) =>
  c.officers ?? (c.cpu ? c.members.filter((m) => m !== c.leaderId && isBot(m)).slice(0, 2) : [])

export const roleOf = (c: Clan, id: string): ClanRole =>
  c.leaderId === id ? 'leader' : officersOf(c).includes(id) ? 'officer' : 'member'

export type ClanInput = Pick<Clan, 'name' | 'tag' | 'element' | 'motto'>

const MAX_MESSAGES = 200

interface ClansState {
  clans: Clan[]
  /** Clan life has been played up to here (a step boundary; 0 = not yet). */
  simAt: number
  /** Bots writing an answer right now, per clan id (not saved). */
  typing: Record<string, string[]>
  create: (founder: string, input: ClanInput) => string
  join: (clanId: string, profileId: string) => void
  leave: (profileId: string) => void
  kick: (clanId: string, memberId: string) => void
  send: (clanId: string, author: string, text: string) => void
  /** Adds a free CPU brawler to a player's clan; returns its id, or null when none is free. */
  recruit: (clanId: string) => string | null
  /** Takes in (or turns down) a CPU brawler's join request; false when they are no longer free. */
  answerRequest: (clanId: string, botId: string, accept: boolean) => boolean
  /** Open: CPU brawlers join without asking (and the waiting requests are taken in). */
  setOpen: (clanId: string, open: boolean) => void
  /** Plays clan life up to `now`: the time away (capped), then what happened since the last call. */
  simulate: (now: number) => void
  /** Now and then lets a CPU member say something on their own (called while the clan chat is open). */
  chatter: (clanId: string) => void
  /** The leader makes a member an officer, or an officer a member again. */
  setRole: (clanId: string, memberId: string, role: 'officer' | 'member') => void
  /** The leader changes the badge or the motto. */
  customise: (clanId: string, patch: Pick<Clan, 'emblem'> | Pick<Clan, 'motto'>) => void
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

const message = (author: string, text: string, at = Date.now(), ask?: Ask): ClanMessage => ({
  id: `m${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  author,
  text: text.slice(0, 400),
  at,
  ...(ask ? { ask } : {}),
})

/** Adds a message in time order (lines from catching up can be older than the newest one). */
function postTo(c: Clan, m: ClanMessage): Clan {
  const messages = [...c.messages]
  let i = messages.length
  while (i > 0 && messages[i - 1].at > m.at) i--
  messages.splice(i, 0, m)
  return { ...c, messages: messages.slice(-MAX_MESSAGES) }
}

const post = (clans: Clan[], clanId: string, m: ClanMessage) => clans.map((c) => (c.id === clanId ? postTo(c, m) : c))

const firstName = (profileId: string | null | undefined) =>
  useProfiles.getState().profiles.find((p) => p.id === profileId)?.firstName ?? 'brawler'

const randomBot = (clan: Clan, not?: string) => {
  const bots = clan.members.filter((m) => isBot(m) && m !== not)
  return bots.length ? bots[Math.floor(Math.random() * bots.length)] : null
}

/** The chat's latest lines that members said (not the clan's own notices). */
const said = (clan: Clan) => clan.messages.filter((m) => !m.system)

type Said = { text: string; ask?: Ask }

/**
 * A bot "types" for a moment, then posts (if it is still in the clan). The line is picked when it posts,
 * knowing the chat as it is then (so it does not repeat a line).
 */
function botSays(clanId: string, botId: string, line: (clan: Clan, recent: string[]) => Said, delay: number, done?: () => void) {
  const typing = (fn: (ids: string[]) => string[]) =>
    useClans.setState((s) => ({ typing: { ...s.typing, [clanId]: fn(s.typing[clanId] ?? []) } }))
  typing((ids) => [...ids, botId])
  window.setTimeout(() => {
    typing((ids) => ids.filter((id) => id !== botId))
    const clan = useClans.getState().clans.find((c) => c.id === clanId)
    if (clan?.members.includes(botId)) {
      const said = line(
        clan,
        clan.messages.slice(-12).map((m) => m.text),
      )
      useClans.setState((s) => ({ clans: post(s.clans, clanId, message(botId, said.text, Date.now(), said.ask)) }))
    }
    done?.()
  }, delay)
}

/** Answers being typed per clan, and the newest message still owed one when two were already on the way. */
const replying: Record<string, number> = {}
const owed: Record<string, { author: string; text: string } | undefined> = {}

/**
 * CPU members answer every player message, about what it says: the member it is addressed to by name, else
 * the one whose question it answers, else someone who did not speak last, after a short typing delay. A
 * message to everyone ("salam hamıya", "who wants to brawl?") may get a second answer. A burst of messages
 * gets at most two answers on the way at once, and then one more to the newest message.
 */
function answer(clanId: string, author: string, text: string) {
  const clan = useClans.getState().clans.find((c) => c.id === clanId)
  const bots = clan?.members.filter(isBot) ?? []
  if (!clan || !bots.length) return
  if ((replying[clanId] ?? 0) >= 2) {
    owed[clanId] = { author, text }
    return
  }
  const lastBot = [...said(clan)].reverse().find((m) => isBot(m.author))?.author
  const asked = asker(clan)
  const first = addressee(text, bots) ?? (asked && bots.includes(asked) ? asked : null) ?? randomBot(clan, lastBot) ?? bots[0]
  const say = (bot: string, delay: number) => {
    replying[clanId] = (replying[clanId] ?? 0) + 1
    botSays(
      clanId,
      bot,
      (now) => clanReply(now, bot, author, text),
      delay,
      () => {
        replying[clanId] -= 1
        const next = owed[clanId]
        owed[clanId] = undefined
        if (next) answer(clanId, next.author, next.text)
      },
    )
  }
  say(first, 1300 + Math.random() * 2000)
  const second = !addressee(text, bots) && toEveryone(text) && Math.random() < 0.6 ? randomBot(clan, first) : null
  if (second) say(second, 4000 + Math.random() * 3000)
}

/** A line a bot says by itself, in the language the players write in. */
const own =
  (key: 'chatter' | 'welcome' | 'recruited' | 'joined' | 'promoted', botId: string, name: string) =>
  (clan: Clan, recent: string[]): Said =>
    clanLine(key, clan, botId, name, recent, clanLang(clan, useClans.getState().clans))

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
    const line = botLine(
      'chatter',
      {
        botId: bot,
        player: null,
        place: { kind: 'clan', clan, friends: false },
        profiles: [],
        now,
        recent: chat.map((m) => m.text),
      },
      'en',
    )
    chat.push(message(bot, line.text, now - hours * 3_600_000))
  }
  return chat
}

/**
 * The CPU clans (look from bots.ts, members and chat from the save, or their starting bots) followed by
 * the players' own clans. Nobody is in two clans: a duplicate stays in the first one.
 */
function withCpuClans(saved: Clan[]): Clan[] {
  const seen = new Set<string>()
  const once = (id: string) => (isBot(id) ? !!botById(id) : true) && !seen.has(id) && !!seen.add(id)
  const cpu = BOT_CLANS.map((bc) => {
    const fresh = cpuClan(bc)
    const old = saved.find((c) => c.id === fresh.id)
    const members = (old?.members ?? fresh.members).filter(once)
    const leaderId = members.includes(old?.leaderId ?? '') ? old!.leaderId : (members.find(isBot) ?? fresh.leaderId)
    const clan = { ...fresh, members, leaderId, since: old?.since, xp: old?.xp, officers: old?.officers, emblem: old?.emblem }
    return { ...clan, messages: old?.messages.length ? old.messages : seedChat(clan) }
  })
  const own = saved.filter((c) => !c.cpu).map((c) => ({ ...c, members: c.members.filter(once) }))
  return [...cpu, ...own.filter((c) => playersIn(c).length > 0)]
}

export const useClans = create<ClansState>()(
  persist(
    (set, get) => ({
      clans: withCpuClans([]),
      simAt: 0,
      typing: {},
      create: (founder, input) => {
        const now = Date.now()
        const id = `c${now.toString(36)}`
        set((s) => ({
          clans: [
            ...without(s.clans, founder),
            { ...input, id, createdAt: now, leaderId: founder, members: [founder], messages: [], since: { [founder]: now } },
          ],
        }))
        return id
      },
      join: (clanId, profileId) => {
        set((s) => ({
          clans: without(s.clans, profileId).map((c) =>
            c.id === clanId ? { ...c, members: [...c.members, profileId], since: { ...c.since, [profileId]: Date.now() } } : c,
          ),
        }))
        const clan = get().clans.find((c) => c.id === clanId)
        const bot = clan && randomBot(clan)
        if (bot) botSays(clanId, bot, own('welcome', bot, firstName(profileId)), 1500 + Math.random() * 1500)
      },
      leave: (profileId) => set((s) => ({ clans: without(s.clans, profileId) })),
      kick: (clanId, memberId) =>
        set((s) => ({
          clans: s.clans.map((c) =>
            c.id !== clanId
              ? c
              : postTo(
                  keepAway(
                    {
                      ...c,
                      members: c.members.filter((m) => m !== memberId),
                      officers: officersOf(c).filter((m) => m !== memberId),
                      // what they earned for the clan stays with it
                      xp: (c.xp ?? 0) + (isBot(memberId) ? botXp(c, memberId, Date.now()) : 0),
                    },
                    memberId,
                    Date.now(),
                  ),
                  systemLine(
                    memberId,
                    `${botById(memberId)?.name ?? firstName(memberId)} was removed from the clan.`,
                    Date.now(),
                  ),
                ),
          ),
        })),
      send: (clanId, author, text) => {
        set((s) => ({ clans: post(s.clans, clanId, message(author, text)) }))
        if (!isBot(author)) answer(clanId, author, text)
      },
      recruit: (clanId) => {
        const clan = get().clans.find((c) => c.id === clanId && !c.cpu)
        if (!clan || clan.members.length >= MAX_MEMBERS) return null
        const free = freeBots(get().clans)
        if (!free.length) return null
        const bot = free[Math.floor(Math.random() * free.length)].id
        set((s) => ({
          clans: s.clans.map((c) =>
            c.id === clanId
              ? {
                  ...c,
                  members: [...c.members, bot],
                  since: { ...c.since, [bot]: Date.now() },
                  requests: c.requests?.filter((r) => r.id !== bot),
                }
              : c,
          ),
        }))
        botSays(clanId, bot, own('recruited', bot, firstName(clan.leaderId)), 1200)
        return bot
      },
      answerRequest: (clanId, botId, accept) => {
        const clan = get().clans.find((c) => c.id === clanId)
        if (!clan) return false
        const ok = accept && freeBots(get().clans).some((b) => b.id === botId) && clan.members.length < MAX_MEMBERS
        const now = Date.now()
        set((s) => ({
          clans: s.clans.map((c) => {
            if (c.id !== clanId) return c
            const next = { ...c, requests: c.requests?.filter((r) => r.id !== botId) }
            // turned down (or gone elsewhere meanwhile): they will not ask again for a few days
            if (!ok) return keepAway(next, botId, now)
            const joined = { ...next, members: [...c.members, botId], since: { ...c.since, [botId]: now } }
            return postTo(joined, systemLine(botId, `${botById(botId)?.name} joined the clan.`, now))
          }),
        }))
        if (ok) botSays(clanId, botId, own('joined', botId, firstName(clan.leaderId)), 1500 + Math.random() * 1500)
        return ok
      },
      setOpen: (clanId, open) => {
        set((s) => ({ clans: s.clans.map((c) => (c.id === clanId ? { ...c, open } : c)) }))
        if (open)
          for (const r of get().clans.find((c) => c.id === clanId)?.requests ?? []) get().answerRequest(clanId, r.id, true)
      },
      simulate: (now) => {
        const { clans, simAt } = get()
        const to = Math.floor(now / STEP) * STEP
        // the first run starts the clock; after that, the time away is played (up to CATCH_UP)
        if (!simAt) return set({ simAt: to })
        const from = Math.max(simAt, to - CATCH_UP)
        if (to <= from) return
        const life = advance(clans, from, to, postTo)
        set({ clans: life.clans, simAt: to })
        // newcomers say hello: live ones type it now, ones from the time away said it back then
        for (const j of life.joined) {
          const clan = get().clans.find((c) => c.id === j.clanId)
          if (!clan) continue
          const line = own('joined', j.botId, clan.cpu ? 'everyone' : firstName(clan.leaderId))
          if (now - j.at < 5 * 60_000) botSays(j.clanId, j.botId, line, 2500)
          else
            set((s) => ({
              clans: post(s.clans, j.clanId, message(j.botId, line(clan, []).text, Math.min(now, j.at + 90_000))),
            }))
        }
      },
      chatter: (clanId) => {
        const clan = get().clans.find((c) => c.id === clanId)
        const last = clan?.messages.at(-1)
        if (!clan || (last && Date.now() - last.at < 45_000) || Math.random() > 0.35) return
        const bot = randomBot(clan, last?.author)
        if (bot) botSays(clanId, bot, own('chatter', bot, firstName(useProfiles.getState().activeId)), 2000)
      },
      setRole: (clanId, memberId, role) => {
        const now = Date.now()
        set((s) => ({
          clans: s.clans.map((c) => {
            if (c.id !== clanId || !c.members.includes(memberId) || c.leaderId === memberId) return c
            const officers = officersOf(c).filter((m) => m !== memberId)
            const name = botById(memberId)?.name ?? firstName(memberId)
            return postTo(
              { ...c, officers: role === 'officer' ? [...officers, memberId] : officers },
              systemLine(memberId, role === 'officer' ? `${name} was made an officer.` : `${name} is a member again.`, now),
            )
          }),
        }))
        // a CPU member thanks the leader for the trust
        const clan = get().clans.find((c) => c.id === clanId)
        if (clan && role === 'officer' && isBot(memberId))
          botSays(clanId, memberId, own('promoted', memberId, firstName(clan.leaderId)), 1800)
      },
      customise: (clanId, patch) => set((s) => ({ clans: s.clans.map((c) => (c.id === clanId ? { ...c, ...patch } : c)) })),
    }),
    {
      name: 'bakugan-clans',
      version: 5,
      partialize: (s) => ({ clans: s.clans, simAt: s.simAt }),
      // v2: cleared together with the profiles their members belonged to
      // v3: the CPU clans joined the list (rebuilt from bots.ts on every load, see merge)
      // v4: CPU clans' members are saved too (they come and go), plus join requests, the open setting, who
      //     keeps away and the time clan life was played to; v3 saves already hold the members, so they carry over
      // (a message's optional `ask` came later: older messages simply have none, so no new version)
      // v5: clan XP, officers and the badge's look (all optional: older clans start at their CPU members' XP, with
      //     no officers and the attribute's badge), so the v4 save carries over as it is
      migrate: (state, version) => (version < 2 ? { clans: [], simAt: 0 } : (state as { clans: Clan[]; simAt?: number })),
      merge: (saved, current) => {
        const s = saved as { clans?: Clan[]; simAt?: number } | undefined
        return { ...current, clans: withCpuClans(s?.clans ?? []), simAt: s?.simAt ?? 0 }
      },
    },
  ),
)

export const clanOf = (clans: Clan[], memberId: string | null | undefined) =>
  memberId ? (clans.find((c) => c.members.includes(memberId)) ?? null) : null

export { freeBots, MAX_MEMBERS }

/**
 * Keeps clan life going while a clans screen is open: catches up on mount, then plays on every 30–90 s.
 */
export function useClanLife() {
  useEffect(() => {
    const run = () => useClans.getState().simulate(Date.now())
    run()
    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          run()
          next()
        },
        30_000 + Math.random() * 60_000,
      )
    }
    next()
    return () => clearTimeout(timer)
  }, [])
}

import { botById } from './bots'
import { botLine, convoLang, fold, reply, type Ask, type ChatClan, type Lang, type Turn } from './chatBrain'
import { friendStatus, useProfiles } from './useProfiles'

/**
 * The clan chat side of the CPU brawlers' talk (the answers themselves come from chatBrain.ts): who in the
 * clan a message is for, what the chat said so far, and the language to answer in.
 */

export type { Ask, Lang }

/** What a clan chat needs to know for an answer. */
export interface ClanChatView extends ChatClan {
  messages: { author: string; text: string; at: number; system?: boolean; ask?: Ask }[]
}

/** Why a CPU member leaves a clan, for the line in the chat. */
const LEAVE_REASONS = [
  'taking a break from brawling',
  'wants to brawl solo for a while',
  'is training alone for the next season',
  'left to start over with a new team',
]

/** The clan member a message is addressed to by first name ("Sam, brawl?"), if any. */
export function addressee(text: string, memberIds: string[]) {
  const t = fold(text)
  return memberIds.find((id) => {
    const first = botById(id)?.name.split(' ')[0]
    return !!first && new RegExp(`(?<![\\p{L}\\p{N}])${fold(first)}(?![\\p{L}\\p{N}])`, 'u').test(t)
  })
}

/** The lines members said before the player's message (not the clan's own notices), for the reply engine. */
function before(clan: ClanChatView, author: string, text: string): Turn[] {
  const lines = clan.messages.filter((m) => !m.system)
  let i = lines.length - 1
  while (i >= 0 && !(lines[i].author === author && lines[i].text === text)) i--
  return lines
    .slice(0, i < 0 ? lines.length : i)
    .slice(-16)
    .map((m) => ({ author: m.author, text: m.text, ask: m.ask }))
}

/** The language the players write in here: their newest clear message in this clan, else in any of `all`. */
export function clanLang(clan: ClanChatView, all: ClanChatView[] = []): Lang {
  const said = (c: ClanChatView) => c.messages.filter((m) => !m.system && !botById(m.author))
  const here = convoLang(said(clan).map((m) => m.text))
  if (here) return here
  const everywhere = all
    .flatMap(said)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.text)
  return convoLang(everywhere) ?? 'en'
}

/** A CPU member's answer to a player's message in the clan chat. */
export function clanReply(clan: ClanChatView, botId: string, author: string, text: string) {
  const { profiles } = useProfiles.getState()
  const player = profiles.find((p) => p.id === author) ?? null
  return reply({
    text,
    botId,
    player,
    place: { kind: 'clan', clan, friends: friendStatus(player, botId) === 'friend' },
    history: before(clan, author, text),
    profiles,
    now: Date.now(),
  })
}

/** The bot who asked the player something lately, if the player has not been answered since. */
export function asker(clan: ClanChatView) {
  const lines = clan.messages.filter((m) => !m.system).slice(-5)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i]
    if (botById(m.author)) return m.ask ? m.author : undefined
  }
  return undefined
}

/** Something a CPU member says on their own, in the players' language. */
export function clanLine(
  key: 'chatter' | 'welcome' | 'recruited' | 'joined' | 'promoted',
  clan: ClanChatView,
  botId: string,
  name: string,
  recent: string[],
  lang: Lang,
) {
  const { profiles } = useProfiles.getState()
  return botLine(
    key,
    { botId, player: null, place: { kind: 'clan', clan, friends: false }, profiles, now: Date.now(), recent, name },
    lang,
  )
}

/** Why a member left, picked by the seeded roll `r` in [0, 1). */
export const leaveReason = (r: number) => LEAVE_REASONS[Math.floor(r * LEAVE_REASONS.length)]

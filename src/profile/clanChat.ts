import { BAKUGAN } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { botById, botTeam } from './bots'

/** Canned clan chat for CPU members: short, friendly and Bakugan-themed. No network involved. */

type Kind = 'greet' | 'thanks' | 'question' | 'shop' | 'brawl' | 'win' | 'loss' | 'tip' | 'mention' | 'chat'

const LINES: Record<Kind | 'welcome' | 'recruited', string[]> = {
  welcome: [
    'Welcome to [{tag}], {name}! Glad to have you.',
    'A new brawler! Welcome aboard, {name}.',
    'Hey {name}, welcome! Ready to brawl with us?',
    'Welcome, {name}! {bakugan} says hi too.',
    'Nice, fresh power for [{tag}]. Welcome, {name}!',
  ],
  recruited: [
    'Thanks for the invite, {name}! Let’s brawl.',
    'Joined up! {bakugan} and I are ready.',
    'Happy to be here. Who wants a training brawl?',
  ],
  greet: [
    'Hey {name}! Ready to brawl?',
    'Yo {name}! Good to see you.',
    'Hi {name}! {bakugan} is fired up today.',
    'Hello! How are your Bakugan doing?',
    'Hey hey! Gate Card, set! 👋',
  ],
  thanks: ['Anytime!', 'No problem, that’s what clans are for.', 'You got it, {name}.', 'Happy to help! 🙌'],
  question: [
    'Good question… I’d build the team around your own attribute first.',
    'Not sure, but Drago would just charge right in!',
    'Hmm, ask me again after my next brawl 😄',
    'Depends on your team. What’s your lead Bakugan?',
    'Try it in a brawl and tell us how it goes!',
    'Ooh, tough one. Anyone else know?',
  ],
  shop: [
    'Bakugan of your own attribute are the cheapest in the shop.',
    'The shop has new picks every day, worth a look!',
    'A Card Key is never a bad buy.',
    'XP Boosts are great if you brawl a lot.',
    'I’m saving my BP for a new Bakugan myself.',
  ],
  brawl: [
    'Bakugan, brawl! I’m in.',
    'Up for a brawl anytime. {bakugan} needs the XP!',
    'Let’s go! Field open!',
    'Brawl time! Don’t hold back.',
    'I’ll be watching your next brawl, {name}. Make it count.',
  ],
  win: [
    'GG! Nice win, {name}!',
    'That’s how a Battle Brawler does it!',
    'Huge! [{tag}] keeps climbing 🔥',
    'Great brawl! Keep that streak going.',
  ],
  loss: [
    'Happens to the best of us. Next one’s yours!',
    'Shake it off, {name}. Even Drago loses sometimes.',
    'Tough one. Try a different Gate Card next time?',
    'Every loss is XP for your Bakugan. Keep going!',
  ],
  tip: [
    'Tip: Bakugan of your own attribute are cheaper in the shop.',
    'Tip: Card Keys unlock an ability card right away.',
    'Tip: save XP Boosts for a long brawl session.',
    'Tip: daily challenges are the fastest way up the Season Pass.',
    'Tip: evolve your lead Bakugan first, it carries the team.',
  ],
  mention: [
    '{mention}? Great pick!',
    'I love {mention}. So strong.',
    '{mention} is a beast in the arena.',
    'Ooh, {mention}! Nice.',
  ],
  chat: [
    'Gate Card, set!',
    'Who’s up for a training brawl?',
    'Just got a new ability card for {bakugan}!',
    'Season Pass grind is real today 😅',
    'Anyone else saving BP for a new Bakugan?',
    'Ability card, activate! …sorry, practising.',
    '{element} power! 💪',
    '{bakugan}, stand!',
    'Almost ready to evolve {bakugan}. So close!',
    'GG to everyone brawling today.',
    'Clan brawl night later? [{tag}] for the win.',
    'My win streak is on fire 🔥',
  ],
}

const NAMES = [...new Set(BAKUGAN.map((b) => b.name))].sort((a, b) => b.length - a.length)

function kindOf(text: string): { kind: Kind; mention?: string } {
  const t = text.toLowerCase()
  const mention = NAMES.find((n) => new RegExp(`\\b${n.toLowerCase()}\\b`).test(t))
  if (/\b(thanks|thank you|thx|ty)\b/.test(t)) return { kind: 'thanks' }
  if (/\b(hi|hello|hey|yo|hiya|salam|hola|sup)\b/.test(t)) return { kind: 'greet' }
  if (/\b(won|win|wins|gg|victory|evolved)\b/.test(t)) return { kind: 'win' }
  if (/\b(lost|lose|loss|losing)\b/.test(t)) return { kind: 'loss' }
  if (/\b(buy|shop|bp|price|prices|cost|skin|skins)\b/.test(t)) return { kind: 'shop' }
  if (/\b(tip|tips|help|advice|how)\b/.test(t)) return { kind: 'tip' }
  if (mention) return { kind: 'mention', mention }
  if (/\b(brawl|battle|fight|duel|match|play)\b/.test(t)) return { kind: 'brawl' }
  if (t.includes('?')) return { kind: 'question' }
  return { kind: 'chat' }
}

interface Ctx {
  name: string
  tag: string
  /** Recent chat lines, so a bot does not repeat one. */
  recent?: string[]
}

function fill(line: string, botId: string, ctx: Ctx & { mention?: string }) {
  const bot = botById(botId)
  const lead = bot ? BAKUGAN.find((b) => b.id === botTeam(bot)[0]?.id) : undefined
  return line
    .replaceAll('{name}', ctx.name)
    .replaceAll('{tag}', ctx.tag)
    .replaceAll('{mention}', ctx.mention ?? 'That one')
    .replaceAll('{bakugan}', lead?.name ?? 'my Bakugan')
    .replaceAll('{element}', bot ? ELEMENT_BY_ID[bot.element].name : 'Bakugan')
}

/** A random line of the list, filled in, that was not said lately (when there is one). */
function say(list: string[], botId: string, ctx: Ctx & { mention?: string }) {
  const lines = list.map((l) => fill(l, botId, ctx))
  const fresh = lines.filter((l) => !ctx.recent?.includes(l))
  const pool = fresh.length ? fresh : lines
  return pool[Math.floor(Math.random() * pool.length)]
}

/** A CPU member's answer to a player's message. */
export function replyTo(text: string, botId: string, ctx: Ctx) {
  const { kind, mention } = kindOf(text)
  return say(LINES[kind], botId, { ...ctx, mention })
}

/** Whether the message is worth an answer (anything but small talk always gets one). */
export const wantsReply = (text: string) => kindOf(text).kind !== 'chat'

/** Something a CPU member says on their own. */
export const chatLine = (botId: string, ctx: Ctx) => say(LINES.chat, botId, ctx)
export const welcomeLine = (botId: string, ctx: Ctx) => say(LINES.welcome, botId, ctx)
export const recruitedLine = (botId: string, ctx: Ctx) => say(LINES.recruited, botId, ctx)

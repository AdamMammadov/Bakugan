import { BAKUGAN } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { botById, botTeam } from './bots'

/** Canned clan chat for CPU members: short, friendly and Bakugan-themed. No network involved. */

type Kind =
  | 'greet'
  | 'mood'
  | 'bye'
  | 'newbie'
  | 'thanks'
  | 'laugh'
  | 'agree'
  | 'question'
  | 'shop'
  | 'brawl'
  | 'win'
  | 'loss'
  | 'tip'
  | 'mention'
  | 'chat'

const LINES: Record<Kind | 'welcome' | 'recruited' | 'joined', string[]> = {
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
  joined: [
    'Hi everyone! Happy to be in [{tag}] 👋',
    'Thanks for having me, {name}! {bakugan} and I are ready.',
    'Hey all! Looking forward to brawling with you.',
    'Hello [{tag}]! Who’s up for a training brawl?',
  ],
  greet: [
    'Hey {name}! Ready to brawl?',
    'Yo {name}! Good to see you.',
    'Hi {name}! {bakugan} is fired up today.',
    'Hello! How are your Bakugan doing?',
    'Hey hey! Gate Card, set! 👋',
  ],
  mood: [
    'All good! {bakugan} and I just finished a training brawl. You?',
    'Great, thanks! Ready for the next brawl.',
    'Pretty good! Grinding the Season Pass. How about you, {name}?',
    'Doing fine! Still buzzing from my last win 😄',
  ],
  newbie: [
    'Welcome, {name}! Ask us anything.',
    'Nice to meet you, {name}! Want a training brawl to warm up?',
    'Welcome aboard! Tip: daily challenges level the Season Pass fast.',
  ],
  bye: ['See you, {name}!', 'Later! Brawl hard.', 'Bye {name}, good luck out there!', 'Catch you next brawl 👋'],
  thanks: ['Anytime!', 'No problem, that’s what clans are for.', 'You got it, {name}.', 'Happy to help! 🙌'],
  laugh: ['😄', 'Haha, true!', 'LOL 😂', 'Haha, {bakugan} would agree.'],
  agree: ['👍', 'Sounds good!', 'Deal!', 'Let’s do it, {name}.'],
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

/** Why a CPU member leaves a clan, for the line in the chat. */
const LEAVE_REASONS = [
  'taking a break from brawling',
  'wants to brawl solo for a while',
  'is training alone for the next season',
  'left to start over with a new team',
]

/** Matches any of the "|"-separated words as a whole word, in any script (so "salam" and "döyüş" work too). */
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${list})(?![\\p{L}\\p{N}])`, 'iu')

// English, plus Azerbaijani, Turkish and Russian, which players here write in (the bots answer in English)
const KINDS: [Kind, RegExp][] = [
  [
    'mood',
    words(
      "how are you|how r u|how is it going|how[’']s it going|what[’']s up|wassup|sup|necəsən|necəsiz|necesen|necesiz|nə var nə yox|nasılsın|как дела",
    ),
  ],
  [
    'thanks',
    words(
      'thanks|thank you|thx|ty|sa[gğ] ?ol\\p{L}*|çox sağ ol\\p{L}*|təşəkkür\\p{L}*|tesekkur\\p{L}*|teşekkür\\p{L}*|merci|mersi|спасибо',
    ),
  ],
  ['bye', words('bye|goodbye|see you|see ya|cya|good night|gn|hələlik|helelik|görüşərik|gorusherik|gecən xeyrə|пока')],
  [
    'newbie',
    words("i[’']?m new|new here|just joined|first time|yeni gəlmişəm|yeniyəm|yeni üzv|təzə gəlmişəm|yeniyim|я новенький"),
  ],
  ['greet', words('hi|hello|hey|yo|hiya|salam|salamlar|sabahın xeyir|günaydın|hola|merhaba|привет|здравствуйте')],
  ['win', words('won|win|wins|gg|victory|evolved|qalib|qazandım|uddum|udmuşam|kazandım|победил\\p{L}*')],
  ['loss', words('lost|lose|loss|losing|uduzdum|uduzuram|məğlub|kaybettim|проиграл\\p{L}*')],
  ['shop', words('buy|shop|bp|price|prices|cost|skin|skins|mağaza|magaza|almaq|alım|qiymət|qiymet|pul|магазин')],
  ['tip', words('tip|tips|help|advice|how|kömək|komek|məsləhət|meslehet|necə|nece|yardım|помощь|помоги\\p{L}*')],
  ['laugh', words('haha\\p{L}*|hehe\\p{L}*|lol|lmao|xd|😂|🤣|😄')],
  ['agree', words('ok|okay|yes|yeah|sure|deal|bəli|hə|oldu|tamam|yaxşı|да|ок')],
  ['brawl', words('brawl\\p{L}*|battle|fight|duel|match|play|döyüş\\p{L}*|doyus\\p{L}*|oyna\\p{L}*|savaş\\p{L}*|бой|играть')],
]
/** The kinds checked before a Bakugan name in the message counts as talking about that Bakugan. */
const FIRST_KINDS = 9

const NAMES = [...new Set(BAKUGAN.map((b) => b.name))]
  .sort((a, b) => b.length - a.length)
  .map((n) => [n, words(n.toLowerCase())] as const)

function kindOf(text: string): { kind: Kind; mention?: string } {
  const t = text.toLowerCase()
  const mention = NAMES.find(([, re]) => re.test(t))?.[0]
  for (const [kind, re] of KINDS.slice(0, FIRST_KINDS)) if (re.test(t)) return { kind }
  if (mention) return { kind: 'mention', mention }
  for (const [kind, re] of KINDS.slice(FIRST_KINDS)) if (re.test(t)) return { kind }
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
  // small talk the bots cannot place still gets a friendly line
  return say(LINES[kind === 'chat' ? (Math.random() < 0.5 ? 'agree' : 'chat') : kind], botId, { ...ctx, mention })
}

/** The clan member a message is addressed to by first name ("Sam, brawl?"), if any. */
export function addressee(text: string, memberIds: string[]) {
  return memberIds.find((id) => {
    const first = botById(id)?.name.split(' ')[0]
    return !!first && words(first.toLowerCase()).test(text.toLowerCase())
  })
}

/** Something a CPU member says on their own. */
export const chatLine = (botId: string, ctx: Ctx) => say(LINES.chat, botId, ctx)
export const welcomeLine = (botId: string, ctx: Ctx) => say(LINES.welcome, botId, ctx)
export const recruitedLine = (botId: string, ctx: Ctx) => say(LINES.recruited, botId, ctx)
/** What a CPU brawler says after joining a clan on their own. */
export const joinedLine = (botId: string, ctx: Ctx) => say(LINES.joined, botId, ctx)
/** Why a member left, picked by the seeded roll `r` in [0, 1). */
export const leaveReason = (r: number) => LEAVE_REASONS[Math.floor(r * LEAVE_REASONS.length)]

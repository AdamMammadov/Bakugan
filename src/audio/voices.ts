import { CHARACTERS, type Voice } from '../profile/avatar'

/**
 * Who sounds like what. Every speaker (each brawler, every CPU brawler, the announcer) gets a browser voice of its
 * own when the system has enough English voices (US, UK, Australian, Indian, Irish … all count), and always a pitch
 * and pace of its own. The choice is fixed by the speaker's identity and the system's voice list, so a character
 * sounds the same every time. With few voices, speakers that share one are spread apart in pitch and pace.
 */

/** A brawler's voice, optionally with who is speaking (a character id or a brawler's name), so it gets its own. */
export type SpeakerVoice = Voice & { id?: string; name?: string }

/** What a line is spoken with. */
export interface Delivery {
  voice?: SpeechSynthesisVoice
  pitch: number
  rate: number
}

/** The part of a system voice the choice depends on (lets the plan be tried with any voice list). */
export interface VoiceInfo {
  name: string
  lang: string
  default?: boolean
}

interface Profile {
  female: boolean
  pitch: number
  rate: number
  /** Voices that suit the speaker, best first (name or language patterns). */
  prefer: RegExp[]
}

/** The announcer: a big, quick, low male voice, ideally one no brawler uses. */
export const ANNOUNCER = 'announcer'

/** How each of the cast sounds. Brawlers get theirs in this order, so the usual opponents differ first. */
const CAST: [string, Profile][] = [
  [
    ANNOUNCER,
    {
      female: false,
      pitch: 0.82,
      rate: 1.16,
      prefer: [
        /Microsoft (Guy|Christopher|Davis|Tony|Jason|Roger)\b/i,
        /Google US English Male|Microsoft (Andrew|Brian|Eric|Steffan)\b/i,
        /\bAlex\b/i,
        /\b(Aaron|Tom|Eddy|Reed)\b/i,
        /en[-_]US/i,
      ],
    },
  ],
  // energetic, quick, a touch high
  [
    'dan',
    { female: false, pitch: 1.14, rate: 1.16, prefer: [/\b(Andrew|Eric|Brian|Jason|Aaron|Alex|Mark|Liam)\b/i, /en[-_](US|CA)/i] },
  ],
  // deep and slow, unhurried menace
  [
    'masquerade',
    {
      female: false,
      pitch: 0.55,
      rate: 0.88,
      prefer: [/\b(Davis|Roger|Steffan|Thomas|Daniel|Arthur|Christopher)\b/i, /Google UK English Male/i, /en[-_](GB|IE)/i],
    },
  ],
  // bright and sharp
  [
    'runo',
    {
      female: true,
      pitch: 1.28,
      rate: 1.12,
      prefer: [/\b(Jenny|Aria|Michelle|Samantha|Ava|Zira)\b/i, /Google US English/i, /en[-_]US/i],
    },
  ],
  // soft and gentle
  [
    'alice',
    {
      female: true,
      pitch: 1.06,
      rate: 0.9,
      prefer: [/\b(Sonia|Libby|Moira|Emily|Hazel|Serena|Fiona)\b/i, /Google UK English Female/i, /en[-_](GB|IE)/i],
    },
  ],
  // bubbly, the brightest of all
  ['julie', { female: true, pitch: 1.5, rate: 1.18, prefer: [/\b(Natasha|Karen|Clara|Molly|Ana|Emma)\b/i, /en[-_](AU|NZ|CA)/i] }],
  // calm and low, few words
  [
    'shun',
    { female: false, pitch: 0.84, rate: 0.92, prefer: [/\b(Ryan|Connor|Prabhat|Rishi|William|Thomas)\b/i, /en[-_](GB|IE|IN)/i] },
  ],
  // formal and refined
  [
    'klaus',
    {
      female: false,
      pitch: 0.92,
      rate: 0.95,
      prefer: [/\b(Thomas|Daniel|Oliver|Arthur|George|Ryan)\b/i, /Google UK English Male/i, /en[-_]GB/i],
    },
  ],
  // the youngest: high and quick
  ['marucho', { female: false, pitch: 1.55, rate: 1.1, prefer: [/\b(Eric|Liam|Mitchell|Wayne|Luke)\b/i, /en[-_](US|NZ|ZA)/i] }],
  // loud and brash
  [
    'shuji',
    { female: false, pitch: 0.98, rate: 1.13, prefer: [/\b(William|Guy|Luke|Wayne|Tony|Mitchell)\b/i, /en[-_](AU|ZA|NZ)/i] },
  ],
]

// (Chrome's "Google US English" is a woman's voice)
const FEMALE =
  /female|woman|girl|google us english$|\b(samantha|victoria|karen|moira|tessa|fiona|veena|zira|susan|hazel|heera|aria|jenny|michelle|sonia|libby|maisie|natasha|clara|neerja|emily|molly|luna|leah|asilia|ezinne|imani|rosa|ana|emma|ava|allison|serena|kate|kathy|vicki|agnes|princess|nancy|sara|jane|amber|ashley|cora|elizabeth|monica|joanna|kendra|kimberly|salli|ivy|olivia|amy|nicole|raveena|catherine|isla|hollie|mia|flo|sandy|shelley|grandma|martha|zoe|ellie|nova|jessa)\b/i
const MALE =
  /\bmale\b|\bman\b|\b(daniel|alex|aaron|arthur|fred|david|mark|george|guy|ryan|thomas|oliver|tom|james|davis|tony|jason|andrew|brian|christopher|eric|roger|steffan|william|liam|prabhat|connor|mitchell|wayne|luke|abeo|elimu|chilemba|sam|yan|rishi|gordon|lee|bruce|ralph|junior|reed|rocko|eddy|grandpa|matthew|joey|justin|kevin|russell|geraint|aditya|nathan|noah|evan|jacob|harry|jack|ken|kai)\b/i
/** Joke voices (bells, organs, whispers …) never speak for anyone. */
const NOVELTY =
  /bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|albert/i

type Gender = 'f' | 'm' | '?'
const genderOf = (v: VoiceInfo): Gender => (FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : '?')

/** How good a voice sounds: natural (neural) ones first, the old robotic ones last. */
const quality = (v: VoiceInfo) =>
  (/natural|neural|online|premium|enhanced/i.test(v.name) ? 3 : 0) +
  (/google/i.test(v.name) ? 1 : 0) -
  (/\b(fred|junior|ralph|kathy|princess|agnes|bruce|vicki)\b/i.test(v.name) ? 3 : 0) -
  // elderly voices are for nobody in a cast of kids and teens, unless nothing else is left
  (/\b(grandpa|grandma)\b/i.test(v.name) ? 2 : 0)

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
/** 0–1, stable for a string. */
const unit = (s: string) => (hash(s) % 10007) / 10007

export interface Plan {
  /** Index into the voice list (or -1: none fits), and pitch and pace, per speaker id. */
  bySpeaker: Map<string, { voice: number; pitch: number; rate: number }>
  english: number[]
}

/** The English voices worth using, as indices into `voices` (none: the system's default voice speaks). */
const englishOf = (voices: VoiceInfo[]) =>
  voices.map((_, i) => i).filter((i) => /^en([-_]|$)/i.test(voices[i].lang) && !NOVELTY.test(voices[i].name))

/** Without a voice of the right kind, the pitch alone has to carry it. */
function pitchFor(female: boolean, pitch: number, voice: VoiceInfo | undefined) {
  const g = voice ? genderOf(voice) : '?'
  if (female && g !== 'f') return Math.max(pitch, 1.35)
  if (!female && g === 'f') return Math.min(pitch, 0.75)
  return pitch
}

/**
 * Works out the cast's voices for a voice list: each speaker in CAST order takes the best unused voice of its kind
 * (male brawlers leave the announcer's voice alone while another is free); once a kind runs out, voices are shared
 * round-robin, and speakers on the same voice are pushed apart in pitch and pace.
 */
export function planVoices(voices: VoiceInfo[]): Plan {
  const english = englishOf(voices)
  const uses = new Map<number, number>()
  const plan = new Map<string, { voice: number; pitch: number; rate: number }>()
  const pool = (female: boolean) => {
    const want: Gender = female ? 'f' : 'm'
    const same = english.filter((i) => genderOf(voices[i]) === want)
    if (same.length) return same
    const unknown = english.filter((i) => genderOf(voices[i]) === '?')
    return unknown.length ? unknown : english
  }
  const score = (p: Profile, i: number) => {
    const v = voices[i]
    const k = p.prefer.findIndex((re) => re.test(v.name) || re.test(v.lang))
    return (k < 0 ? 0 : (p.prefer.length - k) * 4) + quality(v)
  }
  let announcerVoice = -1
  for (const [id, p] of CAST) {
    let options = pool(p.female)
    // brawlers keep off the announcer's voice while there is another
    if (id !== ANNOUNCER && options.length > 1) options = options.filter((i) => i !== announcerVoice)
    const least = Math.min(...options.map((i) => uses.get(i) ?? 0))
    const free = options.filter((i) => (uses.get(i) ?? 0) === least)
    const best = free.reduce(
      (a, b) => (score(p, b) > score(p, a) || (score(p, b) === score(p, a) && unit(id + b) > unit(id + a)) ? b : a),
      free[0] ?? -1,
    )
    if (best >= 0) uses.set(best, (uses.get(best) ?? 0) + 1)
    if (id === ANNOUNCER) announcerVoice = best
    plan.set(id, { voice: best, pitch: pitchFor(p.female, p.pitch, voices[best]), rate: p.rate })
  }
  spread(plan)
  return { bySpeaker: plan, english }
}

/** Speakers sharing a voice (or with none) are moved apart: pitches at least 0.2 apart, paces at least 0.06. */
function spread(plan: Map<string, { voice: number; pitch: number; rate: number }>) {
  const groups = new Map<number, { pitch: number; rate: number }[]>()
  for (const d of plan.values()) groups.set(d.voice, [...(groups.get(d.voice) ?? []), d])
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const apart = (key: 'pitch' | 'rate', want: number, lo: number, hi: number) => {
      const sorted = [...group].sort((a, b) => a[key] - b[key])
      const n = sorted.length
      // as far apart as the range allows
      const gap = Math.min(want, (hi - lo) / (n - 1))
      const mean = () => sorted.reduce((s, d) => s + d[key], 0) / n
      const before = mean()
      for (let i = 1; i < n; i++) sorted[i][key] = Math.max(sorted[i][key], sorted[i - 1][key] + gap)
      // the group keeps its middle; one that spills over the range is pushed back in from that end
      const shift = before - mean()
      for (const d of sorted) d[key] += shift
      sorted[n - 1][key] = Math.min(sorted[n - 1][key], hi)
      for (let i = n - 2; i >= 0; i--) sorted[i][key] = Math.min(sorted[i][key], sorted[i + 1][key] - gap)
      sorted[0][key] = Math.max(sorted[0][key], lo)
      for (let i = 1; i < n; i++) sorted[i][key] = Math.max(sorted[i][key], sorted[i - 1][key] + gap)
    }
    apart('pitch', 0.2, 0.45, 1.95)
    apart('rate', 0.06, 0.8, 1.3)
  }
}

let cached: { key: string; voices: SpeechSynthesisVoice[]; plan: Plan } | null = null
const extra = new Map<string, Delivery>()

function current() {
  const voices = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices()
  const key = voices.map((v) => v.voiceURI).join('|')
  if (cached?.key !== key) {
    cached = { key, voices, plan: planVoices(voices) }
    extra.clear()
  }
  return cached
}

/** Who a voice belongs to: its id or name, else the character it came from, else what it sounds like. */
export function speakerOf(voice: SpeakerVoice): string {
  if (voice.id) return voice.id
  if (voice.name) return voice.name
  const own = CHARACTERS.find((c) => c.voice === voice) ?? CHARACTERS.find((c) => sameVoice(c.voice, voice))
  return own ? own.id : `voice:${voice.female ? 'f' : 'm'}:${voice.pitch}:${voice.rate ?? 1}`
}

const sameVoice = (a: Voice, b: Voice) => a.female === b.female && a.pitch === b.pitch && (a.rate ?? 1) === (b.rate ?? 1)

/**
 * How a speaker sounds: the announcer (ANNOUNCER), a cast member by id, or anyone else (a CPU brawler's name, a
 * self-made avatar) from `base`: a voice of its kind picked by its name, preferring ones the cast does not use, and
 * the base pitch and pace, nudged by the name so no two sound alike.
 */
export function deliveryFor(speaker: string, base?: Voice): Delivery {
  const { voices, plan } = current()
  const known = plan.bySpeaker.get(speaker)
  if (known) return { voice: voices[known.voice], pitch: known.pitch, rate: known.rate }
  const hit = extra.get(speaker)
  if (hit) return hit
  const female = base?.female ?? false
  const want: Gender = female ? 'f' : 'm'
  let options = plan.english.filter((i) => genderOf(voices[i]) === want)
  if (!options.length) options = plan.english
  const taken = new Set([...plan.bySpeaker.values()].map((d) => d.voice))
  const fresh = options.filter((i) => !taken.has(i))
  const from = fresh.length ? fresh : options.filter((i) => i !== plan.bySpeaker.get(ANNOUNCER)?.voice)
  const list = from.length ? from : options
  const pick = list.length ? list[Math.floor(unit(speaker) * list.length)] : -1
  const pitch = Math.min(1.9, Math.max(0.5, (base?.pitch ?? 1) + (unit(speaker + 'p') - 0.5) * 0.36))
  const d = {
    voice: voices[pick],
    pitch: pitchFor(female, pitch, voices[pick]),
    rate: Math.min(1.25, Math.max(0.85, (base?.rate ?? 1.05) + (unit(speaker + 'r') - 0.5) * 0.16)),
  }
  extra.set(speaker, d)
  return d
}

import { abilitiesOf, abilityLabel, BAKUGAN, type Bakugan } from '../data/bakugan'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { currentSeason } from '../season/current'
import { botById, botNow, BOTS, botTeam } from './bots'
import { ATTR_WORD, azOrdinal, DAY_WORD, hourPhrase, LINES, type Lang, type LineKey } from './chatLines'
import { PRICES, rankScore, tierOf, type Profile } from './useProfiles'

/**
 * How CPU brawlers answer a player in the clan chat and in direct messages. No network: the message is read
 * with word lists (in Azerbaijani, Turkish, Russian and English), its intent and the things it names
 * (a Bakugan, an attribute, a time, a number) are worked out, and the answer is built from the bot's real
 * numbers, in the language the player wrote in. A bot's question ("When?", "How are you?") is remembered on
 * its message, so a short answer to it ("8-də", "yox", "fine") is understood.
 */

export type { Lang }

/** What a bot's line asked, so the player's short answer to it can be understood. */
export type Ask = 'mood' | 'battle' | 'time' | 'lead'

export interface Turn {
  author: string
  text: string
  ask?: Ask
}

export interface ChatClan {
  tag: string
  name: string
  leaderId: string
  members: string[]
}

export interface ChatInput {
  text: string
  botId: string
  /** The player who wrote. */
  player: Profile | null
  /** Where it was said: a clan's chat, or a direct message to a friend. */
  place: { kind: 'clan' | 'dm'; clan: ChatClan | null; friends: boolean }
  /** Earlier lines of this conversation, oldest first. */
  history: Turn[]
  /** Everyone on this device (for the rankings). */
  profiles: Profile[]
  now: number
}

export interface ChatReply {
  text: string
  ask?: Ask
  lang: Lang
}

// ---------------------------------------------------------------- reading the message

/** Lower case without accents: "Döyüşək" → "doyusek", "ŞİMDİ" → "simdi", "привет" stays. */
export function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ə/g, 'e')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole words or phrases ("|"-separated, written with accents or without); a trailing "~" takes any ending. */
function W(list: string) {
  const alts = list
    .split('|')
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => (w.endsWith('~') ? `${escape(fold(w.slice(0, -1)))}\\p{L}*` : escape(fold(w))))
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join('|')})(?![\\p{L}\\p{N}])`, 'u')
}

const AZ_WORDS = W(
  'salam~|necəsən|necəsiz|neçə|necə|neynirsən|neyləyirsən|yaxşı~|bəli|yox~|xeyr|indi|axşam~|döyüş~|olar|gedək|edək|istəyir~|istəmir~|bilmir~|hansı~|haçan|harda~|harada|qardaş~|uduz~|kömək~|qiymət~|reytinq~|üzv~|çıx~|deyəsən|hələlik|görüşək|görüşərik|mənim|qələbə~|çox|nə vaxt|məşğul~|vaxtım|deyil|əla|oynayaq|gəlirsən|gələrsən|deyirsən|bilirsən|xoş~|məğlub~|qalib~|klanda|uşaqlar|həftəsonu',
)
const TR_WORDS = W(
  'merhaba|selam~|nasıl~|naber|iyi~|evet|hayır|teşekkürler|şimdi|yarın|akşam~|bugün|savaş~|kaç~|neden|nerede|hangi~|değil|çok|bilmiyorum|istiyorum|istemiyorum|maç~|kazandım|kaybettim|yardım~|fiyat~|para|abi|kanka|hadi|tabii|olur|peki|galiba|yapıyor~|napıyor~|misin|musun|benim|ben|kardeş~|görüşürüz|hoşça|kapış~|oynayalım|yenildim|arkadaş~',
)
const EN_WORDS = W(
  "the|you|your|are|is|what|how|hi|hello|hey|yes|no|thanks|thank|lets|let's|i|im|i'm|my|me|we|do|can|wanna|want|please|bro|good|nice|when|who|why|which|tomorrow|today|now|play|brawl|battle|fight|anyone|guys",
)
const count = (re: RegExp, t: string) => (t.match(new RegExp(re.source, 'gu')) ?? []).length

/** The language of one message, and whether it was clear (a lone "ok" or "Drago" is not). */
export function detectLang(text: string): { lang: Lang; sure: boolean } {
  const cyr = (text.match(/[Ѐ-ӿ]/g) ?? []).length
  const lat = (text.match(/[a-zA-ZÀ-ɏə]/g) ?? []).length
  if (cyr > lat) return { lang: 'ru', sure: true }
  const t = fold(text)
  const lower = text.toLowerCase()
  let az = (lower.match(/ə/g) ?? []).length * 3 + count(AZ_WORDS, t) * 2
  let tr = count(TR_WORDS, t) * 2
  // q and x are Azerbaijani letters (Turkish has neither) once the message reads Turkic at all
  if (az + tr > 0 || /[ğşçöüı]/.test(lower)) az += (t.match(/\p{L}*[qx]\p{L}*/gu) ?? []).length
  if (/[ğşçöüı]/.test(lower) && az + tr === 0) az = 1
  if (az > 0 || tr > 0) return { lang: az >= tr ? 'az' : 'tr', sure: true }
  if (EN_WORDS.test(t)) return { lang: 'en', sure: true }
  return { lang: 'en', sure: false }
}

/** The language a player has been writing in: their newest message that clearly reads as one. */
export function convoLang(texts: string[]): Lang | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const d = detectLang(texts[i])
    if (d.sure) return d.lang
  }
  return null
}

// intents (folded, any of the four languages)
const GREET = W(
  'hi|hello|hey|heya|hiya|yo|howdy|hola|good morning|good evening|good afternoon|salam~|slm|sabahın xeyir|sabahınız xeyir|axşamın xeyir|axşamınız xeyir|günaydın|merhaba|meraba|selam~|selamün aleyküm|привет~|здравствуй~|здрасте|здорово|добрый день|доброе утро|добрый вечер',
)
const SALAM = W('salam~|selam~|selamün aleyküm|salam aleykum|salam əleyküm')
const EVERYONE = W(
  'everyone|everybody|all|guys|people|hamıya|hamı|uşaqlar|dostlar|millet|herkese|herkes|arkadaşlar|всем|ребята|народ',
)
const MOOD = W(
  "how are you|how r u|how are u|how r you|hru|how is it going|how's it going|hows it going|how you doing|how are you doing|how's life|what's up|whats up|wassup|sup|how are things|how have you been|necəsən|necəsiz|nə var nə yox|nə var|işlər necədir|işlər necə|yaxşısan|yaxşısınız|nasılsın|nasılsınız|naber|ne haber|nasıl gidiyor|как дела|как ты|как жизнь|как поживаешь|что нового|как сам",
)
const YOU_BACK = W('and you|what about you|wbu|hbu|bəs sən|sən necə|sən necəsən|ya sen|sen nasılsın|а ты|а у тебя|ты как')
const GOOD_MOOD = W(
  'good|fine|great|ok|okay|alright|not bad|awesome|well|super|cool|yaxşı~|əla|pis deyil|normal|əladır|iyi~|iyiyim|fena değil|harika|хорошо|норм~|отлично|супер|неплохо',
)
const BAD_MOOD = W(
  'bad|not good|sad|tired|bored|awful|terrible|pis|pisəm|yorğun~|darıxıram|kefim yoxdur|kötü~|üzgün~|sıkıldım|плохо|устал~|грустно|скучно|так себе',
)
const THANKS = W(
  'thanks|thank you|thx|ty|tysm|thank u|appreciate it|sağ ol~|sağol~|çox sağ ol~|təşəkkür~|minnətdar~|teşekkür~|merci|mersi|спасибо|спс|благодарю',
)
const BYE = W(
  "bye|bye bye|goodbye|bb|see you|see ya|cya|good night|gn|gotta go|g2g|gtg|i'm off|im off|hələlik|görüşək|görüşərik|görüşənədək|gecən xeyrə|gecəniz xeyrə|getdim|getməliyəm|hoşça kal|görüşürüz|iyi geceler|пока|до свидания|до встречи|спокойной ночи|бывай",
)
const NIGHT = W('good night|gn|gecən xeyrə|gecəniz xeyrə|iyi geceler|спокойной ночи')
const NEWBIE = W(
  "i'm new|im new|i am new|new here|new player|just joined|first time|yeni gəlmişəm|yeniyəm|təzə gəlmişəm|yeni üzv~|yeni katıldım|yeniyim|я новенький|я новичок|я новый|впервые",
)
const INSULT = W(
  'noob|n00b|nub|stupid|idiot|dumb|loser|trash|garbage|you suck|u suck|shut up|stfu|hate you|ugly|lame|moron|clown|axmaq~|gic~|sarsaq~|eşşək~|salak~|aptal~|gerizekalı~|ezik~|beyinsiz~|dangalaq~|qanmaz~|дурак~|тупой~|тупица|нуб~|лох~|идиот~|заткнись|отстой',
)
const ARE_BOT = W(
  'are you a bot|are you bot|you a bot|r u a bot|are you real|are you human|botsan|sən botsan|botsan|bot musan|insansan|bot musun|insan mısın|ты бот|ты робот|ты настоящий',
)
const COMPLIMENT = W(
  "you're good|youre good|you are good|you're great|you are great|you're the best|you are the best|you're strong|you are strong|you're awesome|you rock|great job|good job|well done|nice one|gj|wp|well played|respect|legend|goat|əlasan|əla oynayırsan|supersən|güclüsən|qəşəngsən|afərin|aferin|bravo|maladess|molodec|harikasın|çok iyisin|helal|efsanesin|efsane|ustasın|молодец|красавчик|ты лучший|круто играешь|респект",
)
const LUCK = W('good luck|gl|glhf|uğurlar|uğur olsun|bol şans|başarılar|удачи')
const LAUGH = W('haha~|hehe~|hihi~|lol|lmao|rofl|xd|xaxa~|ахах~|хаха~|хех~|лол')
const BATTLE = W(
  "brawl~|battle~|fight~|duel~|1v1|1x1|1vs1|2v2|3v3|match|rematch|spar~|challenge me|play with me|let's play|lets play|wanna play|want to play|döyüş~|vuruş~|oynayaq|oynayax|yarışaq|savaş~|kapış~|maç yapalım|maç atalım|oynayalım|бой|бою|боя|сразимся|сразиться|драться|подерёмся|поиграем|дуэл~|батл~|матч~",
)
const WHO_WANTS = W(
  'who wants|anyone|anybody|kim istəyir|kimsə|kim var|kim hazırdır|kim ister|kimse|кто хочет|кто готов|кто-нибудь',
)
/** "Kim döyüşmək istəyir?", "who else wants to brawl": who … wants, with words between. */
const WHO_WANTS_FAR = new RegExp(
  `${W('who|kim|кто').source}.{0,24}${W('wants|want|istəyir~|ister|hazırdır|хочет|готов').source}`,
  'u',
)
const WIN = W(
  'i won|won|win|wins|winning|victory|i beat|gg|evolved|qalib~|udmuşam|uddum|uddu|udduq|qazandım|qazandıq|kazandım|kazandık|yendim|galip|победил~|выиграл~|победа',
)
const LOSS = W(
  'i lost|lost|lose|losing|defeated|got beat|rekt|uduzdum|uduzdu~|uduzuram|uduzmuşam|məğlub~|kaybettim|kaybettik|yenildim|mağlup~|проиграл~|поражени~|слил~',
)
const SHOP = W(
  'shop|store|buy~|bought|price~|cost~|bp|battle points|sell~|skin~|cheap~|expensive|mağaza~|almaq|alıram|alım|alacam|alacağam|alaq|aldım|qiymət~|pul|endirim~|ucuz~|baha~|satın al~|fiyat~|para|indirim~|магазин~|купить|куплю|купил|цена|цены|стоит|скидк~',
)
const PASS = W(
  'season pass|battle pass|pass|season~|sezon~|mövsüm~|premium|challenges|tapşırıq~|gündəlik|görev~|günlük|сезон~|пропуск|задани~|ежедневн~',
)
const RANK = W(
  'rank~|rating|ratings|br|score~|leaderboard|ladder|elo|tier|position|what place|which place|reytinq~|sıralama~|sıran|neçənci|neçəncisən|yerdəsən|xal~|dərəcə~|puan~|kaçıncı~|рейтинг~|ранг~|место|очк~|топ',
)
const STATS = W('wins|stats|statistics|record|kos|battles|qələbə~|statistika~|rekord~|galibiyet~|istatistik~|побед~|статистик~')
const CLAN = W('clan~|guild|klan~|клан~')
const LEADER = W('leader|boss|captain|chief|lider~|başçı~|rəhbər~|kapitan~|başqan|reis~|лидер~|глава|главный|капитан')
const JOIN = W('join~|qoşul~|dəvət~|invite~|üzv ol~|katıl~|davet~|вступ~|присоедин~|приглас~')
const LEAVE = W(
  "leave|leaving|i'm leaving|im leaving|quit|quitting|çıxıram|çıxacam|tərk~|ayrılıram|çıkıyorum|ayrılmak|выхожу|ухожу|покину|выйти",
)
const MEMBERS = W('members|member|üzv~|nəfər~|üye~|kişi~|участник~|человек')
const CARDS = W('card~|ability~|abilities|kart~|qabiliyyət~|bacarıq~|yetenek~|карт~|способност~')
const TEAM_Q = W(
  'your team|ur team|your lineup|your deck|what do you play|which bakugan do you|komandan~|komandanda|takımın~|твоя команда|hansı bakuganla|nə ilə oynayırsan|nəylə oynayırsan|hangi bakugan ile|каким bakugan',
)
const ATTR_Q = W('attribute~|element~|atribut~|stixiya~|özellik~|атрибут~|стихи~|элемент~')
const FAVORITE = W(
  'favorite|favourite|fav|best bakugan|strongest|like most|do you like|sevimli~|ən yaxşı~|ən güclü~|xoşuna gəlir|sevirsən|favorit~|en iyi~|en sevdiğin|en güçlü|любим~|лучш~|сильнейш~|нравится',
)
const DOING = W(
  'what are you doing|what r u doing|wyd|what you doing|nə edirsən|neynirsən|neyləyirsən|nə işlə məşğulsan|ne yapıyorsun|napıyorsun|napıyon|что делаешь|чем занят~|чё делаешь',
)
const WHOAMI = W('who are you|who r u|sən kimsən|kimsən|kimsiniz|sen kimsin|kimsin|кто ты|ты кто')
const FROM = W('where are you from|where r u from|haralısan|haradansan|nerelisin|откуда ты')
const TIP = W(
  'help|tip~|advice|guide|teach|how do i|how to|how can i|what should i|kömək~|məsləhət~|necə edim|nə edim|yardım~|tavsiye~|ipucu~|nasıl yap~|помо~|совет~|подскажи|как мне',
)
const EVOLVE = W('evolve~|evolution~|evolv~|forms|təkamül~|inkişaf~|evrim~|эволюц~')
const POWER = W('power|g power|g-power|how strong|strength|güc~|neçə g|kaç g|сила|силы|сколько g|мощн~')
const BRAWLER_Q = W('whose|who uses|who used|kimin|kim istifadə|kimindir|чей|чья')
const YES = W(
  "yes|yeah|yea|yep|yup|sure|ok|okay|okey|oki|alright|of course|ofc|deal|let's go|lets go|why not|i'm in|im in|sounds good|go|bəli|əlbəttə|oldu|olar|razı~|gedək|gəlirəm|tamam|evet|olur|tabii|tabi|peki|hadi|да|ага|конечно|давай|ок|хорошо|ладно|го",
)
/** "Hə" (yes) only counts in Azerbaijani or Turkish: in English "he" is someone. */
const YES_TURKIC = W('hə|hee|hə də|ha|hı')
const NO = W(
  "no|nope|nah|not now|not today|can't|cant|cannot|busy|maybe later|another time|yox|xeyr|istəmirəm|olmaz|məşğulam|vaxtım yoxdur|başqa vaxt|indi yox|hayır|yok|istemiyorum|meşgulüm|нет|неа|не могу|потом|позже|занят~|не сейчас|в другой раз",
)
const LATER = W('later|sonra|potom|позже|потом')

// question words
const Q_WHO = W("who|who's|whos|kim|kimdir|kimin|kimə|kimi|кто|кого|кому")
const Q_WHAT = W("what|what's|whats|nə|nədir|nəyi|ne|nedir|что|чего")
const Q_WHEN = W('when|what time|nə vaxt|nəvaxt|haçan|ne zaman|когда|во сколько')
const Q_WHERE = W('where|harada|harda|hara|nerede|nereye|где|куда')
const Q_WHICH = W('which|hansı~|hangi~|какой|какая|какие|какую')
const Q_WHY = W('why|niyə|nə üçün|neden|niye|niçin|почему|зачем')
const Q_HOWMANY = W('how many|how much|neçə|neçədir|kaç|сколько')
const Q_PARTICLE = W('mi|mı|mu|mü|misin|mısın|musun|müsün|misən|musan|ли')

const NAMES = (() => {
  const list: { name: string; id: string; form: number }[] = []
  for (const b of BAKUGAN) b.evolutions.forEach((e, form) => list.push({ name: e.name, id: b.id, form }))
  for (const b of BAKUGAN) list.push({ name: b.name, id: b.id, form: 0 })
  list.push({ name: 'Drago', id: 'dragonoid', form: 0 }, { name: 'Skyres', id: 'skyress', form: 0 })
  const seen = new Set<string>()
  return list
    .filter((x) => !seen.has(fold(x.name)) && !!seen.add(fold(x.name)))
    .sort((a, b) => b.name.length - a.name.length)
    .map((x) => ({
      ...x,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${escape(fold(x.name))}(?:['-]?\\p{L}{0,6})?(?![\\p{L}\\p{N}])`, 'u'),
    }))
})()

/** The Bakugan a message names, in the order named, at most two ("Drago vs Tigrerra"). */
function bakuganIn(t: string) {
  const found: { b: Bakugan; form: number; at: number }[] = []
  let rest = t
  for (const n of NAMES) {
    const m = n.re.exec(rest)
    if (!m) continue
    // blank it out, so "Dragonoid" is not found again inside "Delta Dragonoid"
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length)
    if (!found.some((f) => f.b.id === n.id)) found.push({ b: BAKUGAN.find((b) => b.id === n.id)!, form: n.form, at: m.index })
  }
  return found.sort((a, b) => a.at - b.at).slice(0, 2)
}

/** Everyday words for the attributes ("od", "water", "ışık"): they count as the attribute next to an attribute word. */
const NATIVE: Record<ElementId, RegExp> = {
  pyrus: W('fire|od|odlu|ateş~|огонь|огн~'),
  aquos: W('water|su|suyu|вода|водн~'),
  subterra: W('earth|ground|torpaq~|toprak~|земл~'),
  ventus: W('wind|külək~|rüzgar~|rüzgâr~|ветер|ветр~'),
  haos: W('light|işıq~|ışık~|свет~'),
  darkus: W('dark|darkness|qaranlıq~|karanlık~|тьма|тьм~'),
}
const ELEMENT_NAMES = ELEMENTS.map((e) => ({ id: e.id, re: W(`${e.name}~`) }))

function elementIn(t: string, loose: boolean): ElementId | null {
  const named = ELEMENT_NAMES.find((e) => e.re.test(t))
  if (named) return named.id
  if (!loose) return null
  return (Object.keys(NATIVE) as ElementId[]).find((id) => NATIVE[id].test(t)) ?? null
}

type Day = 'today' | 'tomorrow' | 'tonight' | 'now' | 'later' | 'weekend' | 'morning'
interface When {
  day?: Day
  hour?: number
  min?: number
}

/** A time the message names: "sabah saat 8-də", "tomorrow at 8pm", "20:30", "завтра в 7". */
function whenIn(t: string, lang: Lang): When | null {
  const w: When = {}
  const day: [Day, RegExp][] = [
    ['tonight', W('tonight|this evening|bu axşam|axşam|bu akşam|akşam|вечером|сегодня вечером')],
    ['tomorrow', W(lang === 'tr' ? 'tomorrow|tmrw|yarın|завтра' : 'tomorrow|tmrw|sabah|yarın|завтра')],
    ['morning', W(lang === 'tr' ? 'in the morning|sabah|səhər|утром' : 'in the morning|səhər|утром')],
    ['today', W('today|bu gün|bugün|сегодня')],
    ['now', W('now|right now|rn|indi|elə indi|şimdi|hemen|сейчас')],
    ['weekend', W('weekend|həftəsonu|həftə sonu|hafta sonu|выходн~')],
    ['later', LATER],
  ]
  w.day = day.find(([, re]) => re.test(t))?.[0]
  const clock = /(?<![\p{N}])(\d{1,2})[:.](\d{2})(?![\p{N}])/u.exec(t)
  const pm = /(?<![\p{N}])(\d{1,2})\s*(pm|am)(?![\p{L}])/u.exec(t)
  const said =
    /(?<![\p{L}])(?:saat|at|в)\s*(\d{1,2})(?![\p{N}:])/u.exec(t) ??
    /(?<![\p{N}])(\d{1,2})\s*[-']?\s*(?:de|da|te|ta|o'clock|oclock|часов|часа|час)(?![\p{L}])/u.exec(t)
  if (clock) [w.hour, w.min] = [Number(clock[1]), Number(clock[2])]
  else if (pm) w.hour = (Number(pm[1]) % 12) + (pm[2] === 'pm' ? 12 : 0)
  else if (said) w.hour = Number(said[1])
  if (w.hour !== undefined && (w.hour > 24 || (w.min ?? 0) > 59)) w.hour = w.min = undefined
  return w.day || w.hour !== undefined ? w : null
}

function whenPhrase(lang: Lang, w: When) {
  const day = w.day ? DAY_WORD[lang][w.day] : ''
  const hour = w.hour !== undefined ? hourPhrase(lang, w.hour, w.min) : ''
  return [day, hour].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------- what the bot knows

interface BotInfo {
  vars: Record<string, string | number>
  /** The bot's last brawl ended in the past 45 minutes. */
  fresh: boolean
  persona: Persona
  team: { id: string; form: number }[]
  element: ElementId
}

type Persona = 'hype' | 'chill' | 'pro' | 'kind'
const PERSONAS: Persona[] = ['hype', 'chill', 'pro', 'kind']

const formName = (b: Bakugan, form: number) => b.evolutions[form]?.name ?? b.name
const strongestOf = (element: ElementId) =>
  BAKUGAN.filter((b) => b.element === element && b.id !== 'dharak').reduce((a, b) => (b.baseG > a.baseG ? b : a))

function botInfo(input: ChatInput): BotInfo {
  const base = botById(input.botId)!
  const bot = botNow(base, input.now)
  const team = botTeam(bot)
  const lead = BAKUGAN.find((b) => b.id === team[0].id)!
  const score = rankScore(bot)
  const pos =
    BOTS.filter((b) => b.id !== bot.id && rankScore(botNow(b, input.now)) > score).length +
    input.profiles.filter((p) => rankScore(p) > score).length +
    1
  const cards = abilitiesOf(lead, team[0].form)
  const card = cards[Number(bot.id.slice(4)) % cards.length]
  const top = strongestOf(bot.element)
  const clan = input.place.clan
  const leader = clan && clan.leaderId
  const me = input.player
  const meLead = me?.team[0] ? BAKUGAN.find((b) => b.id === me.team[0]) : undefined
  const season = currentSeason(input.now)
  return {
    persona: PERSONAS[Number(bot.id.slice(4)) % PERSONAS.length],
    fresh: !!bot.lastBattle && input.now - bot.lastBattle < 45 * 60_000,
    team,
    element: bot.element,
    vars: {
      me: me?.firstName ?? 'brawler',
      bot: bot.name.split(' ')[0],
      botFull: bot.name,
      lead: formName(lead, team[0].form),
      leadG: lead.evolutions[team[0].form]?.gPower ?? lead.baseG,
      El: ELEMENT_BY_ID[bot.element].name,
      elTop: top.name,
      elTopG: top.baseG,
      tier: tierOf(score).name,
      rating: bot.rating,
      score: score.toLocaleString('en'),
      pos,
      posAz: azOrdinal(pos),
      wins: bot.wins,
      losses: bot.losses,
      // "2 brawls today": a lone one reads oddly in the plural lines
      ...(bot.today > 1 ? { today: bot.today } : {}),
      team: team.map((t) => formName(BAKUGAN.find((b) => b.id === t.id)!, t.form)).join(', '),
      card: card?.name ?? '',
      cardLabel: card ? abilityLabel(card) : '',
      own: PRICES.ownElement.toLocaleString('en'),
      other: PRICES.otherElement.toLocaleString('en'),
      season: season.id,
      days: Math.max(1, Math.ceil((season.endsAt - input.now) / 86_400_000)),
      ...(me ? { bp: me.bp.toLocaleString('en') } : {}),
      ...(meLead ? { myLead: meLead.name } : {}),
      ...(clan ? { tag: clan.tag, clan: clan.name, count: clan.members.length } : {}),
      ...(leader ? { leader: nameOf(leader, input.profiles) } : {}),
    },
  }
}

const nameOf = (id: string, profiles: Profile[]) => {
  const p = profiles.find((x) => x.id === id)
  return p ? `${p.firstName} ${p.lastName}` : (botById(id)?.name ?? 'someone')
}

function bakuganVars(b: Bakugan) {
  const max = b.evolutions.reduce((a, e) => (e.gPower > a.gPower ? e : a))
  return {
    B: b.name,
    bG: b.baseG,
    bBrawl: b.brawlG,
    Battr: ELEMENT_BY_ID[b.element].name,
    bBrawler: b.brawler,
    bEvos: [...new Set(b.evolutions.map((e) => e.name))].join(' → '),
    bMax: max.name,
    bMaxG: max.gPower,
  }
}

// ---------------------------------------------------------------- building the answer

interface Part {
  key: LineKey
  vars?: Record<string, string | number>
}

/** Lines a key asks, so the player's short answer is understood. */
const ASKS: Partial<Record<LineKey, Ask>> = {
  greetMood: 'mood',
  greetBattle: 'battle',
  moodBack: 'mood',
  moodBad: 'battle',
  battleWhen: 'time',
  battleDay: 'time',
  battleBusy: 'time',
  newbie: 'lead',
  friendHello: 'battle',
}

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** A line of `key` with its facts filled in; lines naming a fact that is not known are left out. */
function line(lang: Lang, key: LineKey, vars: Record<string, string | number>, recent: string[] = []) {
  const filled = LINES[lang][key]
    .map((l) =>
      l.replace(/\{(\w+)\}/g, (_, k: string) => {
        if (k === 'When' && vars.when !== undefined) return cap(String(vars.when))
        return vars[k] !== undefined && vars[k] !== '' ? String(vars[k]) : '\u0000'
      }),
    )
    .filter((l) => !l.includes('\u0000'))
  if (!filled.length) return ''
  const fresh = filled.filter((l) => !recent.some((r) => r.includes(l)))
  return pick(fresh.length ? fresh : filled)
}

const OPENERS: Record<Lang, string[]> = {
  en: ['Whoa!', 'Oh nice!', 'Yesss!'],
  az: ['Vay!', 'Oho!', 'Ooo!'],
  tr: ['Vay!', 'Oha!'],
  ru: ['Ого!', 'Вау!'],
}
const EXCITING: LineKey[] = ['battleYes', 'battleAt', 'win', 'compliment', 'bakuganMine', 'bakuganLead', 'attrSame', 'leadAnswer']
const hasEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s)

/** Each bot sounds a little different: hyped, laid back, a strategist or extra friendly. */
function voice(text: string, persona: Persona, lang: Lang, keys: LineKey[]) {
  if (persona === 'hype' && keys.some((k) => EXCITING.includes(k))) {
    if (Math.random() < 0.4) text = `${pick(OPENERS[lang])} ${text}`
    if (!hasEmoji(text) && Math.random() < 0.35) text += pick([' 🔥', ' 💥'])
  }
  if (persona === 'chill') {
    text = text
      .replace(/!+/g, '.')
      .replace(/\.\./g, '.')
      .replace(/\. ?(\p{Extended_Pictographic})/gu, ' $1')
  }
  if (persona === 'kind' && !hasEmoji(text) && Math.random() < 0.4) text += ' 🙂'
  return text
}

const snippet = (raw: string) => {
  const words = raw.replace(/\s+/g, ' ').trim().split(' ')
  const s = words.slice(0, 4).join(' ')
  return s.length > 28 ? `${s.slice(0, 26)}…` : words.length > 4 ? `${s}…` : s
}

/** Whether the message speaks to the whole clan ("salam hamıya", "who wants to brawl?"), so a second member may answer. */
export function toEveryone(text: string) {
  const t = fold(text)
  return EVERYONE.test(t) || WHO_WANTS.test(t) || WHO_WANTS_FAR.test(t) || NEWBIE.test(t)
}

/** "you?" / "sən?" at the end: the player asks back. */
const ASKS_BACK = /(?<![\p{L}])(?:sen|siz|you|u|ты|вы)\s*\?\s*$/u
/** Asking for a brawl rather than telling about one ("let's", "gəl", "wanna"). */
const REQUEST = W(
  "let's|lets|wanna|want to|gəl|gəlin|edək|döyüşək|döyüşərik|oynayaq|hadi|haydi|давай|сразимся|1v1|2v2|3v3|rematch",
)

/** The answer of a CPU brawler to a player's message. */
export function reply(input: ChatInput): ChatReply {
  const raw = input.text
  const own = botById(input.botId)
  let t = fold(raw)
  // "Kai, ..." - the bot's own name is not part of what is said
  if (own) t = t.replace(W(own.name.split(' ')[0]), ' ').trim()
  // greetings that name a time of day are greetings, not times
  t = t
    .replace(W('battle pass|season pass'), 'pass')
    .replace(W('sabahın xeyir|sabahınız xeyir|axşamın xeyir|axşamınız xeyir'), 'salam')
  const detected = detectLang(raw)
  const mine = input.history.filter((h) => h.author === input.player?.id)
  const lang = detected.sure ? detected.lang : (convoLang(mine.map((h) => h.text)) ?? 'en')
  const recent = input.history.slice(-12).map((h) => h.text)
  const info = botInfo(input)
  const vars = info.vars
  const parts: Part[] = []
  const add = (key: LineKey, extra?: Record<string, string | number>) => {
    parts.push({ key, vars: extra })
  }
  const is = (re: RegExp) => re.test(t)
  const spoken = () => parts.filter((p) => p.key !== 'hello').length

  const question = raw.includes('?') || [Q_WHO, Q_WHAT, Q_WHEN, Q_WHERE, Q_WHICH, Q_WHY, Q_HOWMANY].some(is) || is(Q_PARTICLE)
  const yes = is(YES) || ((lang === 'az' || lang === 'tr') && is(YES_TURKIC))
  const no = is(NO)
  const named = bakuganIn(t)
  const numbers = (raw.match(/\d+/g) ?? []).map(Number)
  const gNumber = /(?<![\p{N}])(\d{2,4})\s*g(?![\p{L}])/iu.exec(raw)
  const clan = input.place.clan
  const inClan = !!clan && !!input.player && clan.members.includes(input.player.id)
  const invite = (): LineKey => (input.place.kind === 'dm' ? 'inviteHere' : input.place.friends ? 'inviteFriend' : 'inviteAdd')
  // how to start the brawl is said once, not by every member who answers
  const told = recent.slice(-3).some((r) => /INVITE TO BATTLE|FRIENDS/.test(r))
  const addInvite = () => {
    if (!told) add(invite())
  }
  const news = (is(WIN) || is(LOSS)) && !question && !is(REQUEST)
  const battle = is(BATTLE) && !news

  // the bot's own question, when this is the answer to it
  const lastBot = [...input.history].reverse().find((h) => h.author !== input.player?.id)
  const asked = lastBot?.author === input.botId ? lastBot.ask : undefined
  let when = whenIn(t, lang)
  if (asked === 'time') {
    // a bare "8" answers "what time?"; the day comes from what the player said before
    if (!when && numbers.length === 1 && numbers[0] <= 24 && t.replace(/[\d\s\p{P}]/gu, '').length < 4)
      when = { hour: numbers[0] }
    const before = mine.at(-1)
    const day = before ? whenIn(fold(before.text), lang)?.day : undefined
    if (when && !when.day && day && day !== 'now') when = { ...when, day }
  }

  /** A brawl at a time: agreed (now and then the bot is busy then), or "what time?" when only the day is known. */
  const brawlAt = (w: When) => {
    const phrase = whenPhrase(lang, w)
    if (w.day === 'now') {
      add('battleNow')
      addInvite()
    } else if (w.day === 'later' && w.hour === undefined) add('battleNo')
    else if (w.hour === undefined) add('battleDay', { when: phrase })
    else if (Math.random() < 0.15) add('battleBusy', { when: phrase })
    else {
      add('battleAt', { when: phrase })
      addInvite()
    }
  }

  /** A short answer to what the bot just asked; false when the message is about something else. */
  function followUp() {
    if (asked === 'mood' && !battle) {
      if (is(BAD_MOOD)) add('moodBad')
      else if (is(GOOD_MOOD) || yes) add('moodGood')
      if (is(YOU_BACK) || ASKS_BACK.test(t) || is(MOOD)) add(info.fresh ? 'moodBrawled' : 'mood')
      return parts.length > 0
    }
    if (asked === 'battle' || asked === 'time') {
      if (when) {
        brawlAt(when)
        return true
      }
      if (no && !named.length) {
        add('battleNo')
        return true
      }
      if (yes || battle) {
        if (asked === 'time') add('battleNow')
        else add('battleYes')
        if (asked === 'battle') add('battleWhen')
        else addInvite()
        return true
      }
    }
    if (asked === 'lead' && named.length) {
      add('leadAnswer', bakuganVars(named[0].b))
      return true
    }
    return false
  }

  /** What the message is about. */
  function content() {
    if (battle || (when && is(REQUEST))) {
      if (when) brawlAt(when)
      else if (is(WHO_WANTS) || is(WHO_WANTS_FAR)) {
        add('battleGroup')
        addInvite()
      } else if (question && is(Q_WHEN)) add('battleWhen')
      else {
        add('battleYes')
        addInvite()
      }
      return
    }
    if (named.length === 2) {
      const [a, b] = named.map((n) => n.b)
      const win = a.baseG === b.baseG ? null : a.baseG > b.baseG ? a : b
      return add(win ? 'compare' : 'compareEven', { A: a.name, aG: a.baseG, B2: b.name, b2G: b.baseG, Win: win?.name ?? '' })
    }
    if (named.length === 1) {
      const b = named[0].b
      const v = bakuganVars(b)
      if (is(EVOLVE)) return add(new Set(b.evolutions.map((e) => e.name)).size > 1 ? 'bakuganEvo' : 'bakuganNoEvo', v)
      if (is(POWER) || (question && is(Q_HOWMANY))) return add('bakuganG', v)
      if (is(BRAWLER_Q)) return add('bakuganWho', v)
      if (info.team[0].id === b.id) return add('bakuganLead', v)
      if (info.team.some((x) => x.id === b.id)) return add('bakuganMine', v)
      return add('bakugan', v)
    }
    if (is(LEADER)) {
      if (!clan) return add('joinNone')
      return add(clan.leaderId === input.botId ? 'leaderMe' : clan.leaderId === input.player?.id ? 'leaderYou' : 'leader')
    }
    if (clan && question && is(W('strongest|best|ən güclü~|en güçlü|сильнейш~|лучш~'))) {
      const top = clan.members
        .map((id) => {
          const bot = botById(id)
          const p = input.profiles.find((x) => x.id === id)
          return { id, score: bot ? rankScore(botNow(bot, input.now)) : p ? rankScore(p) : 0 }
        })
        .sort((a, b) => b.score - a.score)[0]
      if (top) return add('whoTop', { top: nameOf(top.id, input.profiles), topScore: top.score.toLocaleString('en') })
    }
    if (is(JOIN) && (is(CLAN) || input.place.kind === 'dm')) return add(!clan ? 'joinNone' : inClan ? 'joinIn' : 'joinOut')
    if (is(LEAVE) && (is(CLAN) || (input.place.kind === 'clan' && inClan))) return add(clan ? 'leave' : 'bye')
    if (is(MEMBERS) && clan && question) return add('members')
    if (is(RANK) || /(?<![\p{L}])top\s*\d/u.test(t)) return add('rank')
    if (question && (is(STATS) || is(W('qələbən|qələbələrin|galibiyetin')))) return add('stats')
    if (is(CARDS)) return add('cards')
    if (is(SHOP)) {
      add('shop')
      if (vars.bp !== undefined && (is(Q_HOWMANY) || Math.random() < 0.4)) add('shopBp')
      return
    }
    if (is(PASS)) return add('pass')
    const element = elementIn(t, is(ATTR_Q) || t.split(' ').length <= 2)
    if (element) {
      const top = strongestOf(element)
      return add(element === info.element ? 'attrSame' : 'attr', {
        E: ELEMENT_BY_ID[element].name,
        Enative: ATTR_WORD[lang][element],
        eTop: top.name,
        eTopG: top.baseG,
      })
    }
    if (is(ATTR_Q)) return add('attrMine')
    if (is(TEAM_Q) || (question && is(W('team|komanda~|takım~|команд~')))) return add('team')
    if (is(FAVORITE)) return add('favorite')
    if (is(MOOD) || ((is(YOU_BACK) || ASKS_BACK.test(t)) && !spoken())) {
      add(info.fresh ? 'moodBrawled' : 'mood')
      if (!is(GOOD_MOOD) && !is(BAD_MOOD)) add('moodBack')
      return
    }
    if (is(DOING)) return add(info.fresh ? 'doingBrawled' : 'doing')
    if (is(WHOAMI)) return add('whoami')
    if (is(FROM)) return add('from')
    if (is(NEWBIE)) return add('newbie')
    if (news) {
      add(is(LOSS) ? 'loss' : 'win')
      if (is(LOSS) && info.persona === 'pro') add('tipWrap', { tip: line(lang, 'tips', vars, recent) })
      return
    }
    if (is(TIP) || (question && is(W('how|necə|nasıl|как')))) return add('tipWrap', { tip: line(lang, 'tips', vars, recent) })
    // small talk: up to two of these ("thanks, bye!")
    const social: [boolean, LineKey][] = [
      [is(COMPLIMENT), 'compliment'],
      [is(THANKS), 'thanks'],
      [is(LUCK), 'luck'],
      [is(BYE) || (is(LATER) && t.split(' ').length <= 2), is(NIGHT) ? 'night' : 'bye'],
      [is(LAUGH) || /😂|🤣|😆|😹/u.test(raw), 'laugh'],
    ]
    for (const [hit, key] of social) if (hit && spoken() < 2) add(key)
    if (spoken()) return
    if (yes && !question) return add('yes')
    if (no && !question) return add('no')
    if (gNumber) {
      const n = Number(gNumber[1])
      return add(n > Number(vars.leadG) * 1.3 ? 'numberBig' : 'numberG', { n })
    }
    // a time on its own ("saat 9", "tomorrow at 5?") proposes a brawl then
    if (when) return brawlAt(when)
    if (question) {
      if (is(Q_WHO)) return add('who', { someone: someoneElse(input) })
      if (is(Q_WHEN)) return add('when')
      if (is(Q_WHERE)) return add('where')
      if (is(Q_WHY)) return add('why')
      return add('qUnknown', { snip: snippet(raw) })
    }
    if (numbers.length && t.replace(/[\d\s\p{P}]/gu, '').length < 3) return add('number', { n: numbers[0] })
    add('unknown', { snip: snippet(raw) })
  }

  if (is(INSULT)) add('insult')
  else if (is(ARE_BOT)) add('isBot')
  else if (is(GREET) || !followUp()) {
    if (is(GREET)) {
      // a greeting before something else is just a "hi"; on its own it gets a proper hello
      const rest = t.replace(new RegExp(GREET.source, 'gu'), ' ').replace(new RegExp(EVERYONE.source, 'gu'), ' ')
      if (rest.replace(/[\p{P}\p{S}\s]+/gu, '').length > 2) {
        add('hello')
        content()
      } else
        add(
          is(SALAM) && lang === 'az' && Math.random() < 0.6 ? 'greetSalam' : pick<LineKey>(['greet', 'greetMood', 'greetBattle']),
        )
    } else content()
  }

  const texts = parts.map((p) => line(lang, p.key, { ...vars, ...p.vars }, recent)).filter(Boolean)
  const asking = [...parts].reverse().find((p) => ASKS[p.key])
  // the player's name once is enough ("You got it, Ali. Bye, good luck!")
  let seen = 0
  const said = texts.join(' ').replace(new RegExp(`(,? )?${escape(String(vars.me))}(?![\\p{L}])`, 'gu'), (m) => (seen++ ? '' : m))
  return {
    text: voice(
      said || snippet(raw),
      info.persona,
      lang,
      parts.map((p) => p.key),
    ),
    ask: asking && ASKS[asking.key],
    lang,
  }
}

/** Another clan member's first name, for "ask {someone}". */
function someoneElse(input: ChatInput) {
  const others = (input.place.clan?.members ?? []).filter((id) => id !== input.botId && id !== input.player?.id)
  const id = others.length ? pick(others) : pick(BOTS.filter((b) => b.id !== input.botId)).id
  return nameOf(id, input.profiles).split(' ')[0]
}

/** Something a bot says by itself (`key`: chatter, welcome, joined…), in `lang`. */
export function botLine(
  key: 'chatter' | 'welcome' | 'recruited' | 'joined' | 'friendHello',
  input: Omit<ChatInput, 'text' | 'history'> & { recent?: string[]; name?: string },
  lang: Lang,
): ChatReply {
  const info = botInfo({ ...input, text: '', history: [] })
  const vars = { ...info.vars, ...(input.name ? { me: input.name } : {}) }
  return { text: line(lang, key, vars, input.recent) || line('en', key, vars), ask: ASKS[key], lang }
}

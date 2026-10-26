import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { FINISHER_CHARGE, HAND_SIZE, LIVES, MOVES } from '../battle/engine'
import { COMMAND_GATES } from '../data/gates'
import { BakuganInfo } from '../components/BakuganInfo'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { type Bakugan } from '../data/bakugan'
import { viewable } from '../season/release'
import { CARD_TYPES, cardBakugan, loadCards, type CardType, type DbCard } from '../data/cardDb'
import { CORRELATIONS, DIAGONAL, ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import {
  BP,
  EVOLVE_XP,
  ownsBakugan,
  PRICES,
  RANK_XP,
  RATING,
  TIERS,
  TOP_RANK,
  unlockHint,
  useActiveProfile,
  XP,
} from '../profile/useProfiles'
import { useGame } from '../store/useGame'

type Tab = 'bakugan' | 'cards' | 'attributes' | 'rules'
type Sort = 'name' | 'hsp-asc' | 'hsp-desc'

const TYPE_COLOR: Record<CardType, string> = {
  character: '#ff9a3c',
  ability: '#7ec8e3',
  'attribute-gate': '#3ee07a',
  'character-gate': '#f5c518',
  'command-gate': '#e040fb',
}

export function EncyclopediaScreen() {
  const [tab, setTab] = useState<Tab>('cards')
  const [cards, setCards] = useState<DbCard[] | null>(null)
  const [error, setError] = useState('')
  // set from the Bakugan tab to jump to that Bakugan's cards
  const [bakuganFilter, setBakuganFilter] = useState('')

  useEffect(() => {
    loadCards()
      .then(setCards)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="encyclopedia" />
      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">ENCYCLOPEDIA</h1>
      <p className="mt-1 text-white/50">Every Bakugan, every card and every rule.</p>

      <div className="mt-6 flex gap-2">
        {(
          [
            ['cards', `CARDS${cards ? ` (${cards.length})` : ''}`],
            ['bakugan', 'BAKUGAN'],
            ['attributes', 'ATTRIBUTES'],
            ['rules', 'HOW TO BRAWL'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`font-display rounded border px-4 py-2 text-xs tracking-[0.3em] transition ${
              tab === id ? 'border-white bg-white/10 text-white' : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-8 text-red-300">{error}</p>}
      <div className="mt-6 pb-16">
        {tab === 'cards' &&
          (cards ? (
            <CardsTab cards={cards} bakugan={bakuganFilter} setBakugan={setBakuganFilter} />
          ) : (
            !error && <p className="text-white/50">Loading the card database…</p>
          ))}
        {tab === 'bakugan' && (
          <BakuganTab
            cards={cards ?? []}
            onCards={(name) => {
              setBakuganFilter(name)
              setTab('cards')
            }}
          />
        )}
        {tab === 'attributes' && <AttributesTab cards={cards ?? []} />}
        {tab === 'rules' && <RulesTab />}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------- cards

function CardsTab({ cards, bakugan, setBakugan }: { cards: DbCard[]; bakugan: string; setBakugan: (b: string) => void }) {
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<CardType[]>([])
  const [attrs, setAttrs] = useState<ElementId[]>([])
  const [sort, setSort] = useState<Sort>('name')
  const [unreleased, setUnreleased] = useState(true)
  const [open, setOpen] = useState<DbCard | null>(null)

  const names = useMemo(
    () => [...new Set(cards.map(cardBakugan).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b)),
    [cards],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = cards.filter(
      (c) =>
        (unreleased || !c.pending) &&
        (!types.length || types.includes(c.type)) &&
        (!attrs.length || c.attributes.some((a) => attrs.includes(a))) &&
        (!bakugan || cardBakugan(c) === bakugan) &&
        (!q || `${c.name} ${c.text} ${c.user ?? ''} ${c.catalogue}`.toLowerCase().includes(q)),
    )
    return list.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'hsp-asc' ? a.hsp - b.hsp : b.hsp - a.hsp,
    )
  }, [cards, query, types, attrs, bakugan, sort, unreleased])

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, effect, Bakugan or catalogue no…"
          className="w-96 rounded-md border border-white/15 bg-black/50 px-3 py-2 outline-none focus:border-white/50"
        />
        <select
          value={bakugan}
          onChange={(e) => setBakugan(e.target.value)}
          className="rounded-md border border-white/15 bg-black/80 px-3 py-2 text-sm outline-none"
        >
          <option value="">All Bakugan</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-md border border-white/15 bg-black/80 px-3 py-2 text-sm outline-none"
        >
          <option value="name">Sort: name</option>
          <option value="hsp-asc">Sort: HSP low → high</option>
          <option value="hsp-desc">Sort: HSP high → low</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={unreleased} onChange={(e) => setUnreleased(e.target.checked)} />
          Show unreleased
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {CARD_TYPES.map((t) => {
          const on = types.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => setTypes(toggle(types, t.id))}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                on
                  ? 'text-white hover:brightness-125'
                  : 'border-white/15 text-white/60 hover:border-white/50 hover:bg-white/10 hover:text-white'
              }`}
              style={on ? { borderColor: TYPE_COLOR[t.id], background: `${TYPE_COLOR[t.id]}33` } : undefined}
            >
              {t.label}
            </button>
          )
        })}
        <span className="mx-2 h-5 w-px bg-white/15" />
        {ELEMENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setAttrs(toggle(attrs, e.id))}
            title={e.name}
            className={`rounded-full transition ${attrs.includes(e.id) ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
          >
            <img src={e.icon} alt={e.name} className="h-7 w-7" />
          </button>
        ))}
        {(types.length > 0 || attrs.length > 0 || bakugan || query) && (
          <button
            onClick={() => {
              setTypes([])
              setAttrs([])
              setBakugan('')
              setQuery('')
            }}
            className="ml-2 text-xs text-white/50 underline hover:text-white"
          >
            clear filters
          </button>
        )}
      </div>

      <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">{shown.length} CARDS</p>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {shown.map((c) => (
          <CardTile key={c.id} card={c} onOpen={() => setOpen(c)} />
        ))}
      </div>

      <AnimatePresence>{open && <CardModal card={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  )
}

const cardColor = (c: DbCard) => (c.attributes[0] ? ELEMENT_BY_ID[c.attributes[0]]?.color : undefined) ?? TYPE_COLOR[c.type]
const typeLabel = (t: CardType) => CARD_TYPES.find((x) => x.id === t)!.label

function CardTile({ card, onOpen }: { card: DbCard; onOpen: () => void }) {
  const color = cardColor(card)
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-lg border bg-black/50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-black/70"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: TYPE_COLOR[card.type] }}>
          {typeLabel(card.type)}
        </span>
        {card.pending && <span className="rounded bg-white/10 px-1 text-[9px] tracking-widest text-white/50">UNRELEASED</span>}
        <span className="ml-auto flex gap-0.5">
          {card.attributes.map((a) => (
            <img key={a} src={ELEMENT_BY_ID[a]?.icon} alt={a} className="h-4 w-4" />
          ))}
        </span>
      </div>
      <p className="font-display mt-1 font-bold">{card.name}</p>
      {card.user && <p className="text-xs text-white/45">{card.user}</p>}
      <p className="mt-1.5 line-clamp-3 text-xs leading-snug whitespace-pre-line text-white/65">{card.text}</p>
      <p className="mt-auto pt-2 text-[10px] text-white/35">
        {card.hsp} HSP · max {card.limit} · {card.catalogue}
      </p>
    </button>
  )
}

function CardModal({ card, onClose }: { card: DbCard; onClose: () => void }) {
  const color = cardColor(card)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl border-2 bg-[#0a0b11] p-8"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}44` }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: TYPE_COLOR[card.type] }}>
            {typeLabel(card.type)}
          </span>
          <span className="ml-auto flex gap-1">
            {card.attributes.map((a) => (
              <img key={a} src={ELEMENT_BY_ID[a]?.icon} alt={a} className="h-7 w-7" />
            ))}
          </span>
        </div>
        <h2 className="font-display mt-2 text-3xl font-black">{card.name}</h2>
        {card.user && <p className="mt-1 text-white/55">Used by: {card.user}</p>}
        <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-white/85">{card.text}</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ['HSP COST', card.hsp],
            ['DECK LIMIT', card.limit],
            ['CATALOGUE', card.catalogue],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-white/10 py-2">
              <p className="font-display text-[10px] tracking-widest text-white/40">{k}</p>
              <p className="font-display font-bold">{v}</p>
            </div>
          ))}
        </div>
        {card.pending && <p className="mt-4 text-sm text-white/45">Not released yet.</p>}
      </motion.div>
    </motion.div>
  )
}

// ---------------------------------------------------------------- bakugan

function BakuganTab({ cards, onCards }: { cards: DbCard[]; onCards: (name: string) => void }) {
  const openBakugan = useGame((s) => s.openBakugan)
  const chooseElement = useGame((s) => s.chooseElement)
  const [element, setElement] = useState<ElementId | null>(null)
  const [info, setInfo] = useState<Bakugan | null>(null)
  const profile = useActiveProfile()

  // every Bakugan that has its own cards, with the attributes its variants come in
  const index = useMemo(() => {
    const map = new Map<string, { cards: number; attributes: Set<ElementId> }>()
    for (const c of cards) {
      const name = cardBakugan(c)
      if (!name) continue
      const entry = map.get(name) ?? { cards: 0, attributes: new Set<ElementId>() }
      entry.cards++
      const variant = (c.user ?? c.name).split(' ')[0].toLowerCase() as ElementId
      if (ELEMENT_BY_ID[variant]) entry.attributes.add(variant)
      c.attributes.forEach((a) => entry.attributes.add(a))
      map.set(name, entry)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [cards])

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setElement(null)}
          className={`rounded-full border px-3 py-1 text-xs transition hover:bg-white/10 ${element ? 'border-white/15 text-white/50 hover:border-white/50 hover:text-white' : 'border-white text-white'}`}
        >
          ALL
        </button>
        {ELEMENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setElement(e.id)}
            className={`rounded-full transition ${element === e.id ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
          >
            <img src={e.icon} alt={e.name} className="h-7 w-7" />
          </button>
        ))}
      </div>

      <h2 className="font-display mt-6 text-xs tracking-[0.5em] text-white/40">PLAYABLE IN 3D</h2>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {viewable()
          .filter((b) => !element || b.element === element)
          .map((b) => {
            const el = ELEMENT_BY_ID[b.element]
            return (
              <div key={b.id} className="rounded-xl border bg-black/40 p-5" style={{ borderColor: `${el.color}55` }}>
                <div className="flex items-center gap-4">
                  <img src={el.icon} alt="" className="h-14 w-14" style={{ filter: `drop-shadow(0 0 12px ${el.glow})` }} />
                  <div>
                    <p className="font-display text-2xl font-bold">{b.name}</p>
                    <p className="text-sm text-white/50">
                      {el.name} · {b.brawler} · {b.baseG}G
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-white/70">{b.description}</p>
                <p className="mt-2 text-xs text-white/45">Evolutions: {b.evolutions.map((e) => e.name).join(' → ')}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setInfo(b)}
                    className="font-display flex-1 border border-white/30 py-1.5 text-xs tracking-widest hover:bg-white/10"
                  >
                    FULL PROFILE
                  </button>
                  <button
                    disabled={!ownsBakugan(profile, b.id)}
                    title={ownsBakugan(profile, b.id) ? undefined : unlockHint(profile, b)}
                    onClick={() => {
                      chooseElement(b.element)
                      openBakugan(b.id)
                    }}
                    className="font-display flex-1 border py-1.5 text-xs tracking-widest hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    style={{ borderColor: el.color }}
                  >
                    {ownsBakugan(profile, b.id) ? 'VIEW IN 3D' : '🔒 LOCKED'}
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      <h2 className="font-display mt-10 text-xs tracking-[0.5em] text-white/40">
        ALL BAKUGAN IN THE CARD DATABASE · {index.length}
      </h2>
      <p className="mt-1 text-sm text-white/45">3D models for these come later. Click one to see its cards.</p>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
        {index
          .filter(([, v]) => !element || v.attributes.has(element))
          .map(([name, v]) => (
            <button
              key={name}
              onClick={() => onCards(name)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left transition hover:border-white/40"
            >
              <span className="flex-1">
                <span className="block font-semibold">{name}</span>
                <span className="text-xs text-white/45">
                  {v.cards} card{v.cards > 1 ? 's' : ''}
                </span>
              </span>
              <span className="flex -space-x-1">
                {[...v.attributes].map((a) => (
                  <img key={a} src={ELEMENT_BY_ID[a].icon} alt={a} className="h-5 w-5" />
                ))}
              </span>
            </button>
          ))}
      </div>

      <AnimatePresence>
        {info && (
          <BakuganInfo
            bakugan={info}
            onClose={() => setInfo(null)}
            onInspect={() => {
              chooseElement(info.element)
              openBakugan(info.id)
            }}
            locked={ownsBakugan(profile, info.id) ? undefined : unlockHint(profile, info)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ---------------------------------------------------------------- attributes

function AttributesTab({ cards }: { cards: DbCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-4">
      {ELEMENTS.map((e) => {
        const count = cards.filter((c) => c.attributes.includes(e.id)).length
        return (
          <div key={e.id} className="rounded-xl border bg-black/40 p-6" style={{ borderColor: `${e.color}55` }}>
            <div className="flex items-center gap-4">
              <img src={e.icon} alt="" className="h-16 w-16" style={{ filter: `drop-shadow(0 0 14px ${e.glow})` }} />
              <div>
                <p className="font-display text-3xl font-black" style={{ color: e.color }}>
                  {e.name}
                </p>
                <p className="text-white/50">
                  {e.attribute} · brawler {e.brawler}
                </p>
              </div>
            </div>
            <p className="mt-4 leading-relaxed text-white/75">{e.lore}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="font-display text-[10px] tracking-widest text-white/40">ALLIES</p>
                <p>{CORRELATIONS[e.id].map((a) => ELEMENT_BY_ID[a].name).join(', ')}</p>
              </div>
              <div>
                <p className="font-display text-[10px] tracking-widest text-white/40">OPPOSITE</p>
                <p>{ELEMENT_BY_ID[DIAGONAL[e.id]].name}</p>
              </div>
              <div>
                <p className="font-display text-[10px] tracking-widest text-white/40">CARDS</p>
                <p>{count}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/50">
              Bakugan:{' '}
              {viewable()
                .filter((b) => b.element === e.id)
                .map((b) => b.name)
                .join(', ') || '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- rules

function RulesTab() {
  const sections: [string, string[]][] = [
    [
      'The brawl',
      [
        `Each brawler has ${LIVES} lives: the balls at the top of the screen. A match is a series of battles, one Bakugan against one. The loser of a battle loses a life; lose ${LIVES} battles and you are defeated.`,
        'Each side brings one to three Bakugan. A beaten Bakugan goes back to its brawler and can be thrown again in the next battle.',
        'Every battle: one brawler sets a Gate Card face-down (the brawlers take turns, a coin toss decides who sets the first). The setter throws a Bakugan first, then the other brawler answers with one of theirs.',
        `Each side draws a hand of up to ${HAND_SIZE} cards from its thrown Bakugan's own ability cards. Then each brawler has ${MOVES} moves; you take turns, and the Gate Card's owner moves first.`,
        'A move is one thing: activate an ability card ("Ability activate!"), or a Gate Card action. There is no passing. A brawler with nothing they can play skips their turn.',
        'Once both brawlers have made their moves (or neither can move), the Bakugan clash: the higher G-Power wins the battle. A tie goes to the Bakugan thrown first (the Gate Card setter’s).',
        'A battle ends at once when a Bakugan drops to 0 G: it is defeated. A finisher wins it outright. Big cards decide battles: 550 G against 600 G, they open their Gate Card (+150, 750 G), you answer with +400 (950 G).',
        'The loser of a battle loses a life; their Bakugan goes back into its ball and can be thrown again. A turn counter (01T, 02T…) runs through the whole match.',
      ],
    ],
    [
      'Gate Cards',
      [
        'Your Gate Card stays on the field for the battle and does nothing until you open it with one of your moves: "Gate Card, open!". After the battle it is spent; each brawler has three.',
        'Then it is a tug-of-war, each step a move: your opponent may close it (its effect is undone), then open it for themselves (it works for them); you may then close it again. Each brawler opens it once and closes it once at most.',
        'A Gate Card always works for the brawler it is open for. Attribute Gate Cards give their Bakugan extra G’s: in full if it has the card’s attribute, half otherwise. Character Gate Cards raise its G-Power by half if it is the card’s Bakugan, by a quarter otherwise. On a Command Gate Card, “you” is the brawler it is open for.',
        ...COMMAND_GATES.map((g) => `${g.name}: ${g.text}`),
      ],
    ],
    [
      'Ability cards in battle',
      [
        'Every card counts for the battle it is played in. Boost cards raise your G-Power; attack cards strike at once and weaken cards cut the opponent’s; drain cards steal it (they lose it, you gain it). An attack that takes a Bakugan down to 0 G defeats it.',
        'Nullify cards cancel the opponent’s last ability card, and its G change is undone. There are no shields that block everything.',
        `A finisher, played after ${FINISHER_CHARGE} other ability cards in the same battle, wins the battle outright.`,
      ],
    ],
    [
      'Ranked play',
      [
        'The system matches you with a CPU brawler on your level: as many Bakugan as you bring, the same forms and the same number of cards. Bots get sharper as your rank rises.',
        `A win gives each of your Bakugan ${XP.winMin}–${XP.winMax} XP (+${XP.ko} per battle it wins), ${BP.win} Battle Points (+${BP.streakBonus} per win streak) and about +${RATING.win} rating at Rookie against an equal brawler, more against a stronger one and less the higher your rank. A loss gives ${XP.lossMin}–${XP.lossMax} XP and ${BP.loss} BP, and costs about −${RATING.loss} rating at Rookie, more the higher your rank.`,
        `Evolving takes ${EVOLVE_XP.map((x) => x.toLocaleString('en')).join(' / ')} XP for the 2nd / 3rd / 4th form. A new ability card unlocks every 1,500 XP.`,
        `New Bakugan cost ${PRICES.ownElement.toLocaleString('en')} BP (your attribute) or ${PRICES.otherElement.toLocaleString('en')} BP (other attributes), or unlock with ${PRICES.ownElementXp.toLocaleString('en')} / ${PRICES.otherElementXp.toLocaleString('en')} player XP.`,
        `Ranks: ${TIERS.map((t) => t.name).join(', ')}, each with divisions III → II → I, then ${TOP_RANK.name} (${TOP_RANK.min.toLocaleString('en')}+). Rank score = rating + 1 per ${RANK_XP.per} XP (at most ${RANK_XP.max}); the battle screen shows it as HSP under each brawler.`,
      ],
    ],
  ]
  return (
    <div className="grid max-w-5xl gap-6">
      {sections.map(([title, lines]) => (
        <section key={title} className="rounded-xl border border-white/10 bg-black/40 p-6">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-white/75">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

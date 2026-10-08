import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { PageNav } from '../components/PageNav'
import { abilityLabel, BAKUGAN, formModels } from '../data/bakugan'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { cardCount, EVOLVE_XP, ownedForm, unlockHint, useActiveProfile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { BallModel, MonsterModel, preloadModels } from '../three/BakuganModels'
import { LiftDrag } from '../three/LiftDrag'
import { BlobShadow } from '../three/BlobShadow'
import { env, type Move, type Pose } from '../three/pose'
import * as THREE from 'three'

type Shelf = 'mine' | 'all'
type View = 'monster' | 'ball'

/** Browse every Bakugan and every evolution in 3D: the player's own collection or the whole game. */
export function BakuganShowroom() {
  const profile = useActiveProfile()
  const openBakugan = useGame((s) => s.openBakugan)
  const chooseElement = useGame((s) => s.chooseElement)
  const [shelf, setShelf] = useState<Shelf>('all')
  const [search, setSearch] = useState('')
  const [element, setElement] = useState<ElementId | null>(null)
  // the picked Bakugan and form; falls back to the first one on the shelf
  const [sel, setSel] = useState<{ id: string; form: number } | null>(null)
  const [view, setView] = useState<View>('monster')
  const closed = useRef(false)
  // the move being shown off (played on the model's joints and its whole body)
  const pose = useRef<Pose | null>(null)

  const list = useMemo(
    () =>
      BAKUGAN.filter(
        (b) =>
          (!element || b.element === element) &&
          (shelf === 'all' || ownedForm(profile, b.id) >= 0) &&
          // a search looks through every name, evolutions included
          (!search.trim() ||
            [b.name, ...b.evolutions.map((e) => e.name)].some((n) => n.toLowerCase().includes(search.trim().toLowerCase()))),
      ).sort(
        (a, b) =>
          ELEMENTS.findIndex((e) => e.id === a.element) - ELEMENTS.findIndex((e) => e.id === b.element) || a.baseG - b.baseG,
      ),
    [shelf, element, profile, search],
  )
  const index = Math.max(
    0,
    list.findIndex((b) => b.id === sel?.id),
  )
  const bakugan = list[index]
  // a Bakugan opens on the form the player has reached (or its base form)
  const form = bakugan ? (sel?.id === bakugan.id ? sel.form : Math.max(0, ownedForm(profile, bakugan.id))) : 0
  const setForm = (f: number) => bakugan && setSel({ id: bakugan.id, form: f })
  const reached = bakugan ? ownedForm(profile, bakugan.id) : -1
  const owned = bakugan ? profile?.collection.find((o) => o.id === bakugan.id) : undefined

  const pick = useCallback(
    (i: number) => {
      const next = list[(i + list.length) % list.length]
      if (!next) return
      playSfx('tick')
      setSel({ id: next.id, form: Math.max(0, ownedForm(profile, next.id)) })
    },
    [list, profile],
  )

  useEffect(() => {
    if (bakugan) preloadModels(bakugan)
  }, [bakugan])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') pick(index - 1)
      if (e.key === 'ArrowRight') pick(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick, index])

  const el = ELEMENT_BY_ID[bakugan?.element ?? element ?? 'pyrus']
  const evo = bakugan?.evolutions[form]
  const hasModel =
    bakugan &&
    (view === 'ball' ? (bakugan.evolutions[form]?.models?.ball ?? bakugan.models?.ball) : formModels({ bakugan, form })?.monster)
  // flyers hover, so the camera looks a little higher at them
  const lookAt = view === 'ball' ? 0.6 : bakugan && formModels({ bakugan, form })?.fly ? 2 : 1.4

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(circle at 55% 50%, ${el.color}38, #05060a 65%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {bakugan && (
        <Canvas camera={{ position: [0, 2.1, 6], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 6, 4]} intensity={2.2} />
          <pointLight position={[-3, 2.5, -2]} intensity={20} color={el.glow} />
          <pointLight position={[0, 2, 5]} intensity={6} color="#ffffff" />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.9, 64]} />
            <meshStandardMaterial color="#101118" emissive={el.color} emissiveIntensity={0.15} />
          </mesh>
          <Suspense fallback={null}>
            <group key={`${bakugan.id}-${form}-${view}`}>
              {view === 'monster' ? (
                <group scale={0.78 / Math.max(1, (formModels({ bakugan, form })?.scale ?? 1) * (1 + form * 0.12))}>
                  <MoveBody pose={pose}>
                    <MonsterModel entrant={{ bakugan, form, skin: owned?.skin }} poseRef={pose} />
                  </MoveBody>
                </group>
              ) : (
                <group position={[0, 0.6, 0]} scale={1.2}>
                  <BallModel bakugan={bakugan} form={form} openRef={closed} skin={owned?.skin} />
                </group>
              )}
            </group>
          </Suspense>
          <BlobShadow size={view === 'monster' ? 3.6 : 1.4} />
          <OrbitControls
            makeDefault
            target={[0, lookAt, 0]}
            enablePan={false}
            minDistance={1.6}
            maxDistance={9}
            autoRotate
            autoRotateSpeed={1.2}
          />
          <LiftDrag max={6} base={lookAt} resetKey={`${bakugan?.id}-${form}`} />
        </Canvas>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col px-12 pt-8 pb-20">
        <div className="pointer-events-auto">
          <PageNav current="showroom" />
        </div>

        {/* shelf + attribute filter */}
        <div className="pointer-events-auto mt-6 flex items-center gap-3">
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setShelf(s)}
              className={`font-display rounded border px-4 py-2 text-xs tracking-[0.3em] transition ${
                shelf === s ? 'border-white bg-white/10 text-white' : 'border-white/15 text-white/50 hover:text-white'
              }`}
            >
              {s === 'mine' ? `MY BAKUGAN · ${profile ? profile.collection.length : 0}` : `ALL IN GAME · ${BAKUGAN.length}`}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Bakugan…"
            className="w-48 rounded border border-white/15 bg-black/50 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-white/50"
          />
          <span className="mx-2 h-6 w-px bg-white/15" />
          <button
            onClick={() => setElement(null)}
            className={`rounded-full border px-3 py-1 text-xs ${element ? 'border-white/15 text-white/50' : 'border-white text-white'}`}
          >
            ALL
          </button>
          {ELEMENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => setElement(e.id)}
              title={e.name}
              className={`rounded-full transition ${element === e.id ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
            >
              <img src={e.icon} alt={e.name} className="h-7 w-7" />
            </button>
          ))}
        </div>

        {!bakugan && (
          <div className="pointer-events-auto mt-24 text-center text-white/60">
            {shelf === 'mine' && !profile ? 'Create a profile to start your collection.' : 'No Bakugan here yet.'}
          </div>
        )}

        {bakugan && evo && (
          <div className="mt-6 flex min-h-0 flex-1 justify-between gap-8">
            <AnimatePresence mode="wait">
              <motion.section
                key={bakugan.id}
                className="pointer-events-auto w-[28rem] max-w-[36vw] overflow-y-auto pr-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-2">
                  <img src={el.icon} alt="" className="h-7 w-7" />
                  <span className="font-display text-xs tracking-[0.4em]" style={{ color: el.color }}>
                    {el.name.toUpperCase()} · {bakugan.series.toUpperCase()}
                  </span>
                </div>
                <h1 className="font-display mt-2 text-5xl font-black tracking-wide">{evo.name}</h1>
                <p className="mt-1 text-white/55">Brawler: {bakugan.brawler}</p>
                <p className="mt-3 text-sm">
                  {reached >= 0 ? (
                    <span className="rounded bg-emerald-400/15 px-2 py-1 text-emerald-300">✓ IN YOUR COLLECTION</span>
                  ) : (
                    <span className="rounded bg-white/10 px-2 py-1 text-white/70">🔒 {unlockHint(profile, bakugan)}</span>
                  )}
                </p>
                <p className="mt-4 leading-relaxed text-white/80">{bakugan.description}</p>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <Stat label="G-POWER" value={`${evo.gPower}G`} color={el.color} />
                  <Stat label="ON A GATE" value={`${evo.gPower + bakugan.brawlG - bakugan.baseG}G`} color={el.color} />
                  <Stat
                    label="CARDS"
                    value={owned ? `${cardCount(owned)}/${bakugan.abilities.length}` : `${bakugan.abilities.length}`}
                    color={el.color}
                  />
                </div>

                {owned && (
                  <p className="mt-3 text-xs text-white/50">
                    {owned.xp.toLocaleString('en')} Bakugan XP · {owned.wins} wins · {owned.battles} battles · {owned.kos} KOs
                  </p>
                )}

                <p className="font-display mt-6 text-[10px] tracking-[0.4em] text-white/40">EVOLUTIONS</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bakugan.evolutions.map((e, i) => {
                    const have = i <= reached
                    return (
                      <button
                        key={`${e.name}-${e.series}`}
                        onClick={() => {
                          playSfx('tick')
                          setForm(i)
                        }}
                        title={
                          have
                            ? 'Reached'
                            : i === reached + 1 && owned
                              ? `Evolves at ${EVOLVE_XP[reached]?.toLocaleString('en')} Bakugan XP`
                              : 'Not reached yet'
                        }
                        className={`rounded border px-3 py-1.5 text-left text-xs transition ${
                          i === form ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'
                        }`}
                        style={{ borderColor: i === form ? el.color : 'rgba(255,255,255,0.12)' }}
                      >
                        <span className="font-display font-bold">
                          {have ? '' : '🔒 '}
                          {e.name}
                        </span>
                        <span className="block text-[10px] text-white/40">
                          {e.series} · {e.gPower}G
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 flex gap-2">
                  {(['monster', 'ball'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`font-display rounded border px-3 py-1.5 text-[10px] tracking-[0.3em] ${
                        view === v ? 'border-white bg-white/10' : 'border-white/25 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {v === 'monster' ? 'BRAWL FORM' : 'BALL FORM'}
                    </button>
                  ))}
                  {reached >= 0 && (
                    <button
                      onClick={() => {
                        chooseElement(bakugan.element)
                        openBakugan(bakugan.id)
                      }}
                      className="font-display ml-auto rounded border px-3 py-1.5 text-[10px] tracking-[0.3em] hover:bg-white/10"
                      style={{ borderColor: el.color }}
                    >
                      TAKE TO THE FIELD →
                    </button>
                  )}
                </div>
                {view === 'monster' && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MOVES.map(([move, label]) => (
                      <button
                        key={move}
                        onClick={() => {
                          playSfx('tick')
                          pose.current = { kind: move === 'roar' || move === 'guard' ? 'cast' : 'lunge', move, start: null }
                        }}
                        className="font-display rounded border border-white/20 px-2.5 py-1 text-[9px] tracking-[0.25em] text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {!hasModel && <p className="mt-3 text-xs text-white/40">3D model coming soon. Shown as a stand-in figure.</p>}
              </motion.section>
            </AnimatePresence>

            {/* ability cards */}
            <section className="pointer-events-auto w-72 overflow-y-auto">
              <p className="font-display text-[10px] tracking-[0.4em] text-white/40">ABILITY CARDS</p>
              <ul className="mt-2 space-y-2">
                {bakugan.abilities.map((a, i) => {
                  const unlocked = owned ? i < cardCount(owned) : false
                  return (
                    <li key={a.id} className="rounded border border-white/10 bg-black/40 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`font-display text-sm font-bold ${owned && !unlocked ? 'text-white/40' : ''}`}>
                          {owned && !unlocked && '🔒 '}
                          {a.name}
                        </span>
                        <span className="text-xs" style={{ color: el.color }}>
                          {abilityLabel(a)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-white/55">{a.description}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        )}

        <p className="mt-4 text-center text-xs tracking-[0.3em] text-white/35">
          DRAG TO TURN · RIGHT-DRAG UP / DOWN · SCROLL TO ZOOM · ← → TO SWITCH
        </p>
        {/* Bakugan strip */}
        {list.length > 0 && (
          <div className="pointer-events-auto mt-3 flex items-center gap-3">
            <ArrowButton label="◀" onClick={() => pick(index - 1)} />
            <div className="flex flex-1 gap-2 overflow-x-auto py-1">
              {list.map((b, i) => {
                const have = ownedForm(profile, b.id) >= 0
                const c = ELEMENT_BY_ID[b.element].color
                return (
                  <button
                    key={b.id}
                    ref={i === index ? (n) => n?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                    onClick={() => pick(i)}
                    className={`font-display shrink-0 rounded-full border px-3 py-1.5 text-[11px] tracking-wider transition ${
                      i === index
                        ? 'bg-white/10 text-white'
                        : have
                          ? 'text-white/70 hover:text-white'
                          : 'text-white/35 hover:text-white/70'
                    }`}
                    style={{ borderColor: i === index ? c : `${c}55` }}
                  >
                    {!have && '🔒 '}
                    {b.name}
                  </button>
                )
              })}
            </div>
            <ArrowButton label="▶" onClick={() => pick(index + 1)} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

const MOVES: [Move, string][] = [
  ['bite', 'BITE'],
  ['breath', 'BLAST'],
  ['clawSwipe', 'CLAW'],
  ['tailWhip', 'TAIL SPIN'],
  ['stomp', 'STOMP'],
  ['roar', 'ROAR'],
  ['guard', 'GUARD'],
]

/** Whole-body motion for a shown-off move: lunges, spins, rearing up, rising for a roar. */
function MoveBody({ pose, children }: { pose: React.RefObject<Pose | null>; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    const p = pose.current
    if (!g) return
    const now = clock.elapsedTime
    if (p && p.start === null) p.start = now
    const t = p?.start != null ? now - p.start : 99
    let fwd = 0
    let lift = 0
    let pitch = 0
    let yaw = 0
    switch (p?.move) {
      case 'bite':
        fwd = 0.9 * env(t, 0.1, 0.85)
        pitch = 0.08 * env(t, 0.2, 0.8)
        break
      case 'breath':
        fwd = -0.3 * env(t, 0, 1.5)
        pitch = -0.1 * env(t, 0, 1.5)
        break
      case 'clawSwipe':
        pitch = -0.35 * env(t, 0, 0.7)
        fwd = 0.6 * env(t, 0.35, 0.95)
        yaw = 0.25 * env(t, 0.3, 0.95)
        break
      case 'tailWhip':
        yaw = THREE.MathUtils.smoothstep(t, 0.05, 1.05) * Math.PI * 2 * (t < 1.2 ? 1 : 0)
        break
      case 'stomp':
        pitch = -0.5 * env(t, 0, 0.75)
        lift = 0.3 * env(t, 0, 0.75)
        break
      case 'roar':
        lift = 0.6 * env(t, 0, 1.5)
        pitch = -0.2 * env(t, 0, 1.5)
        break
      case 'guard':
        fwd = -0.3 * env(t, 0, 1.4)
        break
    }
    if (t > 2.2 && p) pose.current = null
    g.position.set(0, lift, fwd)
    g.rotation.set(pitch, yaw, 0)
  })
  return <group ref={ref}>{children}</group>
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/40 py-2">
      <p className="font-display text-[9px] tracking-[0.3em] text-white/40">{label}</p>
      <p className="font-display mt-1 text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function ArrowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/50 text-lg backdrop-blur transition hover:bg-white/15"
    >
      {label}
    </button>
  )
}

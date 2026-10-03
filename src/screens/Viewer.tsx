import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { GPowerCounter } from '../components/GPowerCounter'
import { abilityLabel, abilitySelfBonus, BAKUGAN, type Ability } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { useGame } from '../store/useGame'
import { EFFECT_DURATION } from '../three/AbilityEffect'
import { savePhoto } from '../photo'
import { BrawlScene, type Phase } from '../three/BrawlScene'
import { PhotoCapture } from '../three/PhotoCapture'

const BRAWL_SEQUENCE_MS = 3000

export function Viewer() {
  const bakuganId = useGame((s) => s.bakuganId)
  const go = useGame((s) => s.go)
  const compareWith = useGame((s) => s.compareWith)
  const bakugan = BAKUGAN.find((b) => b.id === bakuganId)!
  const element = ELEMENT_BY_ID[bakugan.element]

  const [phase, setPhase] = useState<Phase>('ball')
  const [evolution, setEvolution] = useState(0)
  const [ballOpen, setBallOpen] = useState(false)
  const [used, setUsed] = useState<string[]>([])
  const [activeAbility, setActiveAbility] = useState<{ ability: Ability; key: number } | null>(null)
  const [photoRequest, setPhotoRequest] = useState(0)
  const [flash, setFlash] = useState(0)
  const [shout, setShout] = useState<{ text: string; sub?: string; key: number } | null>(null)

  const evo = bakugan.evolutions[evolution]
  const baseG = evo.gPower
  const brawlG = baseG + (bakugan.brawlG - bakugan.baseG)
  const abilityBoost = bakugan.abilities.filter((a) => used.includes(a.id)).reduce((sum, a) => sum + abilitySelfBonus(a), 0)
  const gPower = phase === 'monster' ? brawlG + abilityBoost : baseG

  const say = (text: string, sub?: string) => setShout({ text, sub, key: Date.now() })

  useEffect(() => {
    if (!shout) return
    const id = window.setTimeout(() => setShout(null), 1500)
    return () => window.clearTimeout(id)
  }, [shout])

  useEffect(() => {
    if (!activeAbility) return
    const id = window.setTimeout(() => setActiveAbility(null), EFFECT_DURATION * 1000)
    return () => window.clearTimeout(id)
  }, [activeAbility])

  function setGateCard() {
    playSfx('gateCard')
    say('GATE CARD, SET!')
    setPhase('gate')
  }

  function brawl() {
    playSfx('brawl')
    say('BAKUGAN, BRAWL!', `${element.name} ${evo.name}, stand!`)
    setPhase('brawling')
    window.setTimeout(() => setPhase('monster'), BRAWL_SEQUENCE_MS)
  }

  function activate(ability: Ability) {
    if (used.includes(ability.id)) return
    playSfx('ability')
    say('ABILITY ACTIVATE!', ability.name)
    setUsed((u) => [...u, ability.id])
    setActiveAbility({ ability, key: Date.now() })
  }

  function takePhoto() {
    playSfx('gateCard')
    setFlash(Date.now())
    setPhotoRequest((n) => n + 1)
  }

  function reset() {
    setPhase('ball')
    setUsed([])
    setActiveAbility(null)
  }

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 1.4, 5], fov: 45 }} dpr={[1, 2]}>
        <BrawlScene bakugan={bakugan} element={element} phase={phase} form={evolution} ballOpen={ballOpen} activeAbility={activeAbility} />
        <PhotoCapture
          request={photoRequest}
          onCapture={(url) => void savePhoto(url, { name: evo.name, brawler: bakugan.brawler, gPower, element })}
        />
      </Canvas>

      {/* header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-8">
        <div className="pointer-events-auto">
          <button
            onClick={() => go('hub')}
            className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
          >
            ← BACK
          </button>
          <p className="font-display mt-6 text-xs tracking-[0.5em]" style={{ color: element.color }}>
            {element.name.toUpperCase()} · {evo.series.toUpperCase()}
          </p>
          <h1 className="font-display text-5xl font-black tracking-wider">{evo.name}</h1>
          <p className="mt-1 text-lg text-white/60">Brawler: {bakugan.brawler}</p>
          <p className="mt-3 max-w-sm text-white/70">{bakugan.description}</p>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <GPowerCounter value={gPower} color={element.color} />
          <div className="flex gap-2">
            <SmallButton onClick={takePhoto} label="PHOTO" />
            <SmallButton onClick={() => compareWith(bakugan.id, evolution)} label="FACE-OFF" />
          </div>
        </div>
      </div>

      {/* evolution timeline */}
      <div className="absolute bottom-28 left-8">
        <p className="font-display mb-3 text-xs tracking-[0.5em] text-white/40">EVOLUTION</p>
        <ol className="space-y-2 border-l border-white/15 pl-4">
          {bakugan.evolutions.map((e, i) => (
            <li key={`${e.name}-${e.series}`}>
              <button
                disabled={phase === 'brawling'}
                onClick={() => {
                  setEvolution(i)
                  reset()
                }}
                className={`text-left transition ${i === evolution ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
              >
                <span className="font-display text-sm font-bold">{e.name}</span>
                <span className="block text-xs text-white/40">
                  {e.series} · {e.gPower}G
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* abilities */}
      <AnimatePresence>
        {phase === 'monster' && (
          <motion.div
            className="absolute top-60 right-8 bottom-28 flex w-72 flex-col"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
          >
            <p className="font-display mb-3 text-xs tracking-[0.5em] text-white/40">
              ABILITY CARDS ({bakugan.abilities.length})
            </p>
            {/* scrolls on its own so the cards never cover the G-Power counter */}
            <div className="scroll-panel flex-1 space-y-3 overflow-y-auto pr-2">
              {bakugan.abilities.map((a) => {
                const spent = used.includes(a.id)
                return (
                  <button
                    key={a.id}
                    disabled={spent}
                    onClick={() => activate(a)}
                    className="block w-full rounded-lg border bg-black/50 p-4 text-left backdrop-blur transition enabled:hover:-translate-x-1 disabled:opacity-35"
                    style={{ borderColor: `${element.color}88` }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-sm font-bold">{a.name}</span>
                      <span className="font-display shrink-0 text-sm whitespace-nowrap" style={{ color: element.color }}>
                        {abilityLabel(a)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">{a.description}</p>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* main action */}
      <div className="absolute inset-x-0 bottom-10 flex justify-center gap-4">
        {phase === 'ball' && (
          <>
            <ActionButton
              color="#666"
              subtle
              onClick={() => {
                playSfx('tick')
                setBallOpen((o) => !o)
              }}
              label={ballOpen ? 'CLOSE BALL' : 'OPEN BALL'}
            />
            <ActionButton
              color={element.color}
              onClick={() => {
                setBallOpen(false)
                setGateCard()
              }}
              label="GATE CARD, SET!"
            />
          </>
        )}
        {phase === 'gate' && <ActionButton color={element.color} onClick={brawl} label="BAKUGAN, BRAWL!" />}
        {phase === 'monster' && <ActionButton color="#666" onClick={reset} label="RETURN TO BALL" subtle />}
      </div>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs tracking-widest text-white/30">
        DRAG TO ROTATE · SCROLL TO ZOOM
      </p>

      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shout && (
          <motion.div
            key={shout.key}
            className="pointer-events-none absolute inset-x-0 top-[28%] text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <p
              className="font-display text-6xl font-black italic tracking-wider"
              style={{ color: '#fff', textShadow: `0 0 30px ${element.color}, 0 0 60px ${element.color}` }}
            >
              {shout.text}
            </p>
            {shout.sub && <p className="font-display mt-3 text-2xl tracking-widest" style={{ color: element.glow }}>{shout.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ActionButton({ label, onClick, color, subtle }: { label: string; onClick: () => void; color: string; subtle?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      className={`font-display skew-x-[-12deg] border-2 px-10 py-4 font-black tracking-[0.3em] ${subtle ? 'text-sm' : 'text-xl'}`}
      style={{
        borderColor: color,
        background: subtle ? 'rgba(0,0,0,0.5)' : `${color}33`,
        boxShadow: subtle ? 'none' : `0 0 30px ${color}88`,
      }}
    >
      {label}
    </motion.button>
  )
}

function SmallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-display rounded border border-white/20 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/70 backdrop-blur transition hover:border-white/60 hover:text-white"
    >
      {label}
    </button>
  )
}

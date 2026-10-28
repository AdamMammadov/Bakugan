import { motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { playSfx, unlockAudio } from '../audio/sfx'
import { GAME_SUBTITLE, GAME_TITLE } from '../brand'
import { leadOf } from '../components/menuLead'
import { useParallax } from '../components/parallax'
import { ELEMENTS } from '../data/elements'
import { useProfiles } from '../profile/useProfiles'
import { useGame } from '../store/useGame'

// the 3D scene pulls in three.js: the 2D title is up at once and the Bakugan fades in when it is ready
const TitleStage = lazy(() => import('../components/TitleStage'))

/** The six attribute colours, round a circle. */
const RAINBOW = ELEMENTS.map((e) => e.color)

/** How long the press-any-key flash plays before the game moves on (ms). */
const LEAVE_MS = 520

/**
 * The title screen: the six attribute emblems orbiting a Bakugan that bursts out of its ball, searchlights,
 * rising sparks and the game's name sweeping in; any key or click starts. Layers drift with the mouse.
 */
export function IntroScreen() {
  const go = useGame((s) => s.go)
  const root = useRef<HTMLDivElement>(null)
  useParallax(root)
  const [leaving, setLeaving] = useState(false)
  const [stageIn, setStageIn] = useState(false)
  // the hero: the returning player's lead, else Dragonoid
  const hero = useMemo(() => {
    const { profiles, activeId } = useProfiles.getState()
    const profile = profiles.find((p) => p.id === activeId) ?? null
    return leadOf(profile, profile?.element ?? 'pyrus')
  }, [])

  useEffect(() => {
    let done = false
    const start = () => {
      if (done) return
      done = true
      unlockAudio()
      playSfx('start')
      setLeaving(true)
      window.setTimeout(() => {
        // returning players land on the main menu; a new player picks an attribute first
        const profile = useProfiles.getState().profiles.find((p) => p.id === useProfiles.getState().activeId)
        if (profile) useGame.setState({ element: profile.element, screen: 'menu' })
        else go('wheel')
      }, LEAVE_MS)
    }
    window.addEventListener('keydown', start)
    window.addEventListener('pointerdown', start)
    return () => {
      window.removeEventListener('keydown', start)
      window.removeEventListener('pointerdown', start)
    }
  }, [go])

  const letters = GAME_TITLE.toUpperCase().split('')
  return (
    <motion.div
      ref={root}
      className="absolute inset-0 cursor-pointer overflow-hidden bg-[#04050a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.6 }}
    >
      {/* far: the six attribute colours turning as an aurora, searchlights, sparks */}
      <div className="parallax-far pointer-events-none absolute inset-0">
        <div className="absolute top-[38%] left-1/2 h-[170vh] w-[170vh] -translate-x-1/2 -translate-y-1/2">
          <div
            className="menu-spin h-full w-full rounded-full opacity-40 blur-3xl"
            style={{ background: `conic-gradient(from 0deg, ${RAINBOW.join(', ')}, ${RAINBOW[0]})` }}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_10%,#04050a_62%)]" />
        {[8, 30, 70, 92].map((left, i) => (
          <div
            key={left}
            className="bd-beam absolute bottom-[-12vh] h-[125vh] w-[16vh] origin-bottom opacity-[0.16] blur-sm"
            style={{
              left: `${left}%`,
              background: `linear-gradient(to top, ${RAINBOW[(i * 2) % 6]}, transparent 80%)`,
              animationDelay: `${-i * 2.1}s`,
              animationDuration: `${8 + i * 1.7}s`,
            }}
          />
        ))}
        {Array.from({ length: 34 }, (_, i) => (
          <span
            key={i}
            className="menu-mote"
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              width: 2 + (i % 4) * 2,
              height: 2 + (i % 4) * 2,
              background: i % 4 ? RAINBOW[i % 6] : '#fff',
              boxShadow: `0 0 10px ${RAINBOW[i % 6]}`,
              animationDuration: `${8 + ((i * 7) % 10)}s`,
              animationDelay: `${-((i * 13) % 17)}s`,
            }}
          />
        ))}
      </div>

      {/* mid: the energy core and the emblems' far half of the orbit, behind the Bakugan */}
      <div className="parallax-mid pointer-events-none absolute inset-0">
        <motion.div
          className="absolute top-[35%] left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, #fff6 0%, #ffb34733 30%, transparent 68%)' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
        />
        <Orbit half="back" />
      </div>

      {/* the Bakugan */}
      <motion.div
        className="parallax-near pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: stageIn ? 1 : 0 }}
        transition={{ duration: 0.8 }}
      >
        <Suspense fallback={null}>
          <TitleStage id={hero.bakugan.id} form={hero.form} skin={hero.skin} onReady={() => setStageIn(true)} />
        </Suspense>
      </motion.div>

      {/* near: the orbit's front half, in front of the Bakugan */}
      <div className="parallax-mid pointer-events-none absolute inset-0">
        <Orbit half="front" />
      </div>

      {/* cinematic bars and a floor glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[12vh] bg-gradient-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] bg-gradient-to-t from-[#04050a] via-[#04050ae6] to-transparent" />

      {/* the name */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[5vh] flex flex-col items-center">
        <h1
          className="title-name relative flex overflow-hidden px-6 py-2"
          aria-label={GAME_TITLE}
          // the name fills most of the width whatever its length
          style={{ fontSize: `min(8.5rem, ${(88 / (letters.length * 0.95)).toFixed(2)}vw)` }}
        >
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              className="title-letter font-display leading-none font-black italic"
              initial={{ opacity: 0, y: 60, scale: 1.8, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              transition={{ delay: 0.35 + i * 0.07, duration: 0.55, ease: [0.2, 0.9, 0.3, 1.15] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </h1>
        <motion.div
          className="mt-3 flex items-center gap-4"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.35 + letters.length * 0.07 + 0.2, duration: 0.5, ease: 'easeOut' }}
        >
          <span
            className="h-[3px] w-[12vw] rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${RAINBOW.join(', ')})` }}
          />
          <span className="font-display text-[clamp(0.8rem,1.3vw,1.15rem)] font-bold tracking-[0.7em] text-white/85">
            {GAME_SUBTITLE.toUpperCase()}
          </span>
          <span
            className="h-[3px] w-[12vw] rounded-full"
            style={{ background: `linear-gradient(90deg, ${[...RAINBOW].reverse().join(', ')}, transparent)` }}
          />
        </motion.div>
        <motion.p
          className="font-display mt-[4vh] flex items-center gap-4 rounded-full border border-white/25 bg-black/40 px-7 py-2.5 text-[clamp(0.85rem,1.25vw,1.15rem)] font-bold tracking-[0.5em] text-white shadow-[0_0_30px_#ffb34733] backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ delay: 1.6, repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
        >
          <span className="title-chevron">›</span>
          PRESS ANY KEY
          <span className="title-chevron -scale-x-100">›</span>
        </motion.p>
      </div>

      {/* pressing a key: a flash, then on */}
      {leaving && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-white"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: LEAVE_MS / 1000 }}
        />
      )}
    </motion.div>
  )
}

/**
 * The six attribute emblems circling on a tilted ring round the Bakugan. Drawn twice, cut in half: the far half
 * behind the Bakugan, the near half in front of it, so the ring passes round it.
 */
function Orbit({ half }: { half: 'back' | 'front' }) {
  return (
    <div
      className="absolute inset-0"
      style={{ clipPath: half === 'back' ? 'inset(0 0 calc(100% - 46vh) 0)' : 'inset(46vh 0 0 0)' } as CSSProperties}
    >
      <div className="title-orbit absolute top-[46vh] left-1/2 h-[92vh] w-[92vh] -translate-x-1/2 -translate-y-1/2">
        <div className="title-orbit-spin relative h-full w-full">
          <div className="absolute inset-[6%] rounded-full border-2 border-white/15 shadow-[0_0_40px_#ffffff22,inset_0_0_40px_#ffffff18]" />
          <div className="absolute inset-0 rounded-full border border-dashed border-white/10" />
          {ELEMENTS.map((e, i) => (
            <div
              key={e.id}
              className="absolute top-1/2 left-1/2"
              style={{ transform: `rotate(${i * 60}deg) translateX(44vh) rotate(${-i * 60}deg)` }}
            >
              <div className="title-orbit-face -translate-x-1/2 -translate-y-1/2">
                <img
                  src={e.icon}
                  alt=""
                  draggable={false}
                  className="h-[9vh] w-[9vh] max-w-none"
                  style={{ filter: `drop-shadow(0 0 18px ${e.glow})` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

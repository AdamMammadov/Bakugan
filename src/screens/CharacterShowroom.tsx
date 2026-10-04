import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { CharacterPortrait } from '../components/Avatar'
import { PageNav } from '../components/PageNav'
import { BAKUGAN } from '../data/bakugan'
import { CHARACTER_INFO } from '../data/characters'
import { ELEMENT_BY_ID } from '../data/elements'
import { CHARACTERS } from '../profile/avatar'
import { Brawler, type BrawlerGesture } from '../three/Brawler'

/** Browse the series' brawlers: turn their 3D model around and read their profile. */
export function CharacterShowroom() {
  const [index, setIndex] = useState(0)
  const [gesture, setGesture] = useState<{ kind: BrawlerGesture; key: number }>({ kind: null, key: 0 })
  const c = CHARACTERS[index]
  const info = CHARACTER_INFO[c.id]
  const element = ELEMENT_BY_ID[c.element]
  const partner = BAKUGAN.find((b) => c.bakugan.includes(b.name) || b.name.includes(c.bakugan))

  const step = useCallback((d: number) => {
    playSfx('tick')
    setIndex((i) => (i + d + CHARACTERS.length) % CHARACTERS.length)
    setGesture({ kind: null, key: Date.now() })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(circle at 50% 45%, ${element.color}40, #05060a 65%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Canvas shadows camera={{ position: [0, 1.25, 3.6], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow />
        <pointLight position={[-2, 2, -2]} intensity={12} color={element.glow} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.4, 64]} />
          <meshStandardMaterial color="#111219" emissive={element.color} emissiveIntensity={0.15} />
        </mesh>
        <Suspense fallback={null}>
          <group key={c.id}>
            <Brawler parts={c.parts} model={c.model} color={element.color} gesture={gesture} />
          </group>
        </Suspense>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.6} scale={4} blur={2} far={2} />
        <OrbitControls target={[0, 0.95, 0]} enablePan={false} minDistance={1.4} maxDistance={6} autoRotate autoRotateSpeed={1.2} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col px-12 py-8">
        <div className="pointer-events-auto">
          <PageNav current="characters" />
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={c.id}
            className="pointer-events-auto mt-8 w-[30rem] max-w-[38vw]"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-2">
              <img src={element.icon} alt="" className="h-7 w-7" />
              <span className="font-display text-xs tracking-[0.4em]" style={{ color: element.color }}>
                {element.name.toUpperCase()} · {info?.role.toUpperCase()}
              </span>
            </div>
            <h1 className="font-display mt-2 text-5xl font-black tracking-wide">{c.name}</h1>
            <p className="mt-1 text-white/55">
              Partner Bakugan: <span className="text-white">{partner?.name ?? c.bakugan}</span>
            </p>
            <p className="mt-4 leading-relaxed text-white/80">{info?.story}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-display text-[10px] tracking-[0.3em] text-emerald-300/80">STRENGTHS</p>
                <ul className="mt-1 space-y-1 text-white/75">
                  {info?.strengths.map((s) => (
                    <li key={s}>▲ {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-display text-[10px] tracking-[0.3em] text-rose-300/80">WEAKNESSES</p>
                <ul className="mt-1 space-y-1 text-white/75">
                  {info?.weaknesses.map((s) => (
                    <li key={s}>▼ {s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/60">
              <span className="font-display text-[10px] tracking-[0.3em] text-white/40">BRAWL STYLE · </span>
              {info?.style}
            </p>
            <div className="mt-5 flex gap-2">
              {(['card', 'point', 'cheer'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGesture({ kind: g, key: Date.now() })}
                  className="font-display rounded border border-white/25 px-3 py-1.5 text-[10px] tracking-[0.3em] hover:bg-white/10"
                >
                  {g === 'card' ? 'ABILITY CARD' : g === 'point' ? 'BAKUGAN, BRAWL!' : 'VICTORY'}
                </button>
              ))}
            </div>
            {!c.model && <p className="mt-3 text-xs text-white/40">3D game model coming soon — shown as a stand-in figure.</p>}
          </motion.section>
        </AnimatePresence>

        <p className="mt-auto text-center text-xs tracking-[0.3em] text-white/35">DRAG TO TURN · SCROLL TO ZOOM · ← → TO SWITCH</p>
        {/* character strip */}
        <div className="pointer-events-auto mt-3 flex items-center justify-center gap-3">
          <ArrowButton label="◀" onClick={() => step(-1)} />
          {CHARACTERS.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => {
                playSfx('tick')
                setIndex(i)
              }}
              title={ch.name}
              className={`h-14 w-14 overflow-hidden rounded-full border-2 transition ${i === index ? 'scale-110' : 'opacity-50 hover:opacity-90'}`}
              style={{ borderColor: i === index ? ELEMENT_BY_ID[ch.element].color : 'transparent' }}
            >
              {ch.image ? (
                <CharacterPortrait src={ch.image} color={ELEMENT_BY_ID[ch.element].color} />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-lg font-bold">{ch.name[0]}</span>
              )}
            </button>
          ))}
          <ArrowButton label="▶" onClick={() => step(1)} />
        </div>
      </div>
    </motion.div>
  )
}

function ArrowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/50 text-lg backdrop-blur transition hover:bg-white/15"
    >
      {label}
    </button>
  )
}

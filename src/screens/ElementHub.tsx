import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { BakuganInfo } from '../components/BakuganInfo'
import { bakuganForElement, type Bakugan } from '../data/bakugan'
import { GRID, GRID_SIZE } from '../components/grid'
import { ELEMENT_BY_ID } from '../data/elements'
import { ownsBakugan, seasonFor, unlockHint, useActiveProfile } from '../profile/useProfiles'
import { currentSeason } from '../season/current'
import { passLevel, timeLeft } from '../season/season'
import { useGame } from '../store/useGame'

/** Season countdown and pass level, opening the Season Pass. */
function SeasonChip() {
  const profile = useActiveProfile()
  const openPage = useGame((s) => s.openPage)
  const info = currentSeason()
  const level = profile ? passLevel(seasonFor(profile).passXp) : 0
  return (
    <button
      onClick={() => openPage('pass')}
      className="ml-auto rounded-xl border-2 border-amber-300/60 bg-black/50 px-5 py-3 text-left backdrop-blur transition hover:bg-amber-300/10"
    >
      <p className="font-display text-[10px] tracking-[0.4em] text-amber-300">
        SEASON {info.id} · ENDS IN {timeLeft(info.endsAt - Date.now()).toUpperCase()}
      </p>
      <p className="font-display mt-1 text-xl font-black">
        SEASON PASS {profile && <span className="text-white/60">· LEVEL {level}</span>}
      </p>
    </button>
  )
}

export function ElementHub() {
  const profile = useActiveProfile()
  const elementId = useGame((s) => s.element)!
  const go = useGame((s) => s.go)
  const openBakugan = useGame((s) => s.openBakugan)
  const element = ELEMENT_BY_ID[elementId]
  const roster = bakuganForElement(elementId)
  const [info, setInfo] = useState<Bakugan | null>(null)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-12"
      style={{
        backgroundImage: `radial-gradient(circle at 15% 10%, ${element.color}30 0%, transparent 50%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={() => go('wheel')}
        className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
      >
        ← CHANGE ATTRIBUTE
      </button>

      <header className="mt-8 flex items-center gap-6">
        <img src={element.icon} alt="" className="h-24 w-24" style={{ filter: `drop-shadow(0 0 20px ${element.glow})` }} />
        <div>
          <p className="font-display text-xs tracking-[0.5em] text-white/40">{element.attribute.toUpperCase()} ATTRIBUTE</p>
          <h1 className="font-display text-5xl font-black tracking-wider" style={{ color: element.color }}>
            {element.name.toUpperCase()} BAKUGAN
          </h1>
        </div>
        <SeasonChip />
      </header>

      <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
        {roster.map((b, i) => {
          const locked = !ownsBakugan(profile, b.id)
          const open = () => (locked ? setInfo(b) : openBakugan(b.id))
          return (
            <motion.div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              className={`group relative cursor-pointer overflow-hidden rounded-xl border p-6 text-left transition ${
                locked ? 'border-white/5 bg-black/40' : 'border-white/10 bg-white/[0.03] hover:border-white/30'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              whileHover={{ y: -4 }}
            >
              {!locked && (
                <div
                  className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60"
                  style={{ background: element.color }}
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setInfo(b)
                }}
                aria-label={`About ${b.name}`}
                title="Bakugan info"
                className="font-display absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border text-base font-bold transition hover:scale-110"
                style={{ borderColor: element.color, color: element.color, background: '#0008' }}
              >
                i
              </button>
              <div className={locked ? 'opacity-45 grayscale' : ''}>
                <p className="text-sm text-white/40">{b.series}</p>
                <h2 className="font-display mt-1 text-3xl font-bold">
                  {locked && '🔒 '}
                  {b.name}
                </h2>
                <p className="mt-1 text-white/60">Brawler: {b.brawler}</p>
                <p className="mt-4 line-clamp-2 text-white/70">{b.description}</p>
              </div>
              <div className="mt-6 flex items-end justify-between gap-3">
                <span
                  className={`font-display text-2xl font-bold ${locked ? 'opacity-45' : ''}`}
                  style={{ color: element.color }}
                >
                  {b.baseG}G
                </span>
                {locked ? (
                  <span className="text-right text-xs leading-snug text-white/60">{unlockHint(profile, b)}</span>
                ) : (
                  <span className="font-display text-xs tracking-[0.3em] text-white/50 group-hover:text-white">INSPECT →</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {info && (
          <BakuganInfo
            bakugan={info}
            onClose={() => setInfo(null)}
            onInspect={() => openBakugan(info.id)}
            locked={ownsBakugan(profile, info.id) ? undefined : unlockHint(profile, info)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { BakuganInfo } from '../components/BakuganInfo'
import { bakuganForElement, type Bakugan } from '../data/bakugan'
import { GRID, GRID_SIZE } from '../components/grid'
import { ELEMENT_BY_ID } from '../data/elements'
import { useGame } from '../store/useGame'

export function ElementHub() {
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
      </header>

      <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
        {roster.map((b, i) => (
          <motion.div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => openBakugan(b.id)}
            onKeyDown={(e) => e.key === 'Enter' && openBakugan(b.id)}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-white/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            whileHover={{ y: -4 }}
          >
            <div
              className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60"
              style={{ background: element.color }}
            />
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
            <p className="text-sm text-white/40">{b.series}</p>
            <h2 className="font-display mt-1 text-3xl font-bold">{b.name}</h2>
            <p className="mt-1 text-white/60">Brawler: {b.brawler}</p>
            <p className="mt-4 line-clamp-2 text-white/70">{b.description}</p>
            <div className="mt-6 flex items-end justify-between">
              <span className="font-display text-2xl font-bold" style={{ color: element.color }}>
                {b.baseG}G
              </span>
              <span className="font-display text-xs tracking-[0.3em] text-white/50 group-hover:text-white">INSPECT →</span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {info && <BakuganInfo bakugan={info} onClose={() => setInfo(null)} onInspect={() => openBakugan(info.id)} />}
      </AnimatePresence>
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { abilityLabel, battleEffect, type Bakugan } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'

/** Full profile of a Bakugan: lore, evolutions and every ability card. */
export function BakuganInfo({ bakugan, onClose, onInspect }: { bakugan: Bakugan; onClose: () => void; onInspect: () => void }) {
  const element = ELEMENT_BY_ID[bakugan.element]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-8 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-[#0a0b11]"
        style={{ borderColor: `${element.color}66`, boxShadow: `0 0 60px ${element.color}33` }}
        initial={{ y: 30, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center gap-6 p-8 pb-6"
          style={{ background: `radial-gradient(circle at 0% 0%, ${element.color}30, transparent 60%)` }}
        >
          <img src={element.icon} alt="" className="h-20 w-20" style={{ filter: `drop-shadow(0 0 16px ${element.glow})` }} />
          <div className="flex-1">
            <p className="font-display text-xs tracking-[0.4em]" style={{ color: element.color }}>
              {element.name.toUpperCase()} · {bakugan.series.toUpperCase()}
            </p>
            <h2 className="font-display text-4xl font-black tracking-wider">{bakugan.name}</h2>
            <p className="text-white/60">Brawler: {bakugan.brawler}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="font-display self-start rounded-full border border-white/20 px-3 py-1 text-sm text-white/60 transition hover:text-white"
          >
            ✕
          </button>
        </header>

        <div className="scroll-panel overflow-y-auto px-8 pb-8">
          <p className="text-lg leading-relaxed text-white/80">{bakugan.description}</p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <Stat label="BASE G-POWER" value={`${bakugan.baseG}G`} color={element.color} />
            <Stat label="ON A GATE CARD" value={`${bakugan.brawlG}G`} color={element.color} />
            <Stat label="ABILITY CARDS" value={String(bakugan.abilities.length)} color={element.color} />
          </div>

          <h3 className="font-display mt-8 text-xs tracking-[0.5em] text-white/40">EVOLUTION</h3>
          <ol className="mt-3 flex flex-wrap items-center gap-2">
            {bakugan.evolutions.map((e, i) => (
              <li key={`${e.name}-${e.series}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/30">→</span>}
                <span className="rounded-md border border-white/15 px-3 py-1.5">
                  <span className="font-semibold">{e.name}</span>
                  <span className="ml-2 text-sm text-white/50">
                    {e.series} · {e.gPower}G
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <h3 className="font-display mt-8 text-xs tracking-[0.5em] text-white/40">ABILITY CARDS</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {bakugan.abilities.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display font-bold">{a.name}</span>
                  <span className="font-display shrink-0 text-sm whitespace-nowrap" style={{ color: element.color }}>
                    {abilityLabel(a)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/70">{a.description}</p>
                <p className="mt-2 text-xs text-white/45">Arena: {battleEffect(a)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/35">Card texts: BakuProject card database.</p>
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button
            onClick={onInspect}
            className="font-display border-2 px-6 py-2 text-sm tracking-[0.3em] transition hover:bg-white/10"
            style={{ borderColor: element.color }}
          >
            INSPECT IN 3D →
          </button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <p className="font-display text-[10px] tracking-[0.3em] text-white/40">{label}</p>
      <p className="font-display mt-1 text-2xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

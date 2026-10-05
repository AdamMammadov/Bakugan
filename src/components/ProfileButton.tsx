import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ELEMENT_BY_ID } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame, type PageScreen } from '../store/useGame'
import { Avatar } from './Avatar'

const ITEMS: [PageScreen, string][] = [
  ['profile', 'PROFILE'],
  ['pass', 'SEASON PASS'],
  ['shop', 'SHOP'],
  ['encyclopedia', 'ENCYCLOPEDIA'],
  ['showroom', 'BAKUGAN SHOWROOM'],
  ['characters', 'CHARACTERS'],
  ['rankings', 'RANKINGS'],
  ['clans', 'CLANS'],
]

/** One compact corner button: the player's chip, opening a menu of the player pages. */
export function ProfileButton() {
  const profile = useActiveProfile()
  const openPage = useGame((s) => s.openPage)
  const editProfile = useGame((s) => s.editProfile)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const color = profile ? ELEMENT_BY_ID[profile.element].color : '#9aa3b5'
  return (
    <div ref={box} className="fixed right-[15.5rem] bottom-5 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 bottom-full mb-2 w-52 overflow-hidden rounded-xl border border-white/15 bg-black/90 backdrop-blur"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {!profile && (
              <MenuItem
                label="+ CREATE PROFILE"
                onClick={() => {
                  setOpen(false)
                  editProfile(null)
                }}
              />
            )}
            {ITEMS.filter(([id]) => profile || id !== 'profile').map(([id, label]) => (
              <MenuItem
                key={id}
                label={label}
                onClick={() => {
                  setOpen(false)
                  openPage(id)
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Menu"
        className="flex items-center gap-2 rounded-full border bg-black/60 py-1 pr-4 pl-1 backdrop-blur transition hover:bg-black/80"
        style={{ borderColor: `${color}88` }}
      >
        {profile ? (
          <Avatar avatar={profile.avatar} color={color} size={28} frame={profile.cosmetics?.frame} />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-sm">☰</span>
        )}
        <span className="font-display text-xs tracking-widest">
          {profile ? `${profile.firstName.toUpperCase()} · ${profile.bp.toLocaleString('en')} BP` : 'MENU'}
        </span>
        <span className="text-[10px] text-white/50">{open ? '▼' : '▲'}</span>
      </button>
    </div>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-display block w-full px-4 py-2.5 text-left text-xs tracking-[0.3em] text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </button>
  )
}

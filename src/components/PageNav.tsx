import { useRef } from 'react'
import { useGame, type PageScreen } from '../store/useGame'

const TABS: [PageScreen, string][] = [
  ['profile', 'PROFILE'],
  ['inventory', 'INVENTORY'],
  ['pass', 'SEASON PASS'],
  ['shop', 'SHOP'],
  ['rankings', 'RANKINGS'],
  ['clans', 'CLANS'],
  ['encyclopedia', 'ENCYCLOPEDIA'],
  ['showroom', 'BAKUGAN'],
  ['characters', 'CHARACTERS'],
]

/** Back button plus tabs between the player pages. */
export function PageNav({ current, children }: { current: PageScreen; children?: React.ReactNode }) {
  const back = useGame((s) => s.back)
  const go = useGame((s) => s.go)
  const openPage = useGame((s) => s.openPage)
  const nav = useRef<HTMLElement>(null)
  const target = [
    'profile',
    'inventory',
    'pass',
    'shop',
    'rankings',
    'clans',
    'encyclopedia',
    'showroom',
    'characters',
    'profileEdit',
  ].includes(back)
    ? 'hub'
    : back
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => go(useGame.getState().element ? target : 'wheel')}
        className="font-display shrink-0 text-xs tracking-[0.4em] whitespace-nowrap text-white/50 transition hover:text-white"
      >
        ← BACK
      </button>
      {/* the tabs scroll sideways when the window is too narrow for all of them */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <ScrollButton label="◀" onClick={() => nav.current?.scrollBy({ left: -240, behavior: 'smooth' })} />
        <nav
          ref={nav}
          className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/40 p-1"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              ref={id === current ? (n) => n?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
              onClick={() => openPage(id)}
              className={`font-display shrink-0 rounded-full px-4 py-1.5 text-xs tracking-[0.3em] whitespace-nowrap transition ${
                id === current ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <ScrollButton label="▶" onClick={() => nav.current?.scrollBy({ left: 240, behavior: 'smooth' })} />
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

function ScrollButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[10px] text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </button>
  )
}

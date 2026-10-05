import { useGame, type PageScreen } from '../store/useGame'

const TABS: [PageScreen, string][] = [
  ['profile', 'PROFILE'],
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
  const target = [
    'profile',
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
    <div className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-8">
        <button
          onClick={() => go(useGame.getState().element ? target : 'wheel')}
          className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
        >
          ← BACK
        </button>
        <nav className="flex gap-1 rounded-full border border-white/10 bg-black/40 p-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => openPage(id)}
              className={`font-display rounded-full px-4 py-1.5 text-xs tracking-[0.3em] transition ${
                id === current ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}

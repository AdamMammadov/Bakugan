import { backOf, useGame, type PageScreen } from '../store/useGame'

/**
 * The page's way out: back to where it was opened from, and the main menu (where every page has its tile, so the
 * pages no longer carry a bar of tabs to each other).
 */
export function PageNav({ current, children }: { current: PageScreen; children?: React.ReactNode }) {
  const go = useGame((s) => s.go)
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => go(backOf(current))}
        className="font-display shrink-0 text-xs tracking-[0.4em] whitespace-nowrap text-white/50 transition hover:text-white"
      >
        ← BACK
      </button>
      <button
        onClick={() => go('menu')}
        title="Main menu"
        className="font-display flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 text-[10px] tracking-[0.3em] whitespace-nowrap text-white/60 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
      >
        <span className="text-sm leading-none tracking-normal">⌂</span> MENU
      </button>
      <div className="min-w-0 flex-1" />
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

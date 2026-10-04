import { ELEMENT_BY_ID } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { Avatar } from './Avatar'

/** The active player's chip; opens the profile page. */
export function ProfileButton() {
  const profile = useActiveProfile()
  const openProfile = useGame((s) => s.openProfile)
  const editProfile = useGame((s) => s.editProfile)
  const openPage = useGame((s) => s.openPage)
  if (!profile) {
    return (
      <div className="fixed right-40 bottom-5 z-50 flex items-center gap-2">
        <button
          onClick={() => openPage('encyclopedia')}
          className="font-display rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white"
        >
          ENCYCLOPEDIA
        </button>
        <button
          onClick={() => editProfile(null)}
          className="font-display rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white"
        >
          + CREATE PROFILE
        </button>
      </div>
    )
  }
  const color = ELEMENT_BY_ID[profile.element].color
  return (
    <div className="fixed right-40 bottom-5 z-50 flex items-center gap-2">
      {(['encyclopedia', 'rankings', 'clans'] as const).map((page) => (
        <button
          key={page}
          onClick={() => openPage(page)}
          className="font-display rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white"
        >
          {page.toUpperCase()}
        </button>
      ))}
      <button
        onClick={openProfile}
        title="Your profile"
        className="flex items-center gap-2 rounded-full border bg-black/60 py-1 pr-4 pl-1 backdrop-blur transition hover:bg-black/80"
        style={{ borderColor: `${color}88` }}
      >
        <Avatar avatar={profile.avatar} color={color} size={30} />
        <span className="font-display text-xs tracking-widest">
          {profile.firstName.toUpperCase()} · {profile.bp.toLocaleString('en')} BP
        </span>
      </button>
    </div>
  )
}

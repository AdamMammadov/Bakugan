import { ELEMENT_BY_ID } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { Avatar } from './Avatar'

/** The active player's chip; opens the profile page. */
export function ProfileButton() {
  const profile = useActiveProfile()
  const openProfile = useGame((s) => s.openProfile)
  const editProfile = useGame((s) => s.editProfile)
  if (!profile) {
    return (
      <button
        onClick={() => editProfile(null)}
        className="font-display fixed right-40 bottom-5 z-50 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white"
      >
        + CREATE PROFILE
      </button>
    )
  }
  const color = ELEMENT_BY_ID[profile.element].color
  return (
    <button
      onClick={openProfile}
      title="Your profile"
      className="fixed right-40 bottom-5 z-50 flex items-center gap-2 rounded-full border bg-black/60 py-1 pr-4 pl-1 backdrop-blur transition hover:bg-black/80"
      style={{ borderColor: `${color}88` }}
    >
      <Avatar avatar={profile.avatar} color={color} size={30} />
      <span className="font-display text-xs tracking-widest">
        {profile.firstName.toUpperCase()} · {profile.stats.wins}W
      </span>
    </button>
  )
}

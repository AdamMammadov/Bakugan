import { playSfx } from '../audio/sfx'
import { ELEMENT_BY_ID } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { Avatar } from './Avatar'
import { BpIcon } from './RewardIcon'

const pill =
  'font-display flex h-9 items-center rounded-full border bg-black/60 backdrop-blur transition hover:-translate-y-0.5 hover:bg-black/80 active:translate-y-0'

/** Corner buttons off the main menu: the player's chip (their profile) and the way back to the main menu. */
export function ProfileButton() {
  const profile = useActiveProfile()
  const openPage = useGame((s) => s.openPage)
  const go = useGame((s) => s.go)
  const color = profile ? ELEMENT_BY_ID[profile.element].color : '#9aa3b5'
  return (
    <div className="flex items-center gap-2">
      {profile && (
        <button
          onClick={() => openPage('profile')}
          title="Your profile"
          className={`${pill} gap-2 pr-4 pl-1 text-xs tracking-widest`}
          style={{ borderColor: `${color}88` }}
        >
          <Avatar avatar={profile.avatar} color={color} size={28} frame={profile.cosmetics?.frame} />
          {profile.firstName.toUpperCase()} · <BpIcon size={15} /> {profile.bp.toLocaleString('en')}
        </button>
      )}
      <button
        onClick={() => {
          playSfx('tick')
          go('menu')
        }}
        title="Main menu"
        className={`${pill} gap-1.5 border-white/25 px-4 text-xs tracking-[0.3em] text-white/80 hover:border-white/60 hover:text-white`}
      >
        <span className="text-base leading-none tracking-normal">⌂</span> MENU
      </button>
    </div>
  )
}

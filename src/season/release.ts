import { BAKUGAN } from '../data/bakugan'
import { devView } from '../profile/devView'
import { currentSeason, seasonOfBakugan } from './current'

/**
 * The launch Bakugan: 4 of each attribute, there from the start. A new player gets the weakest of their
 * attribute's four (listed first); the other three are bought or earned. Every other Bakugan comes with a season.
 */
export const LAUNCH = [
  ...['saurus', 'dragonoid', 'falconeer', 'rubanoid'],
  ...['robotallion', 'preyas', 'preyas-diablo', 'sirenoid'],
  ...['baliton', 'gorem', 'cycloid', 'manion'],
  ...['monarus', 'skyress', 'harpus', 'ravenoid'],
  ...['tigrerra', 'tentaclear', 'pegatrix', 'laserman'],
  ...['fear-ripper', 'hydranoid', 'hades', 'howlkor'],
]

/**
 * The game owner's own Bakugan: never released to players; the owner's browser (devView) shows them and gives
 * them to its profiles with every card unlocked.
 */
export const OWNER_ONLY = ['dharak']

/**
 * Whether players can see and get a Bakugan: the launch ones always, a season's from the day that season
 * begins. Bakugan not given a season yet stay hidden.
 */
export const isReleased = (id: string, now = Date.now()) => {
  if (OWNER_ONLY.includes(id)) return false
  if (LAUNCH.includes(id)) return true
  const s = seasonOfBakugan(id)
  return !!s && s.season <= currentSeason(now).id
}

/** The Bakugan players can see and get now. */
export const released = () => BAKUGAN.filter((b) => isReleased(b.id))

/** What the showroom and the encyclopedia show: every Bakugan in the owner's own browser, else the released ones. */
export const viewable = () => (devView() ? BAKUGAN : released())

import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { playMusic, type Track } from './audio/music'
import { MuteButton } from './components/MuteButton'
import { ProfileButton } from './components/ProfileButton'
import { SeasonNotice } from './components/SeasonNotice'
import { CompareScreen } from './screens/CompareScreen'
import { ElementHub } from './screens/ElementHub'
import { ElementWheel } from './screens/ElementWheel'
import { IntroScreen } from './screens/IntroScreen'
import { ProfileEditor } from './screens/ProfileEditor'
import { ProfileScreen } from './screens/ProfileScreen'
import { ClansScreen } from './screens/ClansScreen'
import { RankingsScreen } from './screens/RankingsScreen'
import { EncyclopediaScreen } from './screens/EncyclopediaScreen'
import { ShopScreen } from './screens/ShopScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { SeasonPassScreen } from './screens/SeasonPassScreen'
import { useGame, type Screen } from './store/useGame'

// The 3D viewer pulls in three.js, so load it only when needed.
const Viewer = lazy(() => import('./screens/Viewer').then((m) => ({ default: m.Viewer })))
const BakuganShowroom = lazy(() => import('./screens/BakuganShowroom').then((m) => ({ default: m.BakuganShowroom })))
const CharacterShowroom = lazy(() => import('./screens/CharacterShowroom').then((m) => ({ default: m.CharacterShowroom })))
const ArenaScreen = lazy(() => import('./screens/ArenaScreen').then((m) => ({ default: m.ArenaScreen })))

/** Which theme plays where: each part of the game has its own. */
const TRACK_FOR: Partial<Record<Screen, Track>> = {
  wheel: 'home',
  hub: 'home',
  viewer: 'home',
  compare: 'faceoff',
  arena: 'battle',
  shop: 'shop',
  inventory: 'shop',
  pass: 'anthem',
  profile: 'anthem',
  rankings: 'anthem',
  clans: 'anthem',
  encyclopedia: 'gallery',
  showroom: 'gallery',
  characters: 'gallery',
}

export default function App() {
  const screen = useGame((s) => s.screen)
  // the battle theme in the arena, the calm theme everywhere else (after the first click)
  useEffect(() => {
    if (screen !== 'intro') playMusic(TRACK_FOR[screen] ?? 'menu')
  }, [screen])

  // download every Bakugan model in the background once the player is in, so the viewer,
  // showroom and arena show the real models straight away
  useEffect(() => {
    const t = window.setTimeout(() => void import('./three/BakuganModels').then((m) => m.preloadAllModels()), 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative h-full w-full">
      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          {screen === 'intro' && <IntroScreen key="intro" />}
          {screen === 'wheel' && <ElementWheel key="wheel" />}
          {screen === 'hub' && <ElementHub key="hub" />}
          {screen === 'viewer' && <Viewer key="viewer" />}
          {screen === 'compare' && <CompareScreen key="compare" />}
          {screen === 'arena' && <ArenaScreen key="arena" />}
          {screen === 'profile' && <ProfileScreen key="profile" />}
          {screen === 'profileEdit' && <ProfileEditor key="profileEdit" />}
          {screen === 'rankings' && <RankingsScreen key="rankings" />}
          {screen === 'clans' && <ClansScreen key="clans" />}
          {screen === 'encyclopedia' && <EncyclopediaScreen key="encyclopedia" />}
          {screen === 'pass' && <SeasonPassScreen key="pass" />}
          {screen === 'shop' && <ShopScreen key="shop" />}
          {screen === 'inventory' && <InventoryScreen key="inventory" />}
          {screen === 'showroom' && <BakuganShowroom key="showroom" />}
          {screen === 'characters' && <CharacterShowroom key="characters" />}
        </AnimatePresence>
      </Suspense>
      <SeasonNotice />
      {/* the corner buttons share one row, so they line up whatever their widths */}
      {screen !== 'intro' && (
        <div className="fixed right-5 bottom-5 z-50 flex items-center gap-2">
          {![
            'arena',
            'viewer',
            'profile',
            'profileEdit',
            'rankings',
            'clans',
            'encyclopedia',
            'showroom',
            'shop',
            'inventory',
            'characters',
            'pass',
          ].includes(screen) && <ProfileButton />}
          <MuteButton />
        </div>
      )}
    </div>
  )
}

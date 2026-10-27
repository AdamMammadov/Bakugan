import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { playMusic, type Track } from './audio/music'
import { EventToast } from './components/EventToast'
import { InvitePopup } from './components/InvitePopup'
import { MuteButton } from './components/MuteButton'
import { ProfileButton } from './components/ProfileButton'
import { SeasonNotice } from './components/SeasonNotice'
import { CompareScreen } from './screens/CompareScreen'
import { ElementHub } from './screens/ElementHub'
import { ElementWheel } from './screens/ElementWheel'
import { IntroScreen } from './screens/IntroScreen'
import { MainMenu } from './screens/MainMenu'
import { preloadActiveLead } from './components/menuLead'
import { PageBackdrop } from './components/PageBackdrop'
import { ProfileEditor } from './screens/ProfileEditor'
import { ProfileScreen } from './screens/ProfileScreen'
import { ClansScreen } from './screens/ClansScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { RankingsScreen } from './screens/RankingsScreen'
import { EncyclopediaScreen } from './screens/EncyclopediaScreen'
import { ShopScreen } from './screens/ShopScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { SeasonPassScreen } from './screens/SeasonPassScreen'
import { useGame, type Screen } from './store/useGame'
// pays out event matches whichever screen is open
import './events/progress'

// The 3D viewer pulls in three.js, so load it only when needed.
const Viewer = lazy(() => import('./screens/Viewer').then((m) => ({ default: m.Viewer })))
const BakuganShowroom = lazy(() => import('./screens/BakuganShowroom').then((m) => ({ default: m.BakuganShowroom })))
const CharacterShowroom = lazy(() => import('./screens/CharacterShowroom').then((m) => ({ default: m.CharacterShowroom })))
const ArenaScreen = lazy(() => import('./screens/ArenaScreen').then((m) => ({ default: m.ArenaScreen })))
const LiveScreen = lazy(() => import('./screens/LiveScreen').then((m) => ({ default: m.LiveScreen })))
// boss cards draw Bakugan portraits with three.js
const EventsScreen = lazy(() => import('./screens/EventsScreen').then((m) => ({ default: m.EventsScreen })))

/** Which song plays where: every page has its own, and the arena picks one of the battle songs. */
const TRACK_FOR: Partial<Record<Screen, Track>> = {
  menu: 'menu',
  wheel: 'menu',
  profileEdit: 'workshop',
  hub: 'home',
  viewer: 'home',
  compare: 'faceoff',
  arena: 'battle',
  live: 'battle',
  shop: 'shop',
  inventory: 'inventory',
  pass: 'pass',
  profile: 'anthem',
  rankings: 'rankings',
  clans: 'clans',
  friends: 'clans',
  encyclopedia: 'gallery',
  showroom: 'showroom',
  characters: 'characters',
  events: 'faceoff',
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
    // the main menu's lead first, while the title screen waits
    preloadActiveLead()
    const t = window.setTimeout(() => void import('./three/BakuganModels').then((m) => m.preloadAllModels()), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative h-full w-full">
      <PageBackdrop screen={screen} />
      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          {screen === 'intro' && <IntroScreen key="intro" />}
          {screen === 'menu' && <MainMenu key="menu" />}
          {screen === 'wheel' && <ElementWheel key="wheel" />}
          {screen === 'hub' && <ElementHub key="hub" />}
          {screen === 'viewer' && <Viewer key="viewer" />}
          {screen === 'compare' && <CompareScreen key="compare" />}
          {screen === 'arena' && <ArenaScreen key="arena" />}
          {screen === 'live' && <LiveScreen key="live" />}
          {screen === 'profile' && <ProfileScreen key="profile" />}
          {screen === 'profileEdit' && <ProfileEditor key="profileEdit" />}
          {screen === 'rankings' && <RankingsScreen key="rankings" />}
          {screen === 'clans' && <ClansScreen key="clans" />}
          {screen === 'friends' && <FriendsScreen key="friends" />}
          {screen === 'encyclopedia' && <EncyclopediaScreen key="encyclopedia" />}
          {screen === 'pass' && <SeasonPassScreen key="pass" />}
          {screen === 'shop' && <ShopScreen key="shop" />}
          {screen === 'inventory' && <InventoryScreen key="inventory" />}
          {screen === 'showroom' && <BakuganShowroom key="showroom" />}
          {screen === 'characters' && <CharacterShowroom key="characters" />}
          {screen === 'events' && <EventsScreen key="events" />}
        </AnimatePresence>
      </Suspense>
      <SeasonNotice />
      <EventToast />
      <InvitePopup />
      {/* the corner buttons share one row, so they line up whatever their widths */}
      {/* the main menu has the music and sound switches in its own layout */}
      {screen !== 'intro' && screen !== 'menu' && (
        <div className="fixed right-5 bottom-5 z-50 flex items-center gap-2">
          {/* the way back to the main menu where there is no PageNav or BACK to it (pages have ⌂ MENU) */}
          {(screen === 'hub' || screen === 'viewer' || screen === 'compare') && <ProfileButton />}
          <MuteButton />
        </div>
      )}
    </div>
  )
}

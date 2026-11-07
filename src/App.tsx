import { AnimatePresence, MotionConfig } from 'framer-motion'
import { Suspense, useEffect } from 'react'
import { playMusic, type Track } from './audio/music'
import { EventToast } from './components/EventToast'
import { InvitePopup } from './components/InvitePopup'
import { SettingsButton, SettingsPanel } from './components/SettingsPanel'
import { FpsMeter } from './components/FpsMeter'
import { SettingsNotice } from './components/SettingsNotice'
import { useSettings } from './store/useSettings'
import { ProfileButton } from './components/ProfileButton'
import { SeasonNotice } from './components/SeasonNotice'
import { CompareScreen } from './screens/CompareScreen'
import { ElementHub } from './screens/ElementHub'
import { ElementWheel } from './screens/ElementWheel'
import { IntroScreen } from './screens/IntroScreen'
import { MainMenu } from './screens/MainMenu'
import { preloadActiveLead } from './components/menuLead'
import { PageBackdrop } from './components/PageBackdrop'
import { PageErrorBoundary } from './components/PageErrorBoundary'
import { lazyPage } from './lazyPage'
import { ProfileEditor } from './screens/ProfileEditor'
import { ProfileScreen } from './screens/ProfileScreen'
import { ClansScreen } from './screens/ClansScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { RankingsScreen } from './screens/RankingsScreen'
import { EncyclopediaScreen } from './screens/EncyclopediaScreen'
import { ShopScreen } from './screens/ShopScreen'
import { InventoryScreen } from './screens/InventoryScreen'
import { SeasonPassScreen } from './screens/SeasonPassScreen'
import { useBackOf, useGame, type Screen } from './store/useGame'
import { GAME_SUBTITLE, GAME_TITLE } from './brand'
// pays out event matches whichever screen is open
import './events/progress'

// The 3D viewer pulls in three.js, so load it only when needed.
const Viewer = lazyPage(() => import('./screens/Viewer').then((m) => ({ default: m.Viewer })))
const BakuganShowroom = lazyPage(() => import('./screens/BakuganShowroom').then((m) => ({ default: m.BakuganShowroom })))
const CharacterShowroom = lazyPage(() => import('./screens/CharacterShowroom').then((m) => ({ default: m.CharacterShowroom })))
const ArenaScreen = lazyPage(() => import('./screens/ArenaScreen').then((m) => ({ default: m.ArenaScreen })))
const LiveScreen = lazyPage(() => import('./screens/LiveScreen').then((m) => ({ default: m.LiveScreen })))
// boss cards draw Bakugan portraits with three.js
const EventsScreen = lazyPage(() => import('./screens/EventsScreen').then((m) => ({ default: m.EventsScreen })))

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
  const reduceMotion = useSettings((s) => s.reduceMotion)
  const showFps = useSettings((s) => s.showFps)
  // the hub's, viewer's and face-off's own BACK: when it leads to the main menu, the corner's MENU is left out
  const back = useBackOf(screen)
  // the battle theme in the arena, the calm theme everywhere else (after the first click)
  useEffect(() => {
    if (screen !== 'intro') playMusic(TRACK_FOR[screen] ?? 'menu')
  }, [screen])

  // the browser tab carries the game's name (src/brand.ts)
  useEffect(() => void (document.title = `${GAME_TITLE} ${GAME_SUBTITLE}`), [])

  // the main menu's lead model first, while the title screen waits (the others load when they are shown: every model
  // held in memory at once came to about 600 MB, too much for many computers)
  useEffect(() => {
    preloadActiveLead()
  }, [])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
      <div className="relative h-full w-full">
        <PageBackdrop screen={screen} />
        {/* a page that crashes shows a way out instead of leaving the game blank (and one left behind by an update
          reloads the game) */}
        <PageErrorBoundary screen={screen} onMenu={() => useGame.setState({ screen: 'menu' })}>
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
        </PageErrorBoundary>
        <SeasonNotice />
        <EventToast />
        <InvitePopup />
        <SettingsPanel />
        <SettingsNotice />
        {/* the corner buttons share one row, so they line up whatever their widths */}
        {/* the main menu has the music and sound switches in its own layout */}
        {screen !== 'intro' && screen !== 'menu' && (
          <div className="fixed right-5 bottom-5 z-50 flex items-center gap-2">
            {/* the way back to the main menu where there is no PageNav or BACK to it (pages have ⌂ MENU) */}
            {(screen === 'hub' || screen === 'viewer' || screen === 'compare') && (
              <ProfileButton menu={screen !== 'hub' && back !== 'menu'} />
            )}
            <SettingsButton />
          </div>
        )}
        {showFps && <FpsMeter />}
      </div>
    </MotionConfig>
  )
}

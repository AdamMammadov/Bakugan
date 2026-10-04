import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { playMusic } from './audio/music'
import { MuteButton } from './components/MuteButton'
import { ProfileButton } from './components/ProfileButton'
import { CompareScreen } from './screens/CompareScreen'
import { ElementHub } from './screens/ElementHub'
import { ElementWheel } from './screens/ElementWheel'
import { IntroScreen } from './screens/IntroScreen'
import { ProfileEditor } from './screens/ProfileEditor'
import { ProfileScreen } from './screens/ProfileScreen'
import { ClansScreen } from './screens/ClansScreen'
import { RankingsScreen } from './screens/RankingsScreen'
import { EncyclopediaScreen } from './screens/EncyclopediaScreen'
import { AdminScreen } from './screens/AdminScreen'
import { useGame } from './store/useGame'

// The 3D viewer pulls in three.js, so load it only when needed.
const Viewer = lazy(() => import('./screens/Viewer').then((m) => ({ default: m.Viewer })))
const ArenaScreen = lazy(() => import('./screens/ArenaScreen').then((m) => ({ default: m.ArenaScreen })))

export default function App() {
  const screen = useGame((s) => s.screen)
  // the battle theme in the arena, the calm theme everywhere else (after the first click)
  useEffect(() => {
    if (screen !== 'intro') playMusic(screen === 'arena' ? 'battle' : 'menu')
  }, [screen])

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
          {screen === 'admin' && <AdminScreen key="admin" />}
        </AnimatePresence>
      </Suspense>
      {screen !== 'intro' && <MuteButton />}
      {screen !== 'intro' && !['arena', 'viewer', 'profile', 'profileEdit', 'rankings', 'clans', 'encyclopedia', 'admin'].includes(screen) && <ProfileButton />}
    </div>
  )
}

import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { MuteButton } from './components/MuteButton'
import { CompareScreen } from './screens/CompareScreen'
import { ElementHub } from './screens/ElementHub'
import { ElementWheel } from './screens/ElementWheel'
import { IntroScreen } from './screens/IntroScreen'
import { useGame } from './store/useGame'

// The 3D viewer pulls in three.js, so load it only when needed.
const Viewer = lazy(() => import('./screens/Viewer').then((m) => ({ default: m.Viewer })))

export default function App() {
  const screen = useGame((s) => s.screen)

  return (
    <div className="relative h-full w-full">
      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          {screen === 'intro' && <IntroScreen key="intro" />}
          {screen === 'wheel' && <ElementWheel key="wheel" />}
          {screen === 'hub' && <ElementHub key="hub" />}
          {screen === 'viewer' && <Viewer key="viewer" />}
          {screen === 'compare' && <CompareScreen key="compare" />}
        </AnimatePresence>
      </Suspense>
      {screen !== 'intro' && <MuteButton />}
    </div>
  )
}

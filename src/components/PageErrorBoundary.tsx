import { Component, type ReactNode } from 'react'
import { isStaleBuild, reloadForUpdate } from '../lazyPage'

type Props = {
  /** The screen showing: on another one the page is tried again. */
  screen: string
  /** Back to the main menu. */
  onMenu: () => void
  children: ReactNode
}
type State = { error: Error | null; screen: string }

/**
 * A page that crashes shows a way out (reload, or back to the main menu) instead of leaving the whole game blank. A
 * page whose code is gone after an update reloads the game into the new version.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, screen: this.props.screen }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  // another page opened: it is tried afresh
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> {
    return props.screen === state.screen ? {} : { error: null, screen: props.screen }
  }

  componentDidCatch(error: Error) {
    console.error('A page crashed:', error)
    if (isStaleBuild(error)) reloadForUpdate()
  }

  render() {
    if (!this.state.error) return this.props.children
    const button = 'font-display skew-x-[-12deg] border-2 px-8 py-3 text-sm font-black tracking-[0.3em] hover:bg-white/20'
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
        <div className="max-w-md border border-white/20 bg-[#0b1024]/95 p-8 text-center shadow-2xl">
          <h2 className="font-display text-2xl font-black tracking-wider">THIS PAGE DID NOT OPEN</h2>
          <p className="mt-3 text-sm text-white/70">
            Something went wrong while opening it. Reload the game, or go back to the main menu and try again.
          </p>
          <div className="mt-7 flex justify-center gap-4">
            <button onClick={() => location.reload()} className={`${button} border-white/70 bg-white/10`}>
              RELOAD
            </button>
            <button
              onClick={() => {
                this.setState({ error: null })
                this.props.onMenu()
              }}
              className={`${button} border-white/40 bg-black/30`}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    )
  }
}

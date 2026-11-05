import { lazy, type ComponentType } from 'react'

/**
 * Pages load their code when first opened. Every update of the game replaces those files with new ones, so a tab
 * still running the old version (left open, or its page kept in the browser's cache) finds its page's file gone and
 * the page crashes. Then the game reloads itself into the new version.
 */

const KEY = 'bakugan-reloaded-for-update'

/** Whether an error is a page's code file that is no longer there (the game was updated meanwhile). */
export const isStaleBuild = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    String((e as Error | undefined)?.message ?? e),
  )

/**
 * Reloads the game into its new version; at most once a minute, so a real outage does not reload it over and over.
 * Returns whether it is reloading.
 */
export function reloadForUpdate(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // no session storage (private mode): reload anyway
  }
  location.reload()
  return true
}

/** React.lazy for a page or a part of one: when its file is gone after an update, the game reloads instead. */
// (any, as React.lazy's own type has it: a page's props can be anything)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((e: unknown) => {
      // until the reload: nothing (the page's place stays empty a moment)
      if (isStaleBuild(e) && reloadForUpdate()) return new Promise<{ default: T }>(() => {})
      throw e
    }),
  )
}

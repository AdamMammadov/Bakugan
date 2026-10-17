/**
 * The game owner's own browser sees every Bakugan in the showroom and the encyclopedia, those not out yet
 * included. Opening the game once with ?dev=<code> switches it on in that browser, ?dev=off switches it off;
 * only the code's SHA-256 is kept here. (The game runs in the browser, so this keeps unreleased Bakugan off
 * players' screens, not out of the game's files.)
 */
const KEY = 'bakugan-dev'
const CODE_SHA256 = '3890dd8a911eb4fb8d5058fa40da5c129b20f3eeb8c5fa14f9d6552009e38324'

export function devView(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

async function sha256(text: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Reads ?dev= from the address: switches the view if asked, then reloads without it. False when there is none. */
export async function readDevSwitch(): Promise<boolean> {
  const url = new URL(location.href)
  const code = url.searchParams.get('dev')
  if (code === null) return false
  url.searchParams.delete('dev')
  try {
    if (code === 'off') localStorage.removeItem(KEY)
    else if ((await sha256(code)) === CODE_SHA256) localStorage.setItem(KEY, '1')
  } catch {
    // storage or hashing unavailable (private mode, plain http): the view stays as it was
  }
  location.replace(url.toString())
  return true
}

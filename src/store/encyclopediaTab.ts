/**
 * The tab the encyclopedia opens at next (set by a link elsewhere, e.g. the face-off's HOW TO BRAWL), taken once.
 * Kept apart from the encyclopedia itself so a link to it does not load the whole page early.
 */
let openTab: 'rules' | null = null

export const openEncyclopediaAt = (tab: 'rules') => {
  openTab = tab
}

export const takeEncyclopediaTab = () => {
  const t = openTab
  openTab = null
  return t
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { playSfx } from '../audio/sfx'
import { useGame, type Screen, type TeamMember } from '../store/useGame'
import { botCharacter, opponentCharacter } from './avatar'
import { botById, isBot } from './bots'
import { brawlerOf } from './brawlers'
import { isAvailable, presenceOf } from './presence'
import { botSays, owe, useFriendChat, type InviteNote } from './useFriendChat'
import { bakuganById, friendStatus, teamEntrants, tierOf, unlockedCards, useProfiles } from './useProfiles'

/**
 * Battle invites between the player and their CPU friends, like with players online: an invite waits for an
 * answer (the friend accepts, declines with a reason, or lets it run out), and online friends now and then
 * invite the player too. Do not disturb mutes their invites for a while. Every invite leaves a note in the
 * conversation with that friend.
 */

export type InviteKind = 'duel' | 'tag'

export interface Invite {
  /** The player (profile id). */
  me: string
  friend: string
  kind: InviteKind
  at: number
  /** When it runs out unanswered. */
  expires: number
}

export interface Outgoing extends Invite {
  state: 'waiting' | 'accepted' | 'declined' | 'expired'
  /** What the friend said when they declined. */
  reason?: string
}

/** How long an invite waits for an answer. */
export const INVITE_MS = 30_000
/** Do not disturb until the player turns it off (the latest date there is). */
export const FOREVER = 8.64e15
const MINUTE = 60_000

/** Do not disturb choices: [label, how long] (FOREVER: until the player turns it off). */
export const MUTE_OPTIONS: [string, number][] = [
  ['30 MIN', 30 * MINUTE],
  ['1 HOUR', 60 * MINUTE],
  ['UNTIL I TURN IT BACK ON', FOREVER],
]
export const muteUntil = (ms: number) => (ms === FOREVER ? FOREVER : Date.now() + ms)

/** How a CPU friend answers the player's invite: yes, no, no because they are mid-brawl, or not at all. */
type Plan = 'accept' | 'decline' | 'busy' | 'silent'

interface InviteState {
  /** The player's invite waiting for (or just given) an answer. */
  outgoing: Outgoing | null
  /** A friend's invite to the player, on screen. */
  incoming: Invite | null
  /** The tag battle face-off to open, with this friend as the player's partner. */
  tagWith: string | null
  /** Do not disturb per player: no invite popups until this time. */
  dnd: Record<string, number>
  /** The player invites a CPU friend who is online. */
  invite: (me: string, friend: string, kind: InviteKind) => void
  cancel: () => void
  /** Closes the panel of an answered (or expired) invite. */
  dismiss: () => void
  /** A CPU friend invites the player (a popup, or only a note while do not disturb is on). */
  receive: (me: string, friend: string, kind: InviteKind) => void
  accept: () => void
  /** Declines the friend's invite; with `muteUntil`, also turns do not disturb on. */
  decline: (muteUntil?: number) => void
  setDnd: (me: string, until: number) => void
  openTag: (friend: string | null) => void
}

const note = (n: InviteNote) => useFriendChat.getState().note(n)

/** The outgoing invite's timers, and the incoming one's. */
let outTimers: number[] = []
let inTimer = 0
const clearOut = () => {
  outTimers.forEach((t) => clearTimeout(t))
  outTimers = []
}
const later = (fn: () => void, ms: number) => outTimers.push(window.setTimeout(fn, ms))

/** Dev only: how the next friend answers the player's invite. */
let devPlan: Plan | null = null

/** Starts a friendly brawl (no rating at stake) against the friend's own team, as many Bakugan as the player brings. */
export function startFriendly(meId: string, friendId: string) {
  const { profiles } = useProfiles.getState()
  const me = profiles.find((p) => p.id === meId)
  const b = brawlerOf(friendId, profiles, Date.now())
  const mine = me ? teamEntrants(me) : []
  if (!me || !b || !mine.length) return
  const left: TeamMember[] = mine.map((e) => ({ id: e.bakugan.id, form: e.form, cards: e.cards, skin: e.skin }))
  const theirs = [...b.team, ...b.collection.filter((c) => !b.team.some((t) => t.id === c.id))].slice(0, left.length)
  const local = profiles.find((p) => p.id === b.id)
  // another player here brings their unlocked cards; a CPU brawler all of them
  const right: TeamMember[] = theirs.map((t) => {
    const owned = local?.collection.find((o) => o.id === t.id)
    return owned ? { id: t.id, form: t.form, cards: unlockedCards(owned).map((a) => a.id), skin: owned.skin } : t
  })
  const lead = bakuganById(theirs[0].id)
  let characterId = botById(b.id)?.characterId ?? (b.avatar.kind === 'preset' ? b.avatar.id : botCharacter(b.element).id)
  // nobody brawls against their own character
  if (me.avatar.kind === 'preset' && me.avatar.id === characterId) characterId = opponentCharacter(lead, characterId).id
  playSfx('brawl')
  // leaving the arena goes to the face-off page, with the player's lead
  useGame.setState({ bakuganId: left[0].id, compareForm: left[0].form })
  useGame.getState().enterArena({ left, right, ranked: false, bot: { characterId, tier: tierOf(b.score).index, name: b.name } })
}

/** Into the battle the invite was for. */
function begin(inv: Invite) {
  if (inv.kind === 'duel') startFriendly(inv.me, inv.friend)
  else useInvites.setState({ tagWith: inv.friend })
}

export const useInvites = create<InviteState>()(
  persist(
    (set, get) => ({
      outgoing: null,
      incoming: null,
      tagWith: null,
      dnd: {},
      invite: (me, friend, kind) => {
        if (get().outgoing?.state === 'waiting' || !isBot(friend)) return
        const now = Date.now()
        const p = presenceOf(friend, now)
        if (!p.online) return
        clearOut()
        const inv: Outgoing = { me, friend, kind, at: now, expires: now + INVITE_MS, state: 'waiting' }
        set({ outgoing: inv })
        note({ kind, by: me, to: friend, event: 'sent' })
        playSfx('select')
        // mostly yes; a friend in a brawl says "later" or answers after it
        const r = Math.random()
        const plan: Plan =
          devPlan ?? (p.inMatch ? (r < 0.6 ? 'busy' : 'silent') : r < 0.8 ? 'accept' : r < 0.95 ? 'decline' : 'silent')
        devPlan = null
        const delay = plan === 'busy' ? 3000 + Math.random() * 4000 : 3000 + Math.random() * 9000
        if (plan !== 'silent') later(() => answer(plan), delay)
        later(() => expire(plan === 'silent' && p.inMatch), INVITE_MS)
      },
      cancel: () => {
        const o = get().outgoing
        clearOut()
        if (o?.state === 'waiting') note({ kind: o.kind, by: o.me, to: o.friend, event: 'cancelled' })
        set({ outgoing: null })
      },
      dismiss: () => {
        if (get().outgoing?.state === 'waiting') return
        clearOut()
        set({ outgoing: null })
      },
      receive: (me, friend, kind) => {
        const s = get()
        if (s.incoming || s.outgoing) return
        const now = Date.now()
        if ((s.dnd[me] ?? 0) > now) {
          note({ kind, by: friend, to: me, event: 'missed', dnd: true })
          return
        }
        note({ kind, by: friend, to: me, event: 'sent' })
        set({ incoming: { me, friend, kind, at: now, expires: now + INVITE_MS } })
        playSfx('gPower')
        clearTimeout(inTimer)
        inTimer = window.setTimeout(() => {
          const i = get().incoming
          if (!i) return
          note({ kind: i.kind, by: i.friend, to: i.me, event: 'missed' })
          set({ incoming: null })
        }, INVITE_MS)
      },
      accept: () => {
        const i = get().incoming
        if (!i) return
        clearTimeout(inTimer)
        note({ kind: i.kind, by: i.friend, to: i.me, event: 'accepted' })
        useFriendChat.getState().markRead(i.me, i.friend)
        set({ incoming: null })
        begin(i)
      },
      decline: (muteUntil) => {
        const i = get().incoming
        if (!i) return
        clearTimeout(inTimer)
        note({ kind: i.kind, by: i.friend, to: i.me, event: 'declined' })
        useFriendChat.getState().markRead(i.me, i.friend)
        set((s) => ({ incoming: null, dnd: muteUntil ? { ...s.dnd, [i.me]: muteUntil } : s.dnd }))
        playSfx('tick')
        // the friend may answer "ok, next time"
        if (Math.random() < 0.6) botSays(i.me, i.friend, 'inviteOk', 2500 + Math.random() * 3000)
      },
      setDnd: (me, until) => set((s) => ({ dnd: { ...s.dnd, [me]: until } })),
      openTag: (tagWith) => set({ tagWith }),
    }),
    { name: 'bakugan-invites', version: 1, partialize: (s) => ({ dnd: s.dnd }) },
  ),
)

/** The friend answers the player's invite. */
function answer(plan: Plan) {
  const o = useInvites.getState().outgoing
  if (!o || o.state !== 'waiting') return
  clearOut()
  if (plan === 'accept') {
    note({ kind: o.kind, by: o.me, to: o.friend, event: 'accepted' })
    useInvites.setState({ outgoing: { ...o, state: 'accepted' } })
    playSfx('start')
    // "X accepted!" for a moment, then the battle
    later(() => {
      if (useInvites.getState().outgoing?.state !== 'accepted') return
      useInvites.setState({ outgoing: null })
      begin(o)
    }, 1800)
    return
  }
  note({ kind: o.kind, by: o.me, to: o.friend, event: 'declined' })
  const reason = botSays(o.me, o.friend, plan === 'busy' ? 'inviteBusy' : 'inviteNo', 0)
  useInvites.setState({ outgoing: { ...o, state: 'declined', reason } })
  later(() => useInvites.getState().dismiss(), 7000)
}

/** Nobody answered: a friend who was mid-brawl says sorry once they are out of it. */
function expire(afterBrawl: boolean) {
  const o = useInvites.getState().outgoing
  if (!o || o.state !== 'waiting') return
  clearOut()
  note({ kind: o.kind, by: o.me, to: o.friend, event: 'missed' })
  useInvites.setState({ outgoing: { ...o, state: 'expired' } })
  if (afterBrawl) owe(o.me, o.friend, true)
  later(() => useInvites.getState().dismiss(), 7000)
}

/** Is do not disturb on for the player (and until when). */
export const dndUntil = (dnd: Record<string, number>, me: string | undefined, now: number) => {
  const until = me ? (dnd[me] ?? 0) : 0
  return until > now ? until : 0
}

/** No invites here: the title and creation screens, the arena and live matches. */
const QUIET: Screen[] = ['intro', 'wheel', 'profileEdit', 'arena', 'live']
export const quietScreen = (screen: Screen) => QUIET.includes(screen)

/** Time between friends' invites: 8–15 minutes of play (counted from when the game opens). */
const gap = () => (8 + Math.random() * 7) * MINUTE
let nextAt = Date.now() + gap()

/**
 * Now and then one of the player's online CPU friends invites them to a friendly battle or a tag battle.
 * Called every half minute while the game is open.
 */
export function tickInvites(now = Date.now()) {
  const s = useInvites.getState()
  const { profiles, activeId } = useProfiles.getState()
  const me = profiles.find((p) => p.id === activeId)
  if (!me?.team.length || quietScreen(useGame.getState().screen) || s.outgoing || s.incoming || s.tagWith || document.hidden) {
    // not now, and not straight after either
    nextAt = Math.max(nextAt, now + MINUTE + Math.random() * MINUTE)
    return
  }
  if (now < nextAt) return
  nextAt = now + gap()
  const online = (me.friends ?? []).filter((f) => f.since <= now && isBot(f.id) && isAvailable(f.id, now))
  if (!online.length || Math.random() < 0.2) return
  const friend = online[Math.floor(Math.random() * online.length)].id
  s.receive(me.id, friend, Math.random() < 0.6 ? 'duel' : 'tag')
}

// dev only: window.__invite('duel' | 'tag', botId?) brings a friend's invite now;
// window.__inviteAnswer('accept' | 'decline' | 'busy' | 'silent') sets how the next friend answers the player's
if (import.meta.env.DEV)
  Object.assign(window, {
    __invite: (kind: InviteKind = 'duel', friend?: string) => {
      const { profiles, activeId } = useProfiles.getState()
      const me = profiles.find((p) => p.id === activeId)
      const ids = (me?.friends ?? []).map((f) => f.id).filter((id) => isBot(id) && friendStatus(me ?? null, id) === 'friend')
      const id = friend ?? ids.find((f) => isAvailable(f, Date.now())) ?? ids[0]
      if (me && id) useInvites.getState().receive(me.id, id, kind)
    },
    __inviteAnswer: (plan: Plan) => {
      devPlan = plan
    },
  })

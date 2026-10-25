import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ELEMENT_BY_ID } from '../data/elements'
import { useMinute } from '../profile/botProgress'
import { brawlerOf, rankColor } from '../profile/brawlers'
import {
  INVITE_MS,
  MUTE_OPTIONS,
  muteUntil,
  quietScreen,
  tickInvites,
  useInvites,
  type Invite,
  type Outgoing,
} from '../profile/invites'
import { clanOf, useClans } from '../profile/useClans'
import { checkPending } from '../profile/useFriendChat'
import { rankScore, teamEntrants, tierOf, useActiveProfile, useProfiles } from '../profile/useProfiles'
import { TagFaceOff } from '../screens/TagFaceOff'
import { tagMember } from '../screens/tagSetup'
import { useGame } from '../store/useGame'
import { Avatar } from './Avatar'
import { PresenceDot } from './PresenceBadge'

/** Whole seconds left until `at`, ticking. */
function useSecondsLeft(at: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/**
 * Battle invites on any screen: a friend's invite (accept, decline or mute), the player's own invite waiting for
 * an answer, and the tag battle face-off once a tag invite is accepted. Also keeps friends' lives going while the
 * game is open: they read waiting messages when they come online, and now and then invite the player.
 */
export function InvitePopup() {
  const screen = useGame((s) => s.screen)
  const incoming = useInvites((s) => s.incoming)
  const outgoing = useInvites((s) => s.outgoing)
  const tagWith = useInvites((s) => s.tagWith)
  const openTag = useInvites((s) => s.openTag)
  const me = useActiveProfile()
  const profiles = useProfiles((s) => s.profiles)
  const now = useMinute()

  useEffect(() => {
    const run = () => {
      checkPending()
      tickInvites()
    }
    const first = window.setTimeout(run, 3000)
    const t = window.setInterval(run, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [])

  // the face-off is done once the arena opens
  useEffect(() => {
    if (screen === 'arena') useInvites.setState({ tagWith: null })
  }, [screen])

  const partner = tagWith && me ? tagMember(tagWith, profiles, now) : null
  return (
    <>
      <div className="pointer-events-none fixed top-24 right-6 z-[70] flex flex-col items-end">
        <AnimatePresence>
          {incoming && incoming.me === me?.id && !quietScreen(screen) && (
            <IncomingCard key={`${incoming.friend}${incoming.at}`} inv={incoming} />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {outgoing && outgoing.me === me?.id && <WaitingPanel key={`${outgoing.friend}${outgoing.at}`} o={outgoing} />}
      </AnimatePresence>
      {me && partner && screen !== 'arena' && (
        <TagFaceOff
          key={tagWith}
          me={{ name: `${me.firstName} ${me.lastName}`, avatar: me.avatar, color: ELEMENT_BY_ID[me.element].color }}
          team={teamEntrants(me).map((e) => ({ id: e.bakugan.id, form: e.form, cards: e.cards, skin: e.skin }))}
          partner={partner}
          score={rankScore(me)}
          onClose={() => openTag(null)}
        />
      )}
    </>
  )
}

/** A friend's invite to the player, with a 30 s countdown. */
function IncomingCard({ inv }: { inv: Invite }) {
  const accept = useInvites((s) => s.accept)
  const decline = useInvites((s) => s.decline)
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const left = useSecondsLeft(inv.expires)
  const [muting, setMuting] = useState(false)
  const [bar] = useState(() => Math.max(0, inv.expires - Date.now()))
  const b = brawlerOf(inv.friend, profiles, inv.at)
  if (!b) return null
  const el = ELEMENT_BY_ID[b.element]
  const tier = tierOf(b.score)
  const clan = clanOf(clans, inv.friend)
  return (
    <motion.div
      role="dialog"
      aria-label="Battle invite"
      data-testid="invite-popup"
      className="pointer-events-auto w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-2 bg-[#0b0c12]/95 backdrop-blur"
      style={{ borderColor: el.color, boxShadow: `0 0 40px ${el.color}55` }}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-[10px] tracking-[0.4em]" style={{ color: el.color }}>
            {inv.kind === 'duel' ? '⚔ BATTLE INVITE' : '⚔⚔ TAG BATTLE INVITE'}
          </p>
          <p className="font-display text-xs text-white/60 tabular-nums">{left} s</p>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className="relative shrink-0">
            <Avatar avatar={b.avatar} color={el.color} size={64} frame={b.frame} />
            <PresenceDot state="online" size={14} />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-xl leading-tight font-black">
              {clan && <span className="mr-1.5 text-sm text-white/45">[{clan.tag}]</span>}
              {b.name}
            </p>
            <p className="font-display mt-0.5 text-[10px] tracking-[0.3em]" style={{ color: rankColor(tier) }}>
              {tier.rank.toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {inv.kind === 'duel' ? 'invites you to a friendly battle' : 'invites you to a tag battle as their partner'}
            </p>
          </div>
        </div>
        {muting ? (
          <div className="mt-4">
            <p className="text-xs text-white/60">🔕 Do not disturb: no battle invites for…</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUTE_OPTIONS.map(([label, ms]) => (
                <button
                  key={label}
                  onClick={() => decline(muteUntil(ms))}
                  className="font-display rounded-md border border-white/25 px-3 py-2 text-[11px] tracking-[0.2em] transition hover:border-white/70 hover:bg-white/10"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setMuting(false)}
                className="px-2 text-[11px] tracking-[0.2em] text-white/45 transition hover:text-white"
              >
                ← BACK
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              onClick={accept}
              className="font-display flex-1 rounded-md bg-emerald-500 py-2.5 text-sm font-black tracking-[0.25em] text-black transition hover:bg-emerald-300"
            >
              ACCEPT
            </button>
            <button
              onClick={() => decline()}
              className="font-display flex-1 rounded-md border border-white/30 py-2.5 text-sm tracking-[0.25em] transition hover:border-white/70 hover:bg-white/10"
            >
              DECLINE
            </button>
            <button
              onClick={() => setMuting(true)}
              title="Do not disturb: mute battle invites for a while"
              className="font-display rounded-md border border-white/20 px-3 text-xs tracking-[0.2em] text-white/70 transition hover:border-white/60 hover:bg-white/10 hover:text-white"
            >
              🔕 MUTE
            </button>
          </div>
        )}
      </div>
      <div className="h-1 bg-white/10">
        <motion.div
          className="h-full"
          style={{ background: el.color }}
          initial={{ width: `${(bar / INVITE_MS) * 100}%` }}
          animate={{ width: '0%' }}
          transition={{ duration: bar / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  )
}

/** The player's invite: waiting (with CANCEL), then accepted, declined or unanswered. */
function WaitingPanel({ o }: { o: Outgoing }) {
  const cancel = useInvites((s) => s.cancel)
  const dismiss = useInvites((s) => s.dismiss)
  const profiles = useProfiles((s) => s.profiles)
  const left = useSecondsLeft(o.expires)
  const b = brawlerOf(o.friend, profiles, o.at)
  if (!b) return null
  const el = ELEMENT_BY_ID[b.element]
  const name = b.firstName.toUpperCase()
  const tone =
    o.state === 'accepted' ? '#3ee07a' : o.state === 'declined' ? '#ff6b6b' : o.state === 'expired' ? '#9aa3b5' : el.color
  const button =
    'font-display mt-6 rounded border-2 border-white/40 px-8 py-2 text-xs tracking-[0.3em] transition hover:border-white/80 hover:bg-white/10'
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => o.state !== 'waiting' && dismiss()}
    >
      <motion.div
        role="dialog"
        aria-label="Battle invite sent"
        data-testid="invite-waiting"
        className="w-[460px] max-w-full rounded-2xl border-2 bg-[#0b0c12] p-8 text-center"
        style={{ borderColor: tone, boxShadow: `0 0 50px ${tone}44` }}
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-[10px] tracking-[0.4em] text-white/45">
          {o.kind === 'duel' ? '⚔ FRIENDLY BATTLE INVITE' : '⚔⚔ TAG BATTLE INVITE'}
        </p>
        <div className="relative mx-auto mt-5 w-fit">
          {o.state === 'waiting' && (
            <span className="absolute inset-0 animate-ping rounded-full" style={{ background: `${el.color}40` }} />
          )}
          <Avatar avatar={b.avatar} color={el.color} size={104} frame={b.frame} />
        </div>
        {o.state === 'waiting' && (
          <>
            <p className="font-display mt-6 text-2xl font-black tracking-wider">WAITING FOR {name}…</p>
            <p className="mt-2 text-sm text-white/60">
              {o.kind === 'duel'
                ? 'Friendly battle: no rating at stake.'
                : `Tag battle: you and ${b.firstName} against two CPU brawlers of your level.`}
            </p>
            <p className="mt-1 text-xs text-white/40 tabular-nums">The invite expires in {left} s</p>
            <button onClick={cancel} className={button}>
              CANCEL
            </button>
          </>
        )}
        {o.state === 'accepted' && (
          <>
            <p className="font-display mt-6 text-3xl font-black tracking-wider text-emerald-300">{name} ACCEPTED!</p>
            <p className="mt-2 animate-pulse text-sm text-white/60">
              {o.kind === 'duel' ? 'Entering the arena…' : 'Opening the tag battle…'}
            </p>
          </>
        )}
        {o.state === 'declined' && (
          <>
            <p className="font-display mt-6 text-2xl font-black tracking-wider text-red-300">{name} DECLINED</p>
            {o.reason && (
              <p className="mx-auto mt-3 max-w-xs rounded-xl bg-white/5 px-4 py-2 text-sm text-white/80 italic">“{o.reason}”</p>
            )}
            <button onClick={dismiss} className={button}>
              CLOSE
            </button>
          </>
        )}
        {o.state === 'expired' && (
          <>
            <p className="font-display mt-6 text-2xl font-black tracking-wider text-white/75">NO ANSWER</p>
            <p className="mt-2 text-sm text-white/55">{b.firstName} didn’t answer in time. Try again later.</p>
            <button onClick={dismiss} className={button}>
              CLOSE
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

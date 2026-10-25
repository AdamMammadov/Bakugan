import { PRESENCE_COLOR, type PresenceState, type Status } from '../profile/presence'

/** The status dot on a friend's avatar: green online, amber in a match, grey offline. */
export function PresenceDot({ state, size = 12 }: { state: PresenceState; size?: number }) {
  if (state === 'local') return null
  return (
    <span
      className={`absolute right-0 bottom-0 rounded-full border-2 border-[#0b0c12] ${state === 'online' ? 'shadow-[0_0_8px_#3ee07a]' : ''}`}
      style={{ width: size, height: size, background: PRESENCE_COLOR[state] }}
      title={state === 'online' ? 'Online' : state === 'match' ? 'In a match' : 'Offline'}
    />
  )
}

const TEXT: Record<PresenceState, string> = {
  online: 'text-emerald-300',
  match: 'text-amber-300',
  offline: 'text-white/50',
  local: 'text-sky-300/80',
}

/** "● Online", "⚔ In a match", "● Last seen 2 h ago" in the status colour. */
export function PresenceLabel({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${TEXT[status.state]} ${className}`}>
      {status.state === 'match' ? (
        <span className="shrink-0 text-[0.9em]">⚔</span>
      ) : (
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${status.state === 'online' ? 'animate-pulse' : ''}`}
          style={{ background: PRESENCE_COLOR[status.state] }}
        />
      )}
      <span className="truncate">{status.text}</span>
    </span>
  )
}

/** The status as a pill (profile headers). */
export function PresencePill({ status }: { status: Status }) {
  return (
    <span
      className="inline-flex items-center rounded-full border bg-black/40 px-3 py-1 text-sm"
      style={{ borderColor: `${PRESENCE_COLOR[status.state]}88` }}
    >
      <PresenceLabel status={status} />
    </span>
  )
}

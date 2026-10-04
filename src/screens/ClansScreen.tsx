import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { clanOf, useClans, type Clan } from '../profile/useClans'
import { rankOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'

export function ClansScreen() {
  const profile = useActiveProfile()
  const clans = useClans((s) => s.clans)
  const mine = clanOf(clans, profile?.id)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="clans" />
      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">CLANS</h1>
      <p className="mt-1 max-w-3xl text-sm text-white/45">
        Found a clan, gather brawlers and talk in the clan chat. For now clans live on this device: every player profile
        here can join them. Online clans with players everywhere arrive with the online PvP update.
      </p>

      {!profile ? (
        <p className="mt-10 text-white/60">Create a player profile first.</p>
      ) : mine ? (
        <ClanPage clan={mine} me={profile} />
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)_420px] gap-8">
          <ClanList clans={clans} me={profile} />
          <CreateClan me={profile} />
        </div>
      )}
    </motion.div>
  )
}

function Emblem({ clan, size = 56 }: { clan: Pick<Clan, 'element' | 'tag'>; size?: number }) {
  const el = ELEMENT_BY_ID[clan.element]
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
        background: `linear-gradient(160deg, ${el.color}, #07080d)`,
      }}
    >
      <img src={el.icon} alt="" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  )
}

function ClanList({ clans, me }: { clans: Clan[]; me: Profile }) {
  const join = useClans((s) => s.join)
  return (
    <section>
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">CLANS ON THIS DEVICE</h2>
      {clans.length === 0 && <p className="mt-4 text-white/50">No clans yet — be the first to found one.</p>}
      <div className="mt-3 space-y-3">
        {clans.map((c) => (
          <div key={c.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4">
            <Emblem clan={c} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold">
                <span style={{ color: ELEMENT_BY_ID[c.element].color }}>[{c.tag}]</span> {c.name}
              </p>
              <p className="truncate text-sm text-white/50">
                {c.members.length} members · “{c.motto || 'No motto'}”
              </p>
            </div>
            <button
              onClick={() => {
                playSfx('select')
                join(c.id, me.id)
              }}
              className="font-display border-2 border-white/40 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/10"
            >
              JOIN
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function CreateClan({ me }: { me: Profile }) {
  const create = useClans((s) => s.create)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [motto, setMotto] = useState('')
  const [element, setElement] = useState<ElementId>(me.element)
  const valid = name.trim().length >= 3 && tag.trim().length >= 2
  return (
    <section className="rounded-xl border border-white/10 bg-black/40 p-6">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">FOUND A CLAN</h2>
      <div className="mt-4 flex items-center gap-4">
        <Emblem clan={{ element, tag }} size={64} />
        <p className="font-display text-xl font-bold">
          <span style={{ color: ELEMENT_BY_ID[element].color }}>[{tag.toUpperCase() || 'TAG'}]</span> {name || 'Clan name'}
        </p>
      </div>
      <input
        value={name}
        maxLength={28}
        onChange={(e) => setName(e.target.value)}
        placeholder="Clan name"
        className="mt-4 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <input
        value={tag}
        maxLength={5}
        onChange={(e) => setTag(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
        placeholder="Tag (2–5 letters)"
        className="mt-3 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <input
        value={motto}
        maxLength={80}
        onChange={(e) => setMotto(e.target.value)}
        placeholder="Motto"
        className="mt-3 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <div className="mt-3 flex gap-2">
        {ELEMENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setElement(e.id)}
            className="rounded-md border-2 p-1"
            style={{ borderColor: element === e.id ? e.color : 'transparent' }}
            title={e.name}
          >
            <img src={e.icon} alt={e.name} className="h-8 w-8" />
          </button>
        ))}
      </div>
      <button
        disabled={!valid}
        onClick={() => {
          playSfx('victory')
          create(me.id, { name: name.trim(), tag: tag.trim(), motto: motto.trim(), element })
        }}
        className="font-display mt-5 w-full border-2 border-white/60 py-3 tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
      >
        FOUND CLAN
      </button>
    </section>
  )
}

function ClanPage({ clan, me }: { clan: Clan; me: Profile }) {
  const profiles = useProfiles((s) => s.profiles)
  const leave = useClans((s) => s.leave)
  const kick = useClans((s) => s.kick)
  const send = useClans((s) => s.send)
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const el = ELEMENT_BY_ID[clan.element]
  const members = clan.members.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p)
  const leader = clan.leaderId === me.id

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [clan.messages.length])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    send(clan.id, me.id, text.trim())
    setText('')
  }

  return (
    <div className="mt-8">
      <header className="flex items-center gap-6">
        <Emblem clan={clan} size={96} />
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.5em]" style={{ color: el.color }}>
            {el.name.toUpperCase()} CLAN · FOUNDED {new Date(clan.createdAt).toLocaleDateString('en-GB')}
          </p>
          <h2 className="font-display text-4xl font-black">
            [{clan.tag}] {clan.name}
          </h2>
          <p className="mt-1 text-white/60 italic">“{clan.motto || 'No motto yet'}”</p>
        </div>
        <button
          onClick={() => leave(me.id)}
          className="font-display border-2 border-white/25 px-5 py-2 text-xs tracking-[0.3em] text-white/70 hover:border-red-400 hover:text-red-300"
        >
          {leader && members.length === 1 ? 'DISBAND' : 'LEAVE CLAN'}
        </button>
      </header>

      <div className="mt-8 grid grid-cols-[360px_minmax(0,1fr)] gap-8">
        <section>
          <h3 className="font-display text-xs tracking-[0.5em] text-white/40">MEMBERS · {members.length}</h3>
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2">
                <Avatar avatar={m.avatar} color={ELEMENT_BY_ID[m.element].color} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-xs text-white/50">
                    {clan.leaderId === m.id ? '★ Leader · ' : ''}
                    {rankOf(m)} · {m.stats.wins} wins
                  </p>
                </div>
                {leader && m.id !== me.id && (
                  <button onClick={() => kick(clan.id, m.id)} className="text-xs text-white/35 hover:text-red-300">
                    KICK
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex h-[28rem] flex-col rounded-xl border border-white/10 bg-black/40">
          <h3 className="font-display border-b border-white/10 px-4 py-3 text-xs tracking-[0.5em] text-white/40">CLAN CHAT</h3>
          <div ref={log} className="flex-1 space-y-3 overflow-y-auto p-4">
            {clan.messages.length === 0 && <p className="text-sm text-white/40">No messages yet. Say hi to your clan!</p>}
            {clan.messages.map((msg) => {
              const author = profiles.find((p) => p.id === msg.author)
              const own = msg.author === me.id
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                  {author && <Avatar avatar={author.avatar} color={ELEMENT_BY_ID[author.element].color} size={28} />}
                  <div className={`max-w-[70%] rounded-xl px-3 py-2 ${own ? 'bg-white/15' : 'bg-white/5'}`}>
                    <p className="text-[10px] text-white/45">
                      {author ? author.firstName : 'Former member'} ·{' '}
                      {new Date(msg.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={text}
              maxLength={400}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message as ${me.firstName}…`}
              className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
            />
            <button className="font-display rounded-md border border-white/40 px-4 text-xs tracking-[0.3em] hover:bg-white/10">SEND</button>
          </form>
        </section>
      </div>
    </div>
  )
}

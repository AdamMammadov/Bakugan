import { ELEMENTS, type ElementInfo } from '../data/elements'
import { Trophy } from './EventArt'
import { BpIcon, RewardIcon } from './RewardIcon'

/**
 * The large, faint pieces of art each page's backdrop (PageBackdrop) stands behind its content: trophies and
 * confetti for the events, a fan of cards for the encyclopedia, a lit podium for the rankings… Plain HTML and
 * SVG with CSS animation (index.css, bd-*), sized to the window.
 */

/** Gold light raining down: confetti for the events. */
export function Confetti({ colors }: { colors: string[] }) {
  return (
    <>
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className="bd-fall absolute top-[-6vh] rounded-[2px]"
          style={{
            left: `${(i * 23 + 5) % 100}%`,
            width: 6 + (i % 3) * 3,
            height: 10 + (i % 4) * 3,
            background: colors[i % colors.length],
            boxShadow: `0 0 8px ${colors[i % colors.length]}`,
            opacity: 0.35,
            animationDuration: `${7 + (i % 5) * 1.6}s`,
            animationDelay: `${-((i * 11) % 13)}s`,
          }}
        />
      ))}
    </>
  )
}

/** Two huge trophies glowing at the sides. */
export function Trophies() {
  return (
    <>
      <div
        className="bd-bob absolute right-[3vw] bottom-[6vh] opacity-[0.16]"
        style={{ filter: 'drop-shadow(0 0 40px #fcd34d)' }}
      >
        <Trophy size={460} />
      </div>
      <div
        className="bd-bob absolute bottom-[2vh] left-[-4vw] rotate-[-12deg] opacity-[0.08]"
        style={{ animationDelay: '-3s', filter: 'drop-shadow(0 0 30px #a78bfa)' }}
      >
        <Trophy size={320} metal="silver" />
      </div>
    </>
  )
}

/** A fan of ability cards, each with an attribute emblem, slowly breathing open and shut. */
export function CardFan({ accent }: { accent: string }) {
  return (
    <div className="absolute right-[4vw] bottom-[-14vh] h-[70vh] w-[50vh] opacity-[0.22]">
      {ELEMENTS.map((e, i) => {
        const angle = (i - 2.5) * 11
        return (
          <div
            key={e.id}
            className="bd-fan absolute bottom-0 left-1/2 h-[46vh] w-[30vh] origin-bottom rounded-[2.2vh] border-2 p-[1.4vh]"
            style={
              {
                '--fan': `${angle}deg`,
                transform: `translateX(-50%) rotate(${angle}deg)`,
                borderColor: e.color,
                background: `linear-gradient(160deg, ${e.color}55, #0b0c12 60%)`,
                boxShadow: `0 0 30px ${e.color}55`,
              } as React.CSSProperties
            }
          >
            <div className="h-full w-full rounded-[1.4vh] border" style={{ borderColor: `${accent}55` }}>
              <img src={e.icon} alt="" className="mx-auto mt-[6vh] h-[14vh] w-[14vh]" />
              <div className="mx-[2vh] mt-[5vh] space-y-[1.2vh]">
                <div className="h-[1vh] rounded-full bg-white/40" />
                <div className="h-[1vh] w-3/4 rounded-full bg-white/25" />
                <div className="h-[1vh] w-1/2 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A winners' podium (2-1-3) under sweeping spotlights. */
export function Podium({ gold }: { gold: string }) {
  const steps: [string, number, string][] = [
    ['2', 0.62, '#cbd5e1'],
    ['1', 0.85, gold],
    ['3', 0.48, '#d97706'],
  ]
  return (
    <>
      {[30, 50, 70].map((left, i) => (
        <div
          key={left}
          className="bd-spot absolute top-[-8vh] h-[110vh] w-[30vh] origin-top opacity-[0.12]"
          style={{
            left: `${left}%`,
            background: `linear-gradient(to bottom, ${steps[i][2]}, transparent 85%)`,
            clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
            animationDelay: `${-i * 2.4}s`,
          }}
        />
      ))}
      <div className="absolute bottom-0 left-1/2 flex h-[34vh] -translate-x-1/2 items-end gap-[1.2vh] opacity-[0.2]">
        {steps.map(([n, h, c]) => (
          <div
            key={n}
            className="font-display flex w-[20vh] justify-center rounded-t-[1.5vh] border-x-2 border-t-2 pt-[2vh] text-[9vh] font-black"
            style={{
              height: `${h * 100}%`,
              borderColor: c,
              color: c,
              background: `linear-gradient(to bottom, ${c}55, transparent)`,
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </>
  )
}

/** The shop's counter: a glowing shelf with gems and coins floating over it. */
export function ShopCounter({ a, b }: { a: string; b: string }) {
  return (
    <>
      <div
        className="absolute inset-x-[-5vw] bottom-[16vh] h-[2px] opacity-60"
        style={{ background: a, boxShadow: `0 0 40px 10px ${a}66` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[16vh] opacity-40"
        style={{
          background: `linear-gradient(to bottom, ${a}30, transparent), repeating-linear-gradient(90deg, #ffffff08 0 1px, transparent 1px 12vh)`,
        }}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className="bd-bob absolute opacity-[0.3]"
          style={{ left: `${8 + i * 10.5}%`, bottom: `${19 + ((i * 7) % 4) * 3}vh`, animationDelay: `${-i * 0.7}s` }}
        >
          {i % 3 === 1 ? (
            <BpIcon size={46} />
          ) : (
            <div
              className="h-[5vh] w-[5vh] rotate-45 rounded-[0.6vh]"
              style={{
                background: `linear-gradient(135deg, #fff, ${i % 2 ? a : b})`,
                boxShadow: `0 0 24px ${i % 2 ? a : b}`,
              }}
            />
          )}
        </div>
      ))}
    </>
  )
}

/** Clan banners hanging from the top, swaying, each with an attribute emblem. */
export function Banners({ first }: { first: ElementInfo }) {
  const list = [first, ...ELEMENTS.filter((e) => e.id !== first.id)].slice(0, 5)
  return (
    <div className="absolute inset-x-0 top-0 flex justify-around px-[4vw] opacity-[0.18]">
      {list.map((e, i) => (
        <div
          key={e.id}
          className="bd-sway flex h-[48vh] w-[13vh] origin-top flex-col items-center pt-[8vh]"
          style={{
            background: `linear-gradient(to bottom, ${e.color}, ${e.color}88)`,
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)',
            animationDelay: `${-i * 1.3}s`,
            marginTop: i % 2 ? '-6vh' : 0,
          }}
        >
          <img src={e.icon} alt="" className="h-[9vh] w-[9vh]" />
          <div className="mt-[3vh] h-[0.6vh] w-[7vh] bg-black/40" />
          <div className="mt-[1vh] h-[0.6vh] w-[5vh] bg-black/30" />
        </div>
      ))}
    </div>
  )
}

/** Friends: brawlers linked to each other, lights running along the links. */
export function Network({ a, b }: { a: string; b: string }) {
  const nodes: [number, number][] = [
    [62, 22],
    [78, 14],
    [90, 34],
    [72, 46],
    [86, 62],
    [64, 72],
    [94, 84],
    [52, 52],
  ]
  const links = [
    [0, 1],
    [1, 2],
    [0, 3],
    [2, 3],
    [3, 4],
    [4, 5],
    [4, 6],
    [3, 7],
    [5, 7],
  ]
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.3]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {links.map(([i, j], k) => (
        <line
          key={k}
          className="bd-dash"
          x1={nodes[i][0]}
          y1={nodes[i][1]}
          x2={nodes[j][0]}
          y2={nodes[j][1]}
          stroke={k % 2 ? a : b}
          strokeWidth="0.25"
          strokeDasharray="1.2 1.6"
          vectorEffect="non-scaling-stroke"
          style={{ animationDelay: `${-k * 0.6}s` }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          className="bd-twinkle"
          cx={x}
          cy={y}
          r="0.9"
          fill={i % 2 ? a : b}
          style={{ animationDelay: `${-i * 0.7}s` }}
        />
      ))}
    </svg>
  )
}

/** A targeting reticle of turning rings: the player's card. */
export function Reticle({ a }: { a: string }) {
  return (
    <div className="absolute top-1/2 right-[-14vh] h-[96vh] w-[96vh] -translate-y-1/2 opacity-[0.22]">
      <div className="menu-spin absolute inset-0 rounded-full border-2 border-dashed" style={{ borderColor: a }} />
      <div
        className="menu-spin-rev absolute inset-[10%] rounded-full border"
        style={{ borderColor: `${a}aa`, borderTopColor: 'transparent' }}
      />
      <div
        className="menu-spin absolute inset-[22%] rounded-full border-4"
        style={{ borderColor: `${a}55`, borderLeftColor: 'transparent', borderRightColor: 'transparent' }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: `${a}55` }} />
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: `${a}55` }} />
    </div>
  )
}

/** Inventory: item slots drifting, each holding something. */
export function Crates({ a }: { a: string }) {
  const kinds = ['skin', 'boost', 'cardKey', 'frame', 'outfit', 'title'] as const
  return (
    <>
      {kinds.map((k, i) => (
        <div
          key={k}
          className="bd-bob absolute flex h-[13vh] w-[13vh] items-center justify-center rounded-[2vh] border-2 opacity-[0.22]"
          style={{
            right: `${4 + (i % 3) * 12}vw`,
            top: `${18 + Math.floor(i / 3) * 34 + (i % 2) * 8}vh`,
            borderColor: `${a}aa`,
            background: `linear-gradient(145deg, ${a}33, #0b0c1200)`,
            animationDelay: `${-i * 0.9}s`,
            animationDuration: `${5 + (i % 3)}s`,
          }}
        >
          <RewardIcon kind={k} size={64} accent={a} />
        </div>
      ))}
    </>
  )
}

/** The Season Pass: a broad ribbon of chevrons running across, and stars twinkling. */
export function PassRibbon({ a }: { a: string }) {
  return (
    <>
      <div
        className="bd-chevrons absolute top-[58%] left-[-20vw] h-[16vh] w-[140vw] -rotate-[8deg] opacity-[0.16]"
        style={{
          background: `repeating-linear-gradient(90deg, ${a} 0 2vh, transparent 2vh 6vh)`,
          maskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent)',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="bd-twinkle absolute text-[3vh] leading-none"
          style={{
            left: `${(i * 31 + 9) % 100}%`,
            top: `${(i * 47 + 17) % 90}%`,
            color: a,
            textShadow: `0 0 12px ${a}`,
            opacity: 0.5,
            animationDelay: `${-i * 0.45}s`,
          }}
        >
          ✦
        </span>
      ))}
    </>
  )
}

/** The face-off: two bolts of lightning flickering at the seam. */
export function Lightning({ a, b }: { a: string; b: string }) {
  return (
    <svg
      className="absolute top-[30%] left-1/2 h-[70%] w-[30vh] -translate-x-1/2 opacity-40"
      viewBox="0 0 30 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        className="bd-flicker"
        d="M18 0 12 22 19 30 9 55 16 62 8 100"
        fill="none"
        stroke={a}
        strokeWidth="0.6"
        style={{ filter: `drop-shadow(0 0 2px ${a})` }}
      />
      <path
        className="bd-flicker"
        d="M12 0 18 18 11 34 21 50 13 70 20 100"
        fill="none"
        stroke={b}
        strokeWidth="0.5"
        style={{ animationDelay: '-0.9s', filter: `drop-shadow(0 0 2px ${b})` }}
      />
    </svg>
  )
}

/** The profile editor: blueprint lines and a turning measuring ring. */
export function Blueprint({ a }: { a: string }) {
  return (
    <>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(${a} 1px, transparent 1px), linear-gradient(90deg, ${a} 1px, transparent 1px)`,
          backgroundSize: '12vh 12vh',
          maskImage: 'radial-gradient(ellipse at 70% 50%, #000 0%, transparent 70%)',
        }}
      />
      <div
        className="menu-spin absolute top-[12vh] right-[6vw] h-[60vh] w-[60vh] rounded-full border border-dashed opacity-25"
        style={{ borderColor: a }}
      />
    </>
  )
}

/** The hub's floor: a lit grid rolling towards the player. */
export function Floor() {
  return <div className="menu-floor absolute inset-x-[-50%] bottom-0 h-[50%] opacity-70" />
}

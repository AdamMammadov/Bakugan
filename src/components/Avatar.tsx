import { useId } from 'react'
import { asset } from '../asset'
import { CHARACTER_BY_ID, DEFAULT_PARTS, type Avatar as AvatarValue, type AvatarParts } from '../profile/avatar'
import { FRAMES } from '../season/season'

/** A player's picture: an uploaded photo or a drawn character, optionally inside an earned frame. */
export function Avatar({
  avatar,
  color = '#9aa3b5',
  size = 96,
  frame,
}: {
  avatar: AvatarValue
  color?: string
  size?: number
  /** Frame id from the Season Pass (see FRAMES). */
  frame?: string
}) {
  const ring = frame ? FRAMES[frame] : undefined
  if (ring) {
    const pad = Math.max(3, Math.round(size / 18))
    return (
      <div className="relative shrink-0 rounded-full" style={{ padding: pad, boxShadow: `0 0 ${size / 4}px ${color}88` }}>
        {/* Legendary frames turn slowly */}
        <div
          className={`absolute inset-0 rounded-full ${ring.rarity === 'legendary' ? 'frame-spin' : ''}`}
          style={{ background: ring.ring }}
        />
        <div className="relative">
          <Avatar avatar={avatar} color={color} size={size - pad * 2} />
        </div>
      </div>
    )
  }
  const style = { width: size, height: size, boxShadow: `0 0 ${size / 5}px ${color}66`, borderColor: color }
  if (avatar.kind === 'photo') {
    return <img src={avatar.dataUrl} alt="" className="shrink-0 rounded-full border-2 object-cover" style={style} />
  }
  const character = avatar.kind === 'preset' ? CHARACTER_BY_ID[avatar.id] : undefined
  const parts = avatar.kind === 'custom' ? avatar.parts : (character?.parts ?? DEFAULT_PARTS)
  return (
    <div className="shrink-0 overflow-hidden rounded-full border-2" style={style}>
      {character?.image ? (
        <CharacterPortrait src={character.image} color={color} />
      ) : (
        <AvatarDrawing parts={parts} color={color} />
      )}
    </div>
  )
}

/** A series character's portrait (rendered from their game model) on an attribute-coloured glow. */
export function CharacterPortrait({ src, color }: { src: string; color: string }) {
  return (
    <div className="h-full w-full" style={{ background: `radial-gradient(circle at 50% 35%, ${color}d9, #07080d 75%)` }}>
      <img src={asset(src)} alt="" className="h-full w-full object-cover" draggable={false} />
    </div>
  )
}

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

export function AvatarDrawing({ parts, color }: { parts: AvatarParts; color: string }) {
  const id = useId()
  const { skin, hair, hairColor, eyes, eyeColor, outfit, accessory } = parts
  const hairDark = shade(hairColor, 0.7)
  const brow = shade(hairColor, hair === 'bald' ? 0.4 : 0.6)

  return (
    <svg viewBox="0 0 200 200" className="block h-full w-full">
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor="#07080d" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}bg)`} />

      {/* hair behind the head */}
      {hair === 'long' && <path d="M60 92 Q56 38 100 38 Q144 38 140 92 L150 190 L50 190 Z" fill={hairDark} />}
      {hair === 'twintails' && (
        <>
          <path d="M66 82 Q30 96 34 150 Q38 176 56 184 Q48 140 70 104 Z" fill={hairDark} />
          <path d="M134 82 Q170 96 166 150 Q162 176 144 184 Q152 140 130 104 Z" fill={hairDark} />
        </>
      )}
      {hair === 'ponytail' && <path d="M126 64 Q178 80 168 176 Q150 130 128 100 Z" fill={hairDark} />}

      {/* body */}
      <path d="M26 200 Q30 152 100 146 Q170 152 174 200 Z" fill={outfit} />
      <path d="M78 150 L100 178 L122 150 Q100 146 78 150 Z" fill={shade(outfit, 0.65)} />
      <rect x="88" y="118" width="24" height="34" rx="8" fill={shade(skin, 0.85)} />

      {/* head */}
      <ellipse cx="64" cy="100" rx="7" ry="10" fill={shade(skin, 0.92)} />
      <ellipse cx="136" cy="100" rx="7" ry="10" fill={shade(skin, 0.92)} />
      <ellipse cx="100" cy="94" rx="36" ry="42" fill={skin} />

      {/* eyes and brows */}
      {[84, 116].map((x, i) => {
        const dir = i === 0 ? 1 : -1
        return (
          <g key={x}>
            {eyes === 'happy' ? (
              <path
                d={`M${x - 7} 102 Q${x} 92 ${x + 7} 102`}
                stroke="#2a1a14"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              <>
                {eyes === 'sharp' ? (
                  <path d={`M${x - 9} 100 Q${x} 92 ${x + 9} 100 Q${x} 106 ${x - 9} 100 Z`} fill="#fff" />
                ) : (
                  <ellipse cx={x} cy="100" rx="7.5" ry={eyes === 'calm' ? 6 : 8.5} fill="#fff" />
                )}
                <circle cx={x} cy="101" r={eyes === 'sharp' ? 4.2 : 5.2} fill={eyeColor} />
                <circle cx={x} cy="101" r="2.2" fill="#0a0a0a" />
                <circle cx={x + 1.8} cy="98.5" r="1.4" fill="#fff" />
                {eyes === 'calm' && <path d={`M${x - 8} 97 L${x + 8} 97`} stroke={shade(skin, 0.6)} strokeWidth="2.5" />}
              </>
            )}
            <path
              d={eyes === 'sharp' ? `M${x - 9 * dir} ${86} L${x + 8 * dir} ${91}` : `M${x - 8} 88 Q${x} 84 ${x + 8} 88`}
              stroke={brow}
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )
      })}
      <path d="M98 108 Q100 113 102 108" stroke={shade(skin, 0.7)} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path
        d={eyes === 'sharp' ? 'M92 122 L108 121' : 'M90 120 Q100 128 110 120'}
        stroke="#7a3a30"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />

      {/* hair in front */}
      {hair === 'spiky' && (
        <path
          d="M60 96 L52 66 L68 72 L62 42 L84 60 L90 28 L104 56 L120 30 L122 58 L144 42 L136 70 L152 70 L140 96 Q128 70 112 74 L104 64 L94 76 L84 68 Q70 76 60 96 Z"
          fill={hairColor}
        />
      )}
      {hair === 'bowl' && (
        <path d="M60 100 Q58 46 100 46 Q142 46 140 100 L132 82 L120 88 L112 78 L100 88 L88 78 L80 88 L68 82 Z" fill={hairColor} />
      )}
      {(hair === 'short' || hair === 'ponytail' || hair === 'twintails') && (
        <path
          d="M62 94 Q58 48 100 48 Q142 48 138 94 Q132 70 116 68 L108 80 L102 68 Q84 66 74 76 Q66 82 62 94 Z"
          fill={hairColor}
        />
      )}
      {hair === 'ponytail' && <path d="M74 74 Q70 96 76 112 Q66 100 66 84 Z" fill={hairColor} />}
      {hair === 'twintails' && (
        <>
          <circle cx="64" cy="82" r="6" fill={outfit} />
          <circle cx="136" cy="82" r="6" fill={outfit} />
        </>
      )}
      {hair === 'long' && (
        <path d="M62 96 Q58 46 100 46 Q142 46 138 96 L140 140 L128 100 Q122 72 102 72 Q78 72 72 100 L60 140 Z" fill={hairColor} />
      )}
      {hair === 'swept' && (
        <path
          d="M60 98 Q54 52 94 44 L154 26 L132 50 L166 54 L136 66 L156 84 L136 86 Q122 66 98 70 Q76 74 60 98 Z"
          fill={hairColor}
        />
      )}

      {/* accessories */}
      {accessory === 'glasses' && (
        <g stroke="#1a1a22" strokeWidth="2.6" fill="#ffffff22">
          <circle cx="84" cy="100" r="11" />
          <circle cx="116" cy="100" r="11" />
          <path d="M95 99 L105 99" />
        </g>
      )}
      {accessory === 'mask' && (
        <g>
          <path
            d="M60 92 Q100 78 140 92 L136 108 Q118 112 104 104 L100 108 L96 104 Q82 112 64 108 Z"
            fill="#eef0f6"
            stroke="#9aa3b5"
            strokeWidth="1.5"
          />
          <path d="M72 96 Q84 92 94 99 Q84 104 72 100 Z" fill="#1e3a8a" />
          <path d="M128 96 Q116 92 106 99 Q116 104 128 100 Z" fill="#1e3a8a" />
        </g>
      )}
      {accessory === 'goggles' && (
        <g>
          <rect x="60" y="62" width="80" height="9" rx="4" fill="#2a2a30" />
          <circle cx="84" cy="64" r="10" fill="#f2c230" stroke="#2a2a30" strokeWidth="3" />
          <circle cx="116" cy="64" r="10" fill="#f2c230" stroke="#2a2a30" strokeWidth="3" />
        </g>
      )}
      {accessory === 'headband' && <rect x="62" y="66" width="76" height="9" rx="3" fill={shade(outfit, 1.1)} />}
      {accessory === 'visor' && (
        <path d="M58 90 L142 90 L136 108 Q100 116 64 108 Z" fill="#4dd6ff" fillOpacity="0.55" stroke="#0e1a2a" strokeWidth="3" />
      )}
      {accessory === 'crown' && (
        <path d="M66 52 L74 26 L88 44 L100 18 L112 44 L126 26 L134 52 Z" fill="#f5c518" stroke="#a87c00" strokeWidth="2.5" />
      )}
      {accessory === 'halo' && (
        <ellipse cx="100" cy="30" rx="34" ry="8" fill="none" stroke="#fff6b0" strokeWidth="5" opacity="0.9" />
      )}
      {accessory === 'cap' && (
        <g>
          <path d="M62 78 Q62 40 100 40 Q138 40 138 78 Z" fill={outfit} />
          <path d="M60 78 L150 78 Q150 88 128 86 L60 84 Z" fill={shade(outfit, 0.7)} />
        </g>
      )}
    </svg>
  )
}

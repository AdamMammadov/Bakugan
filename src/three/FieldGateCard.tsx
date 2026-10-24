import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ELEMENTS, type ElementInfo } from '../data/elements'

/** Card size (card units): long side along x, short side along z. */
const LONG = 3.0
const SHORT = 2.2
/** Thickness of the card's plate. */
const PLATE = 0.03
/** Height of the card's top surface (card units, the print included): Bakugan stand on it. */
export const FIELD_CARD_TOP = PLATE + 0.002
/** How long the card takes to turn over. */
const FLIP = 0.55

const ICONS = ELEMENTS.map((e) => e.icon)

const DISPLAY = '"Orbitron", "Rajdhani", sans-serif'

/** The back of a Gate Card: dark plate, silver frame and the Bakugan emblem. Long side across the canvas. */
function paintBack(c: HTMLCanvasElement) {
  const w = c.width
  const h = c.height
  const g = c.getContext('2d')!
  const bg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.62)
  bg.addColorStop(0, '#26305c')
  bg.addColorStop(0.55, '#121838')
  bg.addColorStop(1, '#06080f')
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  // faint hexagon grid
  g.strokeStyle = 'rgba(140,160,230,.09)'
  g.lineWidth = 2
  const r = 34
  for (let row = 0; row * r * 1.5 < h + r; row++)
    for (let col = 0; col * r * Math.sqrt(3) < w + r; col++) {
      const cx = col * r * Math.sqrt(3) + (row % 2) * r * 0.866
      const cy = row * r * 1.5
      g.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      g.closePath()
      g.stroke()
    }
  // silver frame, a gold line inside it, cut corners
  const frame = (inset: number, width: number, style: string | CanvasGradient) => {
    const cut = 46 - inset * 0.4
    g.beginPath()
    g.moveTo(inset + cut, inset)
    g.lineTo(w - inset - cut, inset)
    g.lineTo(w - inset, inset + cut)
    g.lineTo(w - inset, h - inset - cut)
    g.lineTo(w - inset - cut, h - inset)
    g.lineTo(inset + cut, h - inset)
    g.lineTo(inset, h - inset - cut)
    g.lineTo(inset, inset + cut)
    g.closePath()
    g.lineWidth = width
    g.strokeStyle = style
    g.stroke()
  }
  const silver = g.createLinearGradient(0, 0, w, h)
  silver.addColorStop(0, '#f2f4f8')
  silver.addColorStop(0.5, '#8a93a6')
  silver.addColorStop(1, '#e4e8f0')
  frame(14, 22, silver)
  frame(40, 5, 'rgba(255,210,63,.75)')
  // the emblem: a silver hexagon badge with a gold "B", a gem of each attribute on its corners
  const cx = w / 2
  const cy = h * 0.45
  const R = h * 0.19
  const hex = (r: number) => {
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    g.closePath()
  }
  const plate = g.createLinearGradient(cx, cy - R, cx, cy + R)
  plate.addColorStop(0, '#1d2547')
  plate.addColorStop(1, '#0b0f20')
  hex(R)
  g.fillStyle = plate
  g.fill()
  g.lineWidth = 14
  g.strokeStyle = silver
  g.stroke()
  hex(R * 0.82)
  g.lineWidth = 3
  g.strokeStyle = 'rgba(255,210,63,.6)'
  g.stroke()
  const letter = g.createLinearGradient(0, cy - R * 0.6, 0, cy + R * 0.6)
  letter.addColorStop(0, '#fff3b0')
  letter.addColorStop(1, '#ff9d00')
  g.font = `italic 900 ${Math.round(R * 1.25)}px ${DISPLAY}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 10
  g.strokeStyle = '#0a0d18'
  g.strokeText('B', cx, cy + R * 0.05)
  g.fillStyle = letter
  g.fillText('B', cx, cy + R * 0.05)
  ELEMENTS.forEach((el, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    const gem = g.createRadialGradient(
      cx + Math.cos(a) * R - 4,
      cy + Math.sin(a) * R - 4,
      1,
      cx + Math.cos(a) * R,
      cy + Math.sin(a) * R,
      15,
    )
    gem.addColorStop(0, '#ffffff')
    gem.addColorStop(0.45, el.color)
    gem.addColorStop(1, '#05060c')
    g.beginPath()
    g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 15, 0, Math.PI * 2)
    g.fillStyle = gem
    g.fill()
  })
  // name
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `italic 900 ${Math.round(h * 0.07)}px ${DISPLAY}`
  g.lineWidth = 8
  g.strokeStyle = '#0a0d18'
  g.strokeText('BAKUGAN', cx, h * 0.73, w * 0.5)
  const gold = g.createLinearGradient(0, h * 0.69, 0, h * 0.77)
  gold.addColorStop(0, '#fff3b0')
  gold.addColorStop(1, '#ffb400')
  g.fillStyle = gold
  g.fillText('BAKUGAN', cx, h * 0.73, w * 0.5)
  g.font = `700 ${Math.round(h * 0.04)}px ${DISPLAY}`
  g.fillStyle = 'rgba(220,228,245,.85)'
  g.fillText('G A T E   C A R D', cx, h * 0.17, w * 0.6)
}

/**
 * The Gate Card on the field. It spins down and lands flat (long side along x), face down while it is closed
 * (`element` null): a card back with the Bakugan emblem. When it is opened it turns over with a flash and shows
 * its attribute; changing back to null turns it face down again. `glow` scales how brightly the open face shines.
 */
export function FieldGateCard({ element, glow = 1 }: { element: ElementInfo | null; glow?: number }) {
  const drop = useRef<THREE.Group>(null)
  const face = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const sheen = useRef<THREE.Mesh>(null)
  const border = useRef<THREE.MeshStandardMaterial>(null)
  const landed = useRef(0)
  const icons = useTexture(ICONS, (loaded) => {
    for (const t of [loaded].flat()) t.colorSpace = THREE.SRGBColorSpace
  })
  const iconOf = (el: ElementInfo) => icons[ELEMENTS.findIndex((e) => e.id === el.id)]

  const backTexture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 750
    paintBack(c)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => {
    // the name is painted again once the display font has loaded
    let live = true
    void document.fonts?.ready.then(() => {
      if (!live) return
      paintBack(backTexture.image as HTMLCanvasElement)
      backTexture.needsUpdate = true
    })
    return () => {
      live = false
      backTexture.dispose()
    }
  }, [backTexture])

  // which side is up (switched in the middle of a turn), and the last open face, still drawn while it turns down
  const [startsUp] = useState(!!element)
  const faceUp = useRef(startsUp)
  const back = useRef<THREE.Group>(null)
  const front = useRef<THREE.Group>(null)
  const [shown, setShown] = useState<ElementInfo | null>(element)
  const open = element ?? shown
  const turn = useRef<{ start: number | null; to: ElementInfo | null; swapped: boolean } | null>(null)
  const flash = useRef<{ start: number | null; color: THREE.Color }>({ start: null, color: new THREE.Color() })
  const target = useRef(element)
  useEffect(() => {
    if (target.current?.id === element?.id) return
    target.current = element
    turn.current = { start: null, to: element, swapped: false }
  }, [element])

  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime
    // spins down from above and lands flat
    landed.current = Math.min(landed.current + dt / 0.9, 1)
    const k = 1 - Math.pow(1 - landed.current, 3)
    const d = drop.current
    if (d) {
      d.position.y = THREE.MathUtils.lerp(6, 0, k)
      d.rotation.y = (1 - k) * Math.PI * 4
      d.rotation.z = (1 - k) * 0.8
    }
    // turning over: the print narrows to a line across the long side, the other side opens out
    const tr = turn.current
    let squash = 1
    if (tr) {
      tr.start ??= now
      const p = (now - tr.start) / FLIP
      if (p >= 0.5 && !tr.swapped) {
        tr.swapped = true
        faceUp.current = !!tr.to
        setShown(tr.to)
        if (tr.to) flash.current = { start: now, color: new THREE.Color(tr.to.glow) }
      }
      squash = Math.abs(Math.cos(Math.min(p, 1) * Math.PI))
      if (p >= 1) turn.current = null
    }
    if (face.current) face.current.scale.z = Math.max(squash, 0.001)
    if (back.current) back.current.visible = !faceUp.current
    if (front.current) front.current.visible = faceUp.current
    // the flash as it opens: a burst of light over the card and a ring racing out from it
    const f = flash.current
    const ft = f.start === null ? 99 : now - f.start
    const burst = Math.max(0, 1 - ft / 0.9)
    if (border.current) border.current.emissiveIntensity = 1.4 * glow * (1 + 5 * burst * burst)
    if (sheen.current) {
      sheen.current.visible = burst > 0
      const m = sheen.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.2 * burst * burst
      m.color.copy(f.color)
    }
    if (ring.current) {
      ring.current.visible = ft < 1.1
      const s = 0.4 + ft * 2.6
      ring.current.scale.set(s, s, s)
      const m = ring.current.material as THREE.MeshBasicMaterial
      m.opacity = Math.max(0, 1 - ft / 1.1) * 0.9
      m.color.copy(f.color)
    }
  })

  return (
    <group ref={drop} position={[0, 6, 0]}>
      <mesh position={[0, PLATE / 2, 0]} receiveShadow>
        <boxGeometry args={[LONG, PLATE, SHORT]} />
        <meshStandardMaterial color="#0c0d12" metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={face} position={[0, PLATE + 0.001, 0]}>
        {/* face down: the card back */}
        <group ref={back} visible={!startsUp}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[LONG - 0.04, SHORT - 0.04]} />
            <meshStandardMaterial
              map={backTexture}
              // dim like the open face, so the Bakugan standing on it stay clear
              color={new THREE.Color().setScalar(0.35 + glow * 0.5)}
              metalness={0.3}
              roughness={0.6}
              emissive="#ffffff"
              emissiveMap={backTexture}
              emissiveIntensity={0.12 * glow}
            />
          </mesh>
        </group>
        {/* face up: glowing border in the attribute's colour and its emblem */}
        <group ref={front} visible={startsUp}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[LONG - 0.08, SHORT - 0.08]} />
            <meshStandardMaterial
              ref={border}
              color={open?.color ?? '#9aa3b5'}
              emissive={open?.color ?? '#9aa3b5'}
              emissiveIntensity={1.4 * glow}
              toneMapped={glow < 1}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0004, 0]} receiveShadow>
            <planeGeometry args={[LONG - 0.24, SHORT - 0.24]} />
            <meshStandardMaterial color="#111219" metalness={0.4} roughness={0.5} />
          </mesh>
          {open && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0008, 0]}>
              <planeGeometry args={[1.5, 1.5]} />
              <meshBasicMaterial
                map={iconOf(open)}
                transparent
                color={new THREE.Color().setScalar(glow >= 1 ? 1 : glow * 0.45)}
                opacity={glow >= 1 ? 1 : 0.55 + glow}
                toneMapped={glow < 1}
              />
            </mesh>
          )}
        </group>
        <mesh ref={sheen} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]} visible={false}>
          <planeGeometry args={[LONG - 0.04, SHORT - 0.04]} />
          <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, PLATE + 0.004, 0]} visible={false}>
        <ringGeometry args={[0.92, 1, 96]} />
        <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

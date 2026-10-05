// Dev-only: turns ripped character models (Collada / OBJ+MTL) into a GLB plus a portrait PNG.
// http://localhost:5199/tools/preview/convert.html?src=tmp-rip/Dan/chara00.dae
import * as THREE from 'three'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const q = new URLSearchParams(location.search)
const src = q.get('src')!
const dir = src.slice(0, src.lastIndexOf('/') + 1)

async function load(): Promise<THREE.Object3D> {
  if (src.endsWith('.dae')) return (await new ColladaLoader().loadAsync('/' + src)).scene
  const mtl = await new MTLLoader().setPath('/' + dir).loadAsync(src.slice(dir.length).replace('.obj', '.mtl'))
  mtl.preload()
  return new OBJLoader().setMaterials(mtl).loadAsync('/' + src)
}

const root = await load()
{
  const dbg: string[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const uv = m.geometry.attributes.uv
    let lo = Infinity
    let hi = -Infinity
    if (uv) for (let i = 0; i < uv.array.length; i++) {
      lo = Math.min(lo, uv.array[i])
      hi = Math.max(hi, uv.array[i])
    }
    const mm = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshPhongMaterial
    dbg.push(`${mm.type} map=${mm.map ? (mm.map.image as HTMLImageElement)?.src?.slice(-24) + ' ' + (mm.map.image as HTMLImageElement)?.width : 'none'} color=${mm.color?.getHexString()}`)
    dbg.push(`${m.name} uv=${uv ? uv.itemSize : 'none'} [${lo.toFixed(2)},${hi.toFixed(2)}] groups=${m.geometry.groups.length}`)
  })
  ;(window as any).dbg = dbg
}
// textures stream in after the model itself
await new Promise((r) => setTimeout(r, 2500))
root.updateMatrixWorld(true)
// front=<texture suffix>:<min y>: triangles of that texture above that height (glasses frames
// lying on the face) become their own mesh, drawn in front of the eyes
if (q.get('front')) {
  const [suffix, minY] = q.get('front')!.split(':')
  const splits: [THREE.Mesh, THREE.Mesh][] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const src = (((m.material as THREE.MeshPhongMaterial).map?.image as HTMLImageElement | undefined)?.src ?? '')
    if (!src.endsWith(suffix)) return
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    const pos = g.attributes.position
    const keep: number[] = []
    const lift: number[] = []
    for (let t = 0; t < pos.count; t += 3) ((pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3 > Number(minY) ? lift : keep).push(t)
    const pick = (tris: number[]) => {
      const out = new THREE.BufferGeometry()
      for (const name of Object.keys(g.attributes)) {
        const attr = g.attributes[name] as THREE.BufferAttribute
        const arr = new Float32Array(tris.length * 3 * attr.itemSize)
        tris.forEach((t, i) => {
          for (let v = 0; v < 3; v++) for (let k = 0; k < attr.itemSize; k++) arr[(i * 3 + v) * attr.itemSize + k] = attr.array[(t + v) * attr.itemSize + k]
        })
        out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize))
      }
      return out
    }
    if (!lift.length) return
    m.geometry = pick(keep)
    const front = new THREE.Mesh(pick(lift), m.material)
    front.name = `front-${m.name}`
    splits.push([m, front])
  })
  for (const [m, front] of splits) m.parent!.add(front)
}
// hide=<mesh,…>: drop meshes (for finding which part is which)
if (q.get('hide')) {
  const drop: THREE.Object3D[] = []
  root.traverse((o) => q.get('hide')!.split(',').includes(o.name) && drop.push(o))
  drop.forEach((o) => o.removeFromParent())
}
// pixel-art textures from the DS: keep them crisp, and make the materials unlit-friendly
/** Share of see-through pixels in a texture (0 = fully opaque). */
function alphaShare(tex: THREE.Texture | null) {
  const img = tex?.image as HTMLImageElement | undefined
  if (!img?.width) return 0
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) n++
  return n / (d.length / 4)
}

/** True when a texture has see-through pixels (eyes, mouths and hair tips drawn as overlays). */
function hasAlpha(tex: THREE.Texture | null) {
  const img = tex?.image as HTMLImageElement | undefined
  if (!img?.width) return false
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) return true
  return false
}
// the toon-outline shell: a big mesh wrapping the whole model, head to toe
const shells = new Set<THREE.Mesh>()
{
  const all = new THREE.Box3().setFromObject(root)
  const height = all.max.y - all.min.y
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const b = new THREE.Box3().setFromObject(m)
    if (b.max.y - b.min.y > 0.97 * height && m.geometry.attributes.position.count > 1200) shells.add(m)
  })
}
root.traverse((o) => {
  const m = o as THREE.Mesh
  if (!m.isMesh) return
  // some rips ship without normals, which renders them nearly black
  if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals()
  // rebuild smooth normals from the triangles themselves (some rips ship unusable ones)
  if (q.get('normals') === 'compute') {
    m.geometry.deleteAttribute('normal')
    m.geometry = mergeVertices(m.geometry, 1e-4)
    m.geometry.computeVertexNormals()
  }
  // some rips store normals pointing into the model
  if (q.get('normals') === 'flip') {
    const n = m.geometry.attributes.normal
    for (let i = 0; i < n.array.length; i++) (n.array as Float32Array)[i] *= -1
  }
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  m.material = mats.map((old) => {
    const map = (old as THREE.MeshPhongMaterial).map ?? null
    if (map) {
      map.magFilter = THREE.NearestFilter
      // Wii rips address their face atlases with negative UVs
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      map.minFilter = THREE.LinearFilter
      map.generateMipmaps = false
      map.needsUpdate = true
      map.colorSpace = THREE.SRGBColorSpace
    }
    // face parts (eyes, brows, mouth) come from small cells of an expression atlas
    const uv = m.geometry.attributes.uv
    let span = 0
    if (uv) {
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < uv.count; i++) {
        lo = Math.min(lo, uv.getX(i))
        hi = Math.max(hi, uv.getX(i))
      }
      span = hi - lo
    }
    const facePart = span > 0 && span < 0.3 && m.geometry.attributes.position.count < 400
    // the eyeball (white, iris, highlight) sits behind the eye sheet and shows through its hole;
    // it is drawn in front of the skin but behind the sheet
    const texName = ((map?.image as HTMLImageElement | undefined)?.src ?? '').split('/').pop() ?? ''
    const eyeball = !!map && texName.endsWith(q.get('eyeball') ?? '_texture1.png') && m.geometry.attributes.position.count < 600
    // the toon outline: a slightly larger shell of the whole body sampling one dark spot of a
    // texture; only its far side may be drawn, or it paints over the model
    const outline = q.get('outline') !== '0' && shells.has(m)
    if (outline) {
      if (!m.name.startsWith('outline')) m.name = `outline-${m.name}`
      // which way the shell's triangles wind (its signed volume) decides which side is "back"
      const g = m.geometry
      const pos = g.attributes.position
      const idx = g.index
      const tri = (i: number) => (idx ? idx.getX(i) : i)
      const va = new THREE.Vector3()
      const vb = new THREE.Vector3()
      const vc = new THREE.Vector3()
      let volume = 0
      const n = idx ? idx.count : pos.count
      for (let i = 0; i < n; i += 3) {
        va.fromBufferAttribute(pos, tri(i))
        vb.fromBufferAttribute(pos, tri(i + 1))
        vc.fromBufferAttribute(pos, tri(i + 2))
        volume += va.dot(vb.clone().cross(vc)) / 6
      }
      const outward = volume >= 0 ? 1 : -1
      // push the shell a little outwards so it never lies on the body itself
      if (!g.attributes.normal) g.computeVertexNormals()
      const nrm = g.attributes.normal
      const inflate = Number(q.get('inflate') ?? 0.4) * outward
      for (let i = 0; i < pos.count; i++)
        pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * inflate, pos.getY(i) + nrm.getY(i) * inflate, pos.getZ(i) + nrm.getZ(i) * inflate)
      pos.needsUpdate = true
      if (q.get('outline') === 'drop') m.visible = false
      // glTF only knows front or both sides, so turn the triangles round instead of drawing back faces
      if (outward > 0) {
        if (idx) {
          for (let i = 0; i < idx.count; i += 3) {
            const t = idx.getX(i + 1)
            idx.setX(i + 1, idx.getX(i + 2))
            idx.setX(i + 2, t)
          }
          idx.needsUpdate = true
        } else {
          for (const attr of Object.values(g.attributes) as THREE.BufferAttribute[]) {
            for (let i = 0; i < attr.count; i += 3)
              for (let k = 0; k < attr.itemSize; k++) {
                const t = attr.array[(i + 1) * attr.itemSize + k]
                attr.array[(i + 1) * attr.itemSize + k] = attr.array[(i + 2) * attr.itemSize + k]
                attr.array[(i + 2) * attr.itemSize + k] = t
              }
            attr.needsUpdate = true
          }
        }
      }
      return new THREE.MeshBasicMaterial({ color: new THREE.Color('#' + (q.get('outlineColor') ?? '16110c')), side: THREE.FrontSide })
    }
    if (m.name.startsWith('front-')) {
      const frontOffset = Number(q.get('frontOffset') ?? -800)
      return new THREE.MeshBasicMaterial({
        map,
        color: new THREE.Color(Number(q.get('gain') ?? 1), Number(q.get('gain') ?? 1), Number(q.get('gain') ?? 1)),
        transparent: hasAlpha(map),
        alphaTest: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: frontOffset / 10,
        polygonOffsetUnits: frontOffset,
        side: THREE.DoubleSide,
      })
    }
    if (eyeball) {
      if (!m.name.startsWith('eyeball')) m.name = `eyeball-${m.name}`
      const ballOffset = Number(q.get('ballOffset') ?? -200)
      return new THREE.MeshBasicMaterial({
        map,
        color: new THREE.Color('#' + (q.get('faceTint') ?? 'ffffff')),
        polygonOffset: true,
        polygonOffsetFactor: ballOffset / 10,
        polygonOffsetUnits: ballOffset,
        side: THREE.DoubleSide,
      })
    }
    // glTF has no polygon offset: tag face parts so the game can re-apply it
    if (facePart && !m.name.startsWith('face')) m.name = `face-${m.name}`
    // the game tints the see-through iris of the eye atlas; paint it in so the eyes have colour
    // only the eye sheet: mostly opaque skin with see-through irises (brows are mostly see-through)
    const share = facePart ? alphaShare(map) : 0
    if (facePart && map && q.get('iris') && share > 0 && share < 0.4) {
      const img = map.image as HTMLImageElement
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.fillStyle = '#' + q.get('iris')
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(img, 0, 0)
      const filled = new THREE.CanvasTexture(c)
      filled.colorSpace = THREE.SRGBColorSpace
      filled.magFilter = THREE.NearestFilter
      filled.wrapS = filled.wrapT = THREE.RepeatWrapping
      filled.flipY = map.flipY
      if (q.get('basic') === '1')
        return new THREE.MeshBasicMaterial({
          map: filled,
          color: new THREE.Color('#' + (q.get('faceTint') ?? 'ffffff')),
          polygonOffset: true,
          polygonOffsetFactor: Number(q.get('faceOffset') ?? -60) / 10,
          polygonOffsetUnits: Number(q.get('faceOffset') ?? -60),
          side: THREE.DoubleSide,
        })
      return new THREE.MeshStandardMaterial({
        map: filled,
        roughness: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: Number(q.get('faceOffset') ?? -60) / 10,
        polygonOffsetUnits: Number(q.get('faceOffset') ?? -60),
        side: THREE.DoubleSide,
      })
    }
    const overlay = hasAlpha(map) || facePart
    const offset = facePart ? Number(q.get('faceOffset') ?? -60) : -2
    if (q.get('basic') === '1') return new THREE.MeshBasicMaterial({ map, color: facePart ? new THREE.Color('#' + (q.get('faceTint') ?? 'ffffff')) : new THREE.Color(Number(q.get('gain') ?? 1), Number(q.get('gain') ?? 1), Number(q.get('gain') ?? 1)), transparent: overlay, alphaTest: overlay ? 0.3 : 0, side: THREE.DoubleSide, polygonOffset: overlay, polygonOffsetFactor: offset / 10, polygonOffsetUnits: offset })
    // Wii models store most textures at half brightness and double them when drawing
    const gain = facePart ? 1 : Number(q.get('gain') ?? 1)
    return new THREE.MeshStandardMaterial({
      map,
      color: map ? new THREE.Color(gain, gain, gain) : (old as THREE.MeshPhongMaterial).color,
      roughness: 0.8,
      alphaTest: overlay ? 0.3 : 0,
      transparent: overlay,
      // overlays sit on top of the skin they are painted over
      polygonOffset: overlay,
      polygonOffsetFactor: overlay ? offset / 10 : 0,
      polygonOffsetUnits: overlay ? offset : 0,
      side: THREE.DoubleSide,
    })
  }) as unknown as THREE.Material
  if ((m.material as unknown as THREE.Material[]).length === 1) m.material = (m.material as unknown as THREE.Material[])[0]
})

// rig=<name>: cut a one-piece monster into the named pivot nodes the game animates (rigs.json)
if (q.get('rig')) {
  type Part = { name: string; parent?: string; pivot: [number, number, number]; test: string; bake?: [number, number, number] }
  const parts: Part[] = (await (await fetch('/tools/preview/rigs.json')).json())[q.get('rig')!]
  const tests = parts.map((p) => new Function('x', 'y', 'z', `return ${p.test}`) as (x: number, y: number, z: number) => boolean)
  // triangles per part (index -1 = body), per material
  const buckets = new Map<number, { geo: THREE.BufferGeometry; tris: number[]; mat: THREE.Material }[]>()
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
  for (const m of meshes) {
    m.updateMatrixWorld(true)
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld)
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }]
    const pos = g.attributes.position
    for (const grp of groups) {
      const per = new Map<number, number[]>()
      for (let t = grp.start; t < grp.start + grp.count; t += 3) {
        const x = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3
        const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
        const z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
        const k = tests.findIndex((f) => f(x, y, z))
        if (!per.has(k)) per.set(k, [])
        per.get(k)!.push(t)
      }
      for (const [k, tris] of per) {
        if (!buckets.has(k)) buckets.set(k, [])
        buckets.get(k)!.push({ geo: g, tris, mat: mats[grp.materialIndex ?? 0] })
      }
    }
    m.removeFromParent()
  }
  const take = (g: THREE.BufferGeometry, tris: number[]) => {
    const out = new THREE.BufferGeometry()
    for (const name of Object.keys(g.attributes)) {
      const attr = g.attributes[name] as THREE.BufferAttribute
      const arr = new Float32Array(tris.length * 3 * attr.itemSize)
      tris.forEach((t, i) => {
        for (let v = 0; v < 3; v++) for (let c = 0; c < attr.itemSize; c++) arr[(i * 3 + v) * attr.itemSize + c] = attr.array[(t + v) * attr.itemSize + c]
      })
      out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize))
    }
    return out
  }
  const nodes = new Map<string, THREE.Group>()
  for (const part of parts) {
    const n = new THREE.Group()
    n.name = part.name
    nodes.set(part.name, n)
  }
  const body = new THREE.Group()
  body.name = 'body'
  root.add(body)
  for (const [k, list] of [...buckets].sort((a, b) => a[0] - b[0])) {
    const part = parts[k]
    for (const { geo, tris, mat } of list) {
      const piece = take(geo, tris)
      if (!part) {
        body.add(new THREE.Mesh(piece, mat))
        continue
      }
      const pivot = new THREE.Vector3(...part.pivot)
      piece.translate(-pivot.x, -pivot.y, -pivot.z)
      if (part.bake) {
        piece.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.bake)))
        piece.computeVertexNormals()
      }
      const mesh = new THREE.Mesh(piece, mat)
      mesh.name = `${part.name}-mesh`
      nodes.get(part.name)!.add(mesh)
    }
  }
  // place each node at its pivot, relative to its parent's pivot
  for (const part of parts) {
    const n = nodes.get(part.name)
    if (!n) continue
    const parent = part.parent ? nodes.get(part.parent) : undefined
    const base = part.parent ? new THREE.Vector3(...parts.find((p) => p.name === part.parent)!.pivot) : new THREE.Vector3()
    n.position.set(part.pivot[0] - base.x, part.pivot[1] - base.y, part.pivot[2] - base.z)
    ;(parent ?? root).add(n)
  }
  ;(window as any).rigParts = [...nodes.keys()]
}

// stand on the floor, centred, 1.75 units tall (a person in metres)
const box = new THREE.Box3().setFromObject(root)
const size = box.getSize(new THREE.Vector3())
const s = Number(q.get('height') ?? 1.75) / size.y
const wrap = new THREE.Group()
root.scale.multiplyScalar(s)
root.updateMatrixWorld(true)
const b2 = new THREE.Box3().setFromObject(root)
const c = b2.getCenter(new THREE.Vector3())
root.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z))
wrap.add(root)
;(window as any).info = { size: size.toArray(), s }

const NO_SPLIT = q.get('split') === '0'
// Split the T-posed arms off the body so the game can swing them from the shoulders.
const SHOULDER = q.get('split') === '0' ? Infinity : Number(q.get('shoulder') ?? 0.24)
const ARM_MIN_Y = Number(q.get('armY') ?? 1.1)
const ARM_MAX_Y = Number(q.get('armTop') ?? 1.42)
wrap.updateMatrixWorld(true)
const parts: Record<'body' | 'armL' | 'armR', { geo: THREE.BufferGeometry; mat: THREE.Material }[]> = { body: [], armL: [], armR: [] }
if (!NO_SPLIT) wrap.traverse((o) => {
  const m = o as THREE.Mesh
  if (!m.isMesh) return
  const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld)
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }]
  for (const grp of groups) {
    const buckets = { body: [] as number[], armL: [] as number[], armR: [] as number[] }
    const pos = g.attributes.position
    for (let t = grp.start; t < grp.start + grp.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3
      const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3
      // only the T-posed arms: wide and up at shoulder height (not a flared coat hem)
      const side = cy < ARM_MIN_Y || cy > ARM_MAX_Y ? 'body' : cx > SHOULDER ? 'armR' : cx < -SHOULDER ? 'armL' : 'body'
      buckets[side].push(t)
    }
    for (const key of ['body', 'armL', 'armR'] as const) {
      const tris = buckets[key]
      if (!tris.length) continue
      const out = new THREE.BufferGeometry()
      for (const name of Object.keys(g.attributes)) {
        if (name === 'skinIndex' || name === 'skinWeight') continue
        const attr = g.attributes[name] as THREE.BufferAttribute
        const arr = new Float32Array(tris.length * 3 * attr.itemSize)
        tris.forEach((t, i) => {
          for (let v = 0; v < 3; v++) for (let k = 0; k < attr.itemSize; k++) arr[(i * 3 + v) * attr.itemSize + k] = attr.array[(t + v) * attr.itemSize + k]
        })
        out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize))
      }
      parts[key].push({ geo: out, mat: mats[grp.materialIndex ?? 0] })
    }
  }
})
let rig = new THREE.Group()
rig.name = 'brawler'
for (const key of NO_SPLIT ? [] : (['body', 'armL', 'armR'] as const)) {
  if (key !== 'body' && !parts[key].length) continue
  const node = new THREE.Group()
  node.name = key
  let pivot = new THREE.Vector3()
  if (key !== 'body') {
    // shoulder joint: where the arm meets the body
    const box = new THREE.Box3()
    parts[key].forEach((p) => {
      p.geo.computeBoundingBox()
      box.union(p.geo.boundingBox!)
    })
    const c = box.getCenter(new THREE.Vector3())
    pivot = new THREE.Vector3(key === 'armR' ? SHOULDER : -SHOULDER, c.y, c.z)
    node.position.copy(pivot)
  }
  for (const p of parts[key]) {
    p.geo.translate(-pivot.x, -pivot.y, -pivot.z)
    node.add(new THREE.Mesh(p.geo, p.mat))
  }
  rig.add(node)
}
if (NO_SPLIT) {
  rig = wrap
} else {
  wrap.clear()
  wrap.add(rig)
}
// arms down for the pictures
const armDown = Number(q.get('down') ?? 1.25)
const armRNode = rig.getObjectByName('armR')
const armLNode = rig.getObjectByName('armL')
if (armRNode) armRNode.rotation.z = -armDown
if (armLNode) armLNode.rotation.z = armDown

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setSize(512, 512)
renderer.setClearColor(0x000000, 0)
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.add(wrap)
scene.add(new THREE.AmbientLight(0xffffff, 1.6))
const sun = new THREE.DirectionalLight(0xffffff, 1.6)
sun.position.set(1, 2, 3)
scene.add(sun)
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 22), 1, 0.01, 50)
const yaw = Number(q.get('yaw') ?? 0)
wrap.rotation.y = yaw
const ty = Number(q.get('ty') ?? 1.45)
const dist = Number(q.get('d') ?? 1.6)
cam.position.set(0, ty + 0.05, dist)
cam.lookAt(0, ty, 0)
renderer.render(scene, cam)
;(window as any).portrait = renderer.domElement.toDataURL('image/png')

// full-body shot for checking, then the GLB
cam.position.set(0, 0.9, 4.5)
cam.lookAt(0, 0.85, 0)
renderer.render(scene, cam)
;(window as any).body = renderer.domElement.toDataURL('image/png')
wrap.rotation.y = 0
if (armRNode) armRNode.rotation.z = 0
if (armLNode) armLNode.rotation.z = 0
new GLTFExporter().parse(
  rig,
  (glb) => {
    const bytes = new Uint8Array(glb as ArrayBuffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    ;(window as any).glb = btoa(bin)
  },
  (e) => ((window as any).glbError = String(e)),
  { binary: true },
)

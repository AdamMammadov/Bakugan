// Dev-only: turns ripped character models (Collada / OBJ+MTL) into a GLB plus a portrait PNG.
// http://localhost:5199/tools/preview/convert.html?src=tmp-rip/Dan/chara00.dae
import * as THREE from 'three'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

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
// textures stream in after the model itself
await new Promise((r) => setTimeout(r, 2500))
root.updateMatrixWorld(true)
// pixel-art textures from the DS: keep them crisp, and make the materials unlit-friendly
root.traverse((o) => {
  const m = o as THREE.Mesh
  if (!m.isMesh) return
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  m.material = mats.map((old) => {
    const map = (old as THREE.MeshPhongMaterial).map ?? null
    if (map) {
      map.magFilter = THREE.NearestFilter
      map.colorSpace = THREE.SRGBColorSpace
    }
    return new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : (old as THREE.MeshPhongMaterial).color, roughness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide })
  }) as unknown as THREE.Material
  if ((m.material as unknown as THREE.Material[]).length === 1) m.material = (m.material as unknown as THREE.Material[])[0]
})

// stand on the floor, centred, 1.75 units tall (a person in metres)
const box = new THREE.Box3().setFromObject(root)
const size = box.getSize(new THREE.Vector3())
const s = 1.75 / size.y
const wrap = new THREE.Group()
root.scale.multiplyScalar(s)
root.updateMatrixWorld(true)
const b2 = new THREE.Box3().setFromObject(root)
const c = b2.getCenter(new THREE.Vector3())
root.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z))
wrap.add(root)
;(window as any).info = { size: size.toArray(), s }

// Split the T-posed arms off the body so the game can swing them from the shoulders.
const SHOULDER = Number(q.get('shoulder') ?? 0.24)
const ARM_MIN_Y = Number(q.get('armY') ?? 1.1)
const ARM_MAX_Y = Number(q.get('armTop') ?? 1.42)
wrap.updateMatrixWorld(true)
const parts: Record<'body' | 'armL' | 'armR', { geo: THREE.BufferGeometry; mat: THREE.Material }[]> = { body: [], armL: [], armR: [] }
wrap.traverse((o) => {
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
const rig = new THREE.Group()
rig.name = 'brawler'
for (const key of ['body', 'armL', 'armR'] as const) {
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
wrap.clear()
wrap.add(rig)
// arms down for the pictures
const armDown = Number(q.get('down') ?? 1.25)
rig.getObjectByName('armR')!.rotation.z = -armDown
rig.getObjectByName('armL')!.rotation.z = armDown

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
rig.getObjectByName('armR')!.rotation.z = 0
rig.getObjectByName('armL')!.rotation.z = 0
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

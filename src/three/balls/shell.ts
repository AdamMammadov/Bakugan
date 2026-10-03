import * as THREE from 'three'

/**
 * Helpers for building a segmented Bakugan ball. Shell pieces are bands of a sphere
 * whose pole points along ±X; `phi` runs around the X axis: 0 = top, π/2 = front (+Z),
 * π = bottom, 3π/2 = back.
 */
export const R = 0.5

/** A piece of the spherical shell between two angles around X and two distances from the pole. */
export function bandGeometry(phiStart: number, phiEnd: number, thetaStart: number, thetaEnd: number, radius = R, side: 1 | -1 = 1) {
  const g = new THREE.SphereGeometry(radius, 40, 16, phiStart, phiEnd - phiStart, thetaStart, thetaEnd - thetaStart)
  // pole y → +x (phi 0 then points up)
  g.rotateZ(-Math.PI / 2)
  if (side === -1) g.rotateY(Math.PI)
  return g
}

/** Point on the sphere for a given angle around X (`phi`) and X offset in [-1, 1]. */
export function surfacePoint(phi: number, x: number, radius = R) {
  const ring = Math.sqrt(Math.max(0, 1 - x * x))
  return new THREE.Vector3(x, Math.cos(phi) * ring, Math.sin(phi) * ring).multiplyScalar(radius)
}

/** Quaternion that turns +Y to point outward from the sphere centre at `p`. */
export function outward(p: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize())
}

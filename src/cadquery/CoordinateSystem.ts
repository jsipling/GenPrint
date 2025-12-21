import type { Vec3, Plane, CoordinateSystem } from './types'

/**
 * Create a coordinate system from a standard plane specification.
 */
export function planeToCoordinateSystem(plane: Plane): CoordinateSystem {
  switch (plane) {
    case 'XY':
      return {
        origin: [0, 0, 0],
        xDir: [1, 0, 0],
        yDir: [0, 1, 0],
        zDir: [0, 0, 1]
      }
    case 'XZ':
      return {
        origin: [0, 0, 0],
        xDir: [1, 0, 0],
        yDir: [0, 0, 1],
        zDir: [0, -1, 0]
      }
    case 'YZ':
      return {
        origin: [0, 0, 0],
        xDir: [0, 1, 0],
        yDir: [0, 0, 1],
        zDir: [1, 0, 0]
      }
  }
}

/**
 * Create a coordinate system on a face using centroid and normal.
 */
export function coordinateSystemOnFace(
  centroid: Vec3,
  normal: Vec3,
  offset: number = 0,
  invert: boolean = false
): CoordinateSystem {
  const zDir: Vec3 = invert
    ? [-normal[0], -normal[1], -normal[2]]
    : [...normal] as Vec3

  // Derive X direction perpendicular to Z using Gram-Schmidt
  const xDir = computeXDir(zDir)
  const yDir = cross(zDir, xDir)

  // Apply offset along normal
  const origin: Vec3 = [
    centroid[0] + zDir[0] * offset,
    centroid[1] + zDir[1] * offset,
    centroid[2] + zDir[2] * offset
  ]

  return { origin, xDir, yDir, zDir }
}

/**
 * Transform a local 2D point to global 3D coordinates.
 */
export function localToGlobal(cs: CoordinateSystem, local: [number, number]): Vec3 {
  const [x, y] = local
  return [
    cs.origin[0] + x * cs.xDir[0] + y * cs.yDir[0],
    cs.origin[1] + x * cs.xDir[1] + y * cs.yDir[1],
    cs.origin[2] + x * cs.xDir[2] + y * cs.yDir[2]
  ]
}

/**
 * Transform a local 3D point to global coordinates.
 */
export function localToGlobal3D(cs: CoordinateSystem, local: Vec3): Vec3 {
  const [x, y, z] = local
  return [
    cs.origin[0] + x * cs.xDir[0] + y * cs.yDir[0] + z * cs.zDir[0],
    cs.origin[1] + x * cs.xDir[1] + y * cs.yDir[1] + z * cs.zDir[1],
    cs.origin[2] + x * cs.xDir[2] + y * cs.yDir[2] + z * cs.zDir[2]
  ]
}

/**
 * Get the 4x4 transformation matrix for this coordinate system.
 * Suitable for use with Manifold's transform() method.
 */
export function getTransformMatrix(cs: CoordinateSystem): number[] {
  // Column-major 4x4 matrix (like WebGL/Three.js)
  return [
    cs.xDir[0], cs.xDir[1], cs.xDir[2], 0,
    cs.yDir[0], cs.yDir[1], cs.yDir[2], 0,
    cs.zDir[0], cs.zDir[1], cs.zDir[2], 0,
    cs.origin[0], cs.origin[1], cs.origin[2], 1
  ]
}

// ==================== Vector Math Utilities ====================

/**
 * Compute X direction perpendicular to Z using Gram-Schmidt.
 */
function computeXDir(zDir: Vec3): Vec3 {
  // Choose reference vector that isn't parallel to zDir
  const up: Vec3 = Math.abs(zDir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  return normalize(cross(up, zDir))
}

/**
 * Cross product of two vectors.
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

/**
 * Dot product of two vectors.
 */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * Subtract two vectors: a - b.
 */
export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/**
 * Length of a vector.
 */
export function length(v: Vec3): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
}

/**
 * Normalize a vector to unit length.
 */
export function normalize(v: Vec3): Vec3 {
  const len = length(v)
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [1, 0, 0]
}

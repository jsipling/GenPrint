/**
 * Geometry assertion helpers for manifold tests
 */
import type { Manifold, Mesh } from 'manifold-3d'
import { expect } from 'vitest'

/**
 * Geometry fingerprint for snapshot testing
 * Compact representation that catches geometry changes
 */
export interface GeometryFingerprint {
  vertexCount: number
  triangleCount: number
  volume: number
  surfaceArea: number
  boundingBox: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

/**
 * Get a compact fingerprint of a manifold's geometry
 * Use with toMatchSnapshot() for regression testing
 */
export function getGeometryFingerprint(manifold: Manifold): GeometryFingerprint {
  const mesh: Mesh = manifold.getMesh()
  const bbox = manifold.boundingBox()

  return {
    vertexCount: mesh.numVert,
    triangleCount: mesh.numTri,
    volume: roundTo(manifold.volume(), 4),
    surfaceArea: roundTo(manifold.surfaceArea(), 4),
    boundingBox: {
      min: [roundTo(bbox.min[0], 4), roundTo(bbox.min[1], 4), roundTo(bbox.min[2], 4)],
      max: [roundTo(bbox.max[0], 4), roundTo(bbox.max[1], 4), roundTo(bbox.max[2], 4)]
    }
  }
}

/**
 * Assert that a manifold is valid (watertight with positive volume)
 */
export function expectValid(manifold: Manifold): void {
  expect(manifold.volume()).toBeGreaterThan(0)
  // Genus 0 = watertight with no holes through the solid
  // Genus -1 typically indicates an error
  expect(manifold.genus()).toBeGreaterThanOrEqual(0)
}

/**
 * Assert volume is approximately equal to expected
 */
export function expectVolumeApprox(
  manifold: Manifold,
  expected: number,
  tolerance: number = 0.01
): void {
  const actual = manifold.volume()
  const diff = Math.abs(actual - expected) / expected
  expect(diff).toBeLessThanOrEqual(tolerance)
}

/**
 * Assert bounding box matches expected dimensions
 */
export function expectBoundingBox(
  manifold: Manifold,
  expected: { minX?: number; maxX?: number; minY?: number; maxY?: number; minZ?: number; maxZ?: number },
  tolerance: number = 0.01
): void {
  const bbox = manifold.boundingBox()

  if (expected.minX !== undefined) {
    expect(bbox.min[0]).toBeCloseTo(expected.minX, 2)
  }
  if (expected.maxX !== undefined) {
    expect(bbox.max[0]).toBeCloseTo(expected.maxX, 2)
  }
  if (expected.minY !== undefined) {
    expect(bbox.min[1]).toBeCloseTo(expected.minY, 2)
  }
  if (expected.maxY !== undefined) {
    expect(bbox.max[1]).toBeCloseTo(expected.maxY, 2)
  }
  if (expected.minZ !== undefined) {
    expect(bbox.min[2]).toBeCloseTo(expected.minZ, 2)
  }
  if (expected.maxZ !== undefined) {
    expect(bbox.max[2]).toBeCloseTo(expected.maxZ, 2)
  }
}

/**
 * Assert bounding box dimensions (width, height, depth)
 */
export function expectDimensions(
  manifold: Manifold,
  expected: { width?: number; height?: number; depth?: number },
  tolerance: number = 0.1
): void {
  const bbox = manifold.boundingBox()
  const width = bbox.max[0] - bbox.min[0]
  const depth = bbox.max[1] - bbox.min[1]
  const height = bbox.max[2] - bbox.min[2]

  if (expected.width !== undefined) {
    expect(width).toBeCloseTo(expected.width, 1)
  }
  if (expected.depth !== undefined) {
    expect(depth).toBeCloseTo(expected.depth, 1)
  }
  if (expected.height !== undefined) {
    expect(height).toBeCloseTo(expected.height, 1)
  }
}

/**
 * Round a number to specified decimal places
 */
function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
}

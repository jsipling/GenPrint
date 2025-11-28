/**
 * Tests for manifold worker functionality
 * Tests the mesh conversion logic and bounding box calculation
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold, Mesh } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../test/manifoldSetup'
import type { MeshData, BoundingBox, NamedPart } from '../generators/types'
import type { NamedManifoldResult } from './types'

/**
 * Recreate the manifoldToMeshData function for testing
 * This mirrors the logic in manifold.worker.ts
 */
function manifoldToMeshData(manifold: Manifold): MeshData {
  const mesh: Mesh = manifold.getMesh()

  const numVerts = mesh.numVert
  const numTris = mesh.numTri

  // Extract positions
  const positions = new Float32Array(numVerts * 3)
  for (let i = 0; i < numVerts; i++) {
    const pos = mesh.position(i)
    positions[i * 3] = pos[0] ?? 0
    positions[i * 3 + 1] = pos[1] ?? 0
    positions[i * 3 + 2] = pos[2] ?? 0
  }

  // Extract indices
  const indices = new Uint32Array(numTris * 3)
  for (let i = 0; i < numTris; i++) {
    const tri = mesh.verts(i)
    indices[i * 3] = tri[0] ?? 0
    indices[i * 3 + 1] = tri[1] ?? 0
    indices[i * 3 + 2] = tri[2] ?? 0
  }

  // Calculate normals
  const normals = new Float32Array(numVerts * 3)
  const counts = new Uint32Array(numVerts)

  for (let i = 0; i < numTris; i++) {
    const i0 = indices[i * 3]!
    const i1 = indices[i * 3 + 1]!
    const i2 = indices[i * 3 + 2]!

    const v0x = positions[i0 * 3]!, v0y = positions[i0 * 3 + 1]!, v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!, v1y = positions[i1 * 3 + 1]!, v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!, v2y = positions[i2 * 3 + 1]!, v2z = positions[i2 * 3 + 2]!

    const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z
    const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    for (const idx of [i0, i1, i2]) {
      normals[idx * 3]! += nx
      normals[idx * 3 + 1]! += ny
      normals[idx * 3 + 2]! += nz
      counts[idx]!++
    }
  }

  for (let i = 0; i < numVerts; i++) {
    if (counts[i]! > 0) {
      const nx = normals[i * 3]!
      const ny = normals[i * 3 + 1]!
      const nz = normals[i * 3 + 2]!
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) {
        normals[i * 3] = nx / len
        normals[i * 3 + 1] = ny / len
        normals[i * 3 + 2] = nz / len
      }
    }
  }

  return { positions, normals, indices }
}

describe('manifoldToMeshData', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('produces valid MeshData structure', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const meshData = manifoldToMeshData(cube)

    expect(meshData.positions).toBeInstanceOf(Float32Array)
    expect(meshData.normals).toBeInstanceOf(Float32Array)
    expect(meshData.indices).toBeInstanceOf(Uint32Array)

    cube.delete()
  })

  it('produces correct array lengths', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const mesh = cube.getMesh()
    const meshData = manifoldToMeshData(cube)

    // Positions: 3 floats per vertex
    expect(meshData.positions.length).toBe(mesh.numVert * 3)
    // Normals: 3 floats per vertex
    expect(meshData.normals.length).toBe(mesh.numVert * 3)
    // Indices: 3 per triangle
    expect(meshData.indices.length).toBe(mesh.numTri * 3)

    cube.delete()
  })

  it('produces normalized normals', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const meshData = manifoldToMeshData(cube)

    // Check that all normals are unit length
    const numVerts = meshData.positions.length / 3
    for (let i = 0; i < numVerts; i++) {
      const nx = meshData.normals[i * 3]!
      const ny = meshData.normals[i * 3 + 1]!
      const nz = meshData.normals[i * 3 + 2]!
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      expect(len).toBeCloseTo(1, 5)
    }

    cube.delete()
  })

  it('produces valid indices within vertex bounds', () => {
    const sphere = M.Manifold.sphere(10, 16)
    const meshData = manifoldToMeshData(sphere)

    const numVerts = meshData.positions.length / 3
    for (let i = 0; i < meshData.indices.length; i++) {
      expect(meshData.indices[i]).toBeLessThan(numVerts)
      expect(meshData.indices[i]).toBeGreaterThanOrEqual(0)
    }

    sphere.delete()
  })
})

describe('bounding box calculation', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('computes correct bounding box for cube centered at origin', () => {
    const cube = M.Manifold.cube([10, 10, 10], true) // centered
    const bbox = cube.boundingBox()

    // Centered cube of size 10 should have bounds -5 to 5 on each axis
    expect(bbox.min[0]).toBeCloseTo(-5, 5)
    expect(bbox.min[1]).toBeCloseTo(-5, 5)
    expect(bbox.min[2]).toBeCloseTo(-5, 5)
    expect(bbox.max[0]).toBeCloseTo(5, 5)
    expect(bbox.max[1]).toBeCloseTo(5, 5)
    expect(bbox.max[2]).toBeCloseTo(5, 5)

    cube.delete()
  })

  it('computes correct bounding box for cube at origin corner', () => {
    const cube = M.Manifold.cube([10, 20, 30], false) // corner at origin
    const bbox = cube.boundingBox()

    // Corner-aligned cube should have bounds 0 to size on each axis
    expect(bbox.min[0]).toBeCloseTo(0, 5)
    expect(bbox.min[1]).toBeCloseTo(0, 5)
    expect(bbox.min[2]).toBeCloseTo(0, 5)
    expect(bbox.max[0]).toBeCloseTo(10, 5)
    expect(bbox.max[1]).toBeCloseTo(20, 5)
    expect(bbox.max[2]).toBeCloseTo(30, 5)

    cube.delete()
  })

  it('computes correct bounding box for translated geometry', () => {
    const cube = M.Manifold.cube([10, 10, 10], false).translate([5, 10, 15])
    const bbox = cube.boundingBox()

    expect(bbox.min[0]).toBeCloseTo(5, 5)
    expect(bbox.min[1]).toBeCloseTo(10, 5)
    expect(bbox.min[2]).toBeCloseTo(15, 5)
    expect(bbox.max[0]).toBeCloseTo(15, 5)
    expect(bbox.max[1]).toBeCloseTo(20, 5)
    expect(bbox.max[2]).toBeCloseTo(25, 5)

    cube.delete()
  })

  it('returns BoundingBox-compatible structure', () => {
    const cube = M.Manifold.cube([10, 10, 10], false)
    const bbox = cube.boundingBox()

    // Verify structure matches our BoundingBox type
    expect(Array.isArray(bbox.min)).toBe(true)
    expect(Array.isArray(bbox.max)).toBe(true)
    expect(bbox.min.length).toBe(3)
    expect(bbox.max.length).toBe(3)
    expect(typeof bbox.min[0]).toBe('number')
    expect(typeof bbox.max[0]).toBe('number')

    cube.delete()
  })
})

/**
 * Type guard to check if builder result is an array of named manifold results.
 * This mirrors the logic in manifold.worker.ts
 */
function isNamedManifoldArray(result: unknown): result is NamedManifoldResult[] {
  if (!Array.isArray(result)) return false
  if (result.length === 0) return false
  // Check first element has required shape
  const first = result[0]
  return (
    typeof first === 'object' &&
    first !== null &&
    'name' in first &&
    typeof first.name === 'string' &&
    'manifold' in first &&
    typeof (first.manifold as Manifold).getMesh === 'function'
  )
}

/**
 * Compute combined bounding box from multiple bounding boxes.
 * This mirrors the logic in manifold.worker.ts
 */
function computeCombinedBoundingBox(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] }
  }
  const combined: BoundingBox = {
    min: [...boxes[0]!.min] as [number, number, number],
    max: [...boxes[0]!.max] as [number, number, number]
  }
  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i]!
    combined.min[0] = Math.min(combined.min[0], box.min[0])
    combined.min[1] = Math.min(combined.min[1], box.min[1])
    combined.min[2] = Math.min(combined.min[2], box.min[2])
    combined.max[0] = Math.max(combined.max[0], box.max[0])
    combined.max[1] = Math.max(combined.max[1], box.max[1])
    combined.max[2] = Math.max(combined.max[2], box.max[2])
  }
  return combined
}

/**
 * Process an array of named manifold results into named parts.
 * Converts each manifold to MeshData and extracts bounding boxes.
 * This mirrors the logic in manifold.worker.ts
 */
function processNamedManifolds(results: NamedManifoldResult[]): {
  parts: NamedPart[]
  boundingBox: BoundingBox
} {
  const parts: NamedPart[] = []
  const boundingBoxes: BoundingBox[] = []

  for (const result of results) {
    const bbox = result.manifold.boundingBox()
    const boundingBox: BoundingBox = {
      min: [bbox.min[0], bbox.min[1], bbox.min[2]],
      max: [bbox.max[0], bbox.max[1], bbox.max[2]]
    }
    boundingBoxes.push(boundingBox)

    const meshData = manifoldToMeshData(result.manifold)
    parts.push({
      name: result.name,
      meshData,
      boundingBox,
      dimensions: result.dimensions,
      params: result.params
    })

    // Clean up manifold WASM memory
    result.manifold.delete()
  }

  return {
    parts,
    boundingBox: computeCombinedBoundingBox(boundingBoxes)
  }
}

describe('isNamedManifoldArray type guard', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('returns true for valid array of named manifolds', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const result: NamedManifoldResult[] = [{ name: 'test-part', manifold: cube }]

    expect(isNamedManifoldArray(result)).toBe(true)

    cube.delete()
  })

  it('returns true for array with multiple named manifolds', () => {
    const cube1 = M.Manifold.cube([10, 10, 10], true)
    const cube2 = M.Manifold.cube([5, 5, 5], true)
    const result: NamedManifoldResult[] = [
      { name: 'part-a', manifold: cube1 },
      { name: 'part-b', manifold: cube2 }
    ]

    expect(isNamedManifoldArray(result)).toBe(true)

    cube1.delete()
    cube2.delete()
  })

  it('returns false for single Manifold (backwards compat)', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    expect(isNamedManifoldArray(cube)).toBe(false)
    cube.delete()
  })

  it('returns false for empty array', () => {
    expect(isNamedManifoldArray([])).toBe(false)
  })

  it('returns false for array without name property', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const result = [{ manifold: cube }]
    expect(isNamedManifoldArray(result)).toBe(false)
    cube.delete()
  })

  it('returns false for array without manifold property', () => {
    const result = [{ name: 'test' }]
    expect(isNamedManifoldArray(result)).toBe(false)
  })

  it('returns false for non-array values', () => {
    expect(isNamedManifoldArray(null)).toBe(false)
    expect(isNamedManifoldArray(undefined)).toBe(false)
    expect(isNamedManifoldArray({})).toBe(false)
    expect(isNamedManifoldArray('string')).toBe(false)
    expect(isNamedManifoldArray(123)).toBe(false)
  })
})

describe('processNamedManifolds', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('produces correct parts array from named manifolds', () => {
    const cube1 = M.Manifold.cube([10, 10, 10], true)
    const cube2 = M.Manifold.cube([5, 5, 5], false).translate([20, 0, 0])
    const input: NamedManifoldResult[] = [
      { name: 'cube-centered', manifold: cube1 },
      { name: 'cube-offset', manifold: cube2 }
    ]

    const result = processNamedManifolds(input)

    expect(result.parts).toHaveLength(2)
    expect(result.parts[0]!.name).toBe('cube-centered')
    expect(result.parts[1]!.name).toBe('cube-offset')
  })

  it('preserves optional dimensions and params', () => {
    const cube = M.Manifold.cube([10, 20, 30], false)
    const input: NamedManifoldResult[] = [
      {
        name: 'test-part',
        manifold: cube,
        dimensions: [{ label: 'Width', param: 'width' }],
        params: { width: 10 }
      }
    ]

    const result = processNamedManifolds(input)

    expect(result.parts[0]!.dimensions).toEqual([{ label: 'Width', param: 'width' }])
    expect(result.parts[0]!.params).toEqual({ width: 10 })
  })

  it('computes per-part bounding boxes correctly', () => {
    // Cube 1: centered at origin, size 10 -> bounds [-5, 5] on each axis
    const cube1 = M.Manifold.cube([10, 10, 10], true)
    // Cube 2: corner at [20, 0, 0], size 5 -> bounds [20, 25] on x, [0, 5] on y/z
    const cube2 = M.Manifold.cube([5, 5, 5], false).translate([20, 0, 0])

    const input: NamedManifoldResult[] = [
      { name: 'cube-centered', manifold: cube1 },
      { name: 'cube-offset', manifold: cube2 }
    ]

    const result = processNamedManifolds(input)

    // Check cube 1 bounding box
    expect(result.parts[0]!.boundingBox.min[0]).toBeCloseTo(-5, 5)
    expect(result.parts[0]!.boundingBox.max[0]).toBeCloseTo(5, 5)

    // Check cube 2 bounding box
    expect(result.parts[1]!.boundingBox.min[0]).toBeCloseTo(20, 5)
    expect(result.parts[1]!.boundingBox.max[0]).toBeCloseTo(25, 5)
  })

  it('computes combined bounding box correctly', () => {
    // Cube 1: centered at origin, size 10 -> bounds [-5, 5] on each axis
    const cube1 = M.Manifold.cube([10, 10, 10], true)
    // Cube 2: corner at [20, 0, 0], size 5 -> bounds [20, 25] on x, [0, 5] on y/z
    const cube2 = M.Manifold.cube([5, 5, 5], false).translate([20, 0, 0])

    const input: NamedManifoldResult[] = [
      { name: 'cube-centered', manifold: cube1 },
      { name: 'cube-offset', manifold: cube2 }
    ]

    const result = processNamedManifolds(input)

    // Combined: min from cube1, max from cube2 (on x), cube1 (on y/z)
    expect(result.boundingBox.min[0]).toBeCloseTo(-5, 5)
    expect(result.boundingBox.min[1]).toBeCloseTo(-5, 5)
    expect(result.boundingBox.min[2]).toBeCloseTo(-5, 5)
    expect(result.boundingBox.max[0]).toBeCloseTo(25, 5) // cube2 extends further on x
    expect(result.boundingBox.max[1]).toBeCloseTo(5, 5)
    expect(result.boundingBox.max[2]).toBeCloseTo(5, 5)
  })

  it('produces valid MeshData for each part', () => {
    const cube = M.Manifold.cube([10, 10, 10], true)
    const sphere = M.Manifold.sphere(5, 16).translate([30, 0, 0])

    const input: NamedManifoldResult[] = [
      { name: 'cube', manifold: cube },
      { name: 'sphere', manifold: sphere }
    ]

    const result = processNamedManifolds(input)

    // Verify each part has valid MeshData
    for (const part of result.parts) {
      expect(part.meshData.positions).toBeInstanceOf(Float32Array)
      expect(part.meshData.normals).toBeInstanceOf(Float32Array)
      expect(part.meshData.indices).toBeInstanceOf(Uint32Array)
      expect(part.meshData.positions.length).toBeGreaterThan(0)
    }
  })
})

describe('computeCombinedBoundingBox', () => {
  it('returns zero box for empty array', () => {
    const result = computeCombinedBoundingBox([])
    expect(result.min).toEqual([0, 0, 0])
    expect(result.max).toEqual([0, 0, 0])
  })

  it('returns same box for single input', () => {
    const input: BoundingBox[] = [{ min: [1, 2, 3], max: [4, 5, 6] }]
    const result = computeCombinedBoundingBox(input)
    expect(result.min).toEqual([1, 2, 3])
    expect(result.max).toEqual([4, 5, 6])
  })

  it('combines multiple boxes correctly', () => {
    const input: BoundingBox[] = [
      { min: [0, 0, 0], max: [10, 10, 10] },
      { min: [-5, 5, -3], max: [5, 15, 7] },
      { min: [20, -10, 0], max: [30, 5, 20] }
    ]
    const result = computeCombinedBoundingBox(input)

    // min should be the minimum of all mins
    expect(result.min[0]).toBe(-5)  // from box 2
    expect(result.min[1]).toBe(-10) // from box 3
    expect(result.min[2]).toBe(-3)  // from box 2

    // max should be the maximum of all maxs
    expect(result.max[0]).toBe(30) // from box 3
    expect(result.max[1]).toBe(15) // from box 2
    expect(result.max[2]).toBe(20) // from box 3
  })
})

/**
 * Tests for manifold worker functionality
 * Tests the mesh conversion logic and bounding box calculation
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold, Mesh } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../test/manifoldSetup'
import type { MeshData } from '../generators/types'

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

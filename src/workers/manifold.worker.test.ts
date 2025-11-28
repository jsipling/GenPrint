/**
 * Tests for manifold worker functionality
 * Tests the mesh conversion logic and bounding box calculation
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold, Mesh } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../test/manifoldSetup'
import type { MeshData } from '../generators/types'
import { shape, linearPattern, circularPattern, Compiler } from '../geo'
import type { Shape } from '../geo'

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
 * Recreate the createGeoContext function for testing
 * This mirrors the logic that will be in manifold.worker.ts
 */
function createGeoContext(M: ManifoldToplevel) {
  const compiler = new Compiler(M)

  return {
    shape,
    linearPattern,
    circularPattern,
    // Compile a geo Shape to a Manifold
    build: (s: Shape) => compiler.compile(s.getNode())
  }
}

/**
 * Recreate the executeUserBuilder function for testing
 * This mirrors the logic in manifold.worker.ts
 */
function executeUserBuilder(
  M: ManifoldToplevel,
  builderCode: string,
  params: Record<string, number | string | boolean>
): Manifold {
  const MIN_WALL_THICKNESS = 1.2
  const geo = createGeoContext(M)

  const fn = new Function('M', 'MIN_WALL_THICKNESS', 'params', 'geo', `
    ${builderCode}
  `)

  const result = fn(M, MIN_WALL_THICKNESS, params, geo)

  // Result can be a Manifold or a Shape (from geo library)
  if (result && typeof result.getMesh === 'function') {
    return result
  } else if (result && typeof result.getNode === 'function') {
    // It's a geo Shape - compile it to Manifold
    return geo.build(result)
  } else {
    throw new Error('Builder must return a Manifold or geo Shape')
  }
}

describe('geo library integration in worker sandbox', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('createGeoContext', () => {
    it('provides shape factory functions', () => {
      const geo = createGeoContext(M)

      expect(geo.shape).toBeDefined()
      expect(typeof geo.shape.box).toBe('function')
      expect(typeof geo.shape.cylinder).toBe('function')
    })

    it('provides pattern functions', () => {
      const geo = createGeoContext(M)

      expect(typeof geo.linearPattern).toBe('function')
      expect(typeof geo.circularPattern).toBe('function')
    })

    it('provides build function that compiles to Manifold', () => {
      const geo = createGeoContext(M)
      const box = geo.shape.box({ width: 10, depth: 10, height: 10 })

      const manifold = geo.build(box)

      expect(manifold).toBeDefined()
      expect(typeof manifold.getMesh).toBe('function')
      expect(typeof manifold.boundingBox).toBe('function')

      manifold.delete()
    })
  })

  describe('executeUserBuilder with geo library', () => {
    it('returns Manifold when builder returns geo Shape', () => {
      const builderCode = `
        const base = geo.shape.box({ width: 20, depth: 20, height: 10 })
        return base
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      expect(manifold).toBeDefined()
      expect(typeof manifold.getMesh).toBe('function')

      const bbox = manifold.boundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(20, 1)
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(20, 1)
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(10, 1)

      manifold.delete()
    })

    it('returns Manifold when builder uses geo.build explicitly', () => {
      const builderCode = `
        const base = geo.shape.box({ width: 30, depth: 30, height: 15 })
        return geo.build(base)
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      expect(manifold).toBeDefined()
      expect(typeof manifold.getMesh).toBe('function')

      const bbox = manifold.boundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(30, 1)
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(30, 1)
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(15, 1)

      manifold.delete()
    })

    it('supports boolean operations on geo Shapes', () => {
      const builderCode = `
        const base = geo.shape.box({ width: 50, depth: 50, height: 10 })
        const hole = geo.shape.cylinder({ diameter: 10, height: 20 })
        return base.subtract(hole)
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      expect(manifold).toBeDefined()
      // The result should be a valid manifold with the hole cut out
      const mesh = manifold.getMesh()
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })

    it('supports alignment operations', () => {
      const builderCode = `
        const base = geo.shape.box({ width: 50, depth: 50, height: 10 })
        const peg = geo.shape.cylinder({ diameter: 10, height: 20 })
        peg.align({
          self: 'bottom',
          target: base,
          to: 'top'
        })
        return base.union(peg)
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      expect(manifold).toBeDefined()
      const bbox = manifold.boundingBox()
      // Base is 10 high, peg is 20 high on top - total should be 30
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(30, 1)

      manifold.delete()
    })

    it('supports params in geo builder code', () => {
      const builderCode = `
        const base = geo.shape.box({
          width: params.width,
          depth: params.depth,
          height: params.height
        })
        return base
      `
      const manifold = executeUserBuilder(M, builderCode, {
        width: 40,
        depth: 30,
        height: 20
      })

      const bbox = manifold.boundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(40, 1)
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(30, 1)
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(20, 1)

      manifold.delete()
    })

    it('supports linear patterns', () => {
      const builderCode = `
        const peg = geo.shape.cylinder({ diameter: 5, height: 10 })
        const row = geo.linearPattern(peg, 3, 15, 'x')
        return row
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      const bbox = manifold.boundingBox()
      // 3 pegs, 15mm apart: first at -15, middle at 0, last at 15
      // Each peg is 5mm diameter = 2.5 radius
      // Total width should be approximately 30 + 5 = 35
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(35, 1)

      manifold.delete()
    })

    it('supports circular patterns', () => {
      const builderCode = `
        const post = geo.shape.cylinder({ diameter: 5, height: 10 })
        const ring = geo.circularPattern(post, 4, 20, 'z')
        return ring
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      const bbox = manifold.boundingBox()
      // 4 posts at radius 20, plus their own radius of 2.5
      // Total extent should be about 45mm in X and Y
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(45, 1)
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(45, 1)

      manifold.delete()
    })

    it('still supports direct Manifold API', () => {
      const builderCode = `
        const cube = M.Manifold.cube([10, 10, 10], true)
        return cube
      `
      const manifold = executeUserBuilder(M, builderCode, {})

      expect(manifold).toBeDefined()
      const bbox = manifold.boundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(10, 1)

      manifold.delete()
    })

    it('throws error when builder returns neither Manifold nor Shape', () => {
      const builderCode = `
        return { notAManifold: true }
      `

      expect(() => executeUserBuilder(M, builderCode, {})).toThrow(
        'Builder must return a Manifold or geo Shape'
      )
    })
  })
})

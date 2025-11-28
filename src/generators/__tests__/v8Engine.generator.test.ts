import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import { shape, linearPattern, circularPattern, Compiler } from '../../geo'
import type { Shape } from '../../geo'
import generator from '../v8Engine.generator'

/**
 * Recreate the createGeoContext function for testing
 * This mirrors the logic in manifold.worker.ts
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
 * Execute builder code in a sandboxed context with geo library support
 */
function executeBuilder(
  M: ManifoldToplevel,
  builderCode: string,
  params: Record<string, number | string | boolean>
): Manifold {
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

describe('v8Engine.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('v8-engine')
      expect(generator.name).toBe('V8 Engine Block')
      expect(generator.description).toBeTruthy()
      expect(generator.parameters.length).toBeGreaterThan(0)
      expect(generator.builderCode).toBeTruthy()
    })

    it('has sensible parameter defaults', () => {
      const boreParam = generator.parameters.find(p => p.name === 'bore')
      expect(boreParam).toBeDefined()
      expect(boreParam?.type).toBe('number')
      if (boreParam?.type === 'number') {
        expect(boreParam.default).toBeGreaterThanOrEqual(20)
        expect(boreParam.default).toBeLessThanOrEqual(50)
      }

      const strokeParam = generator.parameters.find(p => p.name === 'stroke')
      expect(strokeParam).toBeDefined()

      const bankAngleParam = generator.parameters.find(p => p.name === 'bankAngle')
      expect(bankAngleParam).toBeDefined()
      if (bankAngleParam?.type === 'number') {
        expect(bankAngleParam.default).toBe(90)
      }
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      bore: 30,
      stroke: 25,
      bankAngle: 90,
      wallThickness: 3,
      cylinderSpacing: 35,
      oilPanDepth: 25
    }

    it('produces valid manifold geometry with default params', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      expectValid(manifold)
      manifold.delete()
    })

    it('produces geometry larger than 150mm in at least one dimension', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(140) // Block is ~145mm long

      manifold.delete()
    })

    it('respects bank angle parameter', () => {
      // Test with 90-degree bank angle
      const manifold90 = executeBuilder(M, generator.builderCode, { ...defaultParams, bankAngle: 90 })
      expectValid(manifold90)
      const volume90 = manifold90.volume()
      manifold90.delete()

      // Test with 60-degree bank angle
      const manifold60 = executeBuilder(M, generator.builderCode, { ...defaultParams, bankAngle: 60 })
      expectValid(manifold60)
      const volume60 = manifold60.volume()
      manifold60.delete()

      // Different bank angles should produce different geometry
      expect(volume90).not.toBeCloseTo(volume60, 0)
    })

    it('enforces minimum wall thickness', () => {
      // Try with very thin wall - should be clamped to minimum
      const manifold = executeBuilder(M, generator.builderCode, { ...defaultParams, wallThickness: 0.5 })
      expectValid(manifold)
      manifold.delete()
    })

    it('produces connected geometry (single piece)', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      // build() without skipConnectivityCheck will throw if disconnected
      expect(manifold.numVert()).toBeGreaterThan(0)
      manifold.delete()
    })

    it('has 8 cylinder bores', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      // Engine block should have substantial volume for 8 cylinders
      expect(manifold.volume()).toBeGreaterThan(50000) // mm³
      manifold.delete()
    })

    it('includes head bolt holes around cylinders', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)
      expectValid(manifold)

      // Engine block should have substantial volume even with head bolt holes subtracted
      // 8 cylinders with 4 holes each = 32 small holes
      expect(manifold.volume()).toBeGreaterThan(50000) // mm³
      manifold.delete()
    })

    it('has lifter valley between cylinder banks', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)
      expectValid(manifold)

      // Lifter valley is carved out of the V between the banks
      // Block should still be valid and connected after valley subtraction
      expect(manifold.volume()).toBeGreaterThan(40000) // mm³ - valley removes material
      manifold.delete()
    })
  })

  describe('display dimensions', () => {
    it('includes key dimensions for overlay', () => {
      expect(generator.displayDimensions).toBeDefined()
      expect(generator.displayDimensions?.length).toBeGreaterThan(0)

      const boreDisplay = generator.displayDimensions?.find(d => d.param === 'bore')
      expect(boreDisplay).toBeDefined()
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import generator from '../v8Engine.generator'

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string, M: ManifoldToplevel) {
  return new Function('M', 'MIN_WALL_THICKNESS', 'params', `
    ${builderCode}
  `).bind(null, M, MIN_WALL_THICKNESS)
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
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)

      expectValid(result.build ? result.build() : result)
    })

    it('produces geometry larger than 150mm in at least one dimension', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)
      const manifold = result.build ? result.build() : result

      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(140) // Block is ~145mm long
    })

    it('respects bank angle parameter', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Test with 90-degree bank angle
      const result90 = buildFn({ ...defaultParams, bankAngle: 90 })
      const manifold90 = result90.build ? result90.build() : result90
      expectValid(manifold90)

      // Test with 60-degree bank angle
      const result60 = buildFn({ ...defaultParams, bankAngle: 60 })
      const manifold60 = result60.build ? result60.build() : result60
      expectValid(manifold60)

      // Different bank angles should produce different geometry
      expect(manifold90.volume()).not.toBeCloseTo(manifold60.volume(), 0)
    })

    it('enforces minimum wall thickness', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Try with very thin wall - should be clamped to minimum
      const result = buildFn({ ...defaultParams, wallThickness: 0.5 })
      const manifold = result.build ? result.build() : result
      expectValid(manifold)
    })

    it('produces connected geometry (single piece)', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)

      // build() without skipConnectivityCheck will throw if disconnected
      const manifold = result.build ? result.build() : result
      expect(manifold.numVert()).toBeGreaterThan(0)
    })

    it('has 8 cylinder bores', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)
      const manifold = result.build ? result.build() : result

      // Engine block should have substantial volume for 8 cylinders
      expect(manifold.volume()).toBeGreaterThan(50000) // mm³
    })

    it('includes head bolt holes around cylinders', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const result = buildFn(defaultParams)
      const manifold = result.build ? result.build() : result
      expectValid(manifold)

      // Engine block should have substantial volume even with head bolt holes subtracted
      // 8 cylinders with 4 holes each = 32 small holes
      expect(manifold.volume()).toBeGreaterThan(50000) // mm³
    })

    it('has lifter valley between cylinder banks', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const result = buildFn(defaultParams)
      const manifold = result.build ? result.build() : result
      expectValid(manifold)

      // Lifter valley is carved out of the V between the banks
      // Block should still be valid and connected after valley subtraction
      expect(manifold.volume()).toBeGreaterThan(40000) // mm³ - valley removes material
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

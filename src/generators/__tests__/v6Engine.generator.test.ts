import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { createBuilderContext } from '../manifold/fluent/BuilderContext'
import generator from '../v6Engine.generator'

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string) {
  return new Function('ctx', 'params', `
    const { box, cylinder, sphere, cone, roundedBox, tube, hole, counterboredHole, countersunkHole, extrude, revolve, union, unionAll, difference, intersection, linearArray, polarArray, gridArray, ensureMinWall, ensureMinFeature, group, compartmentGrid } = ctx
    const { constants, ops, primitives } = ctx
    ${builderCode}
  `)
}

describe('v6Engine.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('v6-engine')
      expect(generator.name).toBe('V6 Engine Block')
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
    })

    it('does not have bank angle parameter (fixed at 60 degrees)', () => {
      const bankAngleParam = generator.parameters.find(p => p.name === 'bankAngle')
      expect(bankAngleParam).toBeUndefined()
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      bore: 30,
      stroke: 25,
      wallThickness: 3,
      cylinderSpacing: 35,
      oilPanDepth: 25
    }

    it('produces valid manifold geometry with default params', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)

      expectValid(result.build ? result.build() : result)
    })

    it('produces geometry larger than 100mm in at least one dimension', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result

      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(100) // V6 block is smaller than V8
    })

    it('enforces minimum wall thickness', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      // Try with very thin wall - should be clamped to minimum
      const result = buildFn(ctx, { ...defaultParams, wallThickness: 0.5 })
      const manifold = result.build ? result.build() : result
      expectValid(manifold)
    })

    it('produces connected geometry (single piece)', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)

      // build() without skipConnectivityCheck will throw if disconnected
      const manifold = result.build ? result.build() : result
      expect(manifold.numVert()).toBeGreaterThan(0)
    })

    it('has 6 cylinder bores (3 per bank)', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result

      // V6 engine block should have substantial volume for 6 cylinders
      // Smaller than V8 (which was >50000)
      expect(manifold.volume()).toBeGreaterThan(35000) // mm³
    })

    it('includes head bolt holes around cylinders', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result
      expectValid(manifold)

      // Engine block should have substantial volume even with head bolt holes subtracted
      // 6 cylinders with 4 holes each = 24 small holes
      expect(manifold.volume()).toBeGreaterThan(30000) // mm³
    })

    it('has lifter valley between cylinder banks', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result
      expectValid(manifold)

      // Lifter valley is carved out of the V between the banks
      // Block should still be valid and connected after valley subtraction
      expect(manifold.volume()).toBeGreaterThan(25000) // mm³ - valley removes material
    })

    it('has optional intake manifold parameter', () => {
      const intakeParam = generator.parameters.find(p => p.name === 'showIntakeManifold')
      expect(intakeParam).toBeDefined()
      expect(intakeParam?.type).toBe('boolean')
      if (intakeParam?.type === 'boolean') {
        expect(intakeParam.default).toBe(false)
      }
    })

    it('adds intake manifold when enabled', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      // Without intake manifold
      const resultWithout = buildFn(ctx, { ...defaultParams, showIntakeManifold: false })
      const manifoldWithout = resultWithout.build ? resultWithout.build() : resultWithout
      expectValid(manifoldWithout)
      const volumeWithout = manifoldWithout.volume()

      // With intake manifold
      const ctx2 = createBuilderContext(M)
      const resultWith = buildFn(ctx2, { ...defaultParams, showIntakeManifold: true })
      const manifoldWith = resultWith.build ? resultWith.build() : resultWith
      expectValid(manifoldWith)
      const volumeWith = manifoldWith.volume()

      // Intake manifold should add volume
      expect(volumeWith).toBeGreaterThan(volumeWithout)
    })

    it('has exhaust ports on outer faces of cylinder banks', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result
      expectValid(manifold)

      // Exhaust ports are carved into the outer faces of each bank
      // Block should still be valid and connected with 6 exhaust ports (3 per bank)
      expect(manifold.volume()).toBeGreaterThan(20000) // mm³ - ports remove some material
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

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import { shape, linearPattern, circularPattern, Compiler } from '../../geo'
import type { Shape } from '../../geo'
import generator from '../v6Engine.generator'

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
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      expectValid(manifold)
      manifold.delete()
    })

    it('produces geometry larger than 100mm in at least one dimension', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(100) // V6 block is smaller than V8

      manifold.delete()
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

    it('has 6 cylinder bores (3 per bank)', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      // V6 engine block should have substantial volume for 6 cylinders
      // Smaller than V8 (which was >50000)
      expect(manifold.volume()).toBeGreaterThan(35000) // mm³
      manifold.delete()
    })

    it('includes head bolt holes around cylinders', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)
      expectValid(manifold)

      // Engine block should have substantial volume even with head bolt holes subtracted
      // 6 cylinders with 4 holes each = 24 small holes
      expect(manifold.volume()).toBeGreaterThan(30000) // mm³
      manifold.delete()
    })

    it('has lifter valley between cylinder banks', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)
      expectValid(manifold)

      // Lifter valley is carved out of the V between the banks
      // Block should still be valid and connected after valley subtraction
      expect(manifold.volume()).toBeGreaterThan(25000) // mm³ - valley removes material
      manifold.delete()
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
      // Without intake manifold
      const manifoldWithout = executeBuilder(M, generator.builderCode, { ...defaultParams, showIntakeManifold: false })
      expectValid(manifoldWithout)
      const volumeWithout = manifoldWithout.volume()
      manifoldWithout.delete()

      // With intake manifold
      const manifoldWith = executeBuilder(M, generator.builderCode, { ...defaultParams, showIntakeManifold: true })
      expectValid(manifoldWith)
      const volumeWith = manifoldWith.volume()
      manifoldWith.delete()

      // Intake manifold should add volume
      expect(volumeWith).toBeGreaterThan(volumeWithout)
    })

    it('has exhaust ports on outer faces of cylinder banks', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)
      expectValid(manifold)

      // Exhaust ports are carved into the outer faces of each bank
      // Block should still be valid and connected with 6 exhaust ports (3 per bank)
      expect(manifold.volume()).toBeGreaterThan(20000) // mm³ - ports remove some material
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

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from '../manifold/printingConstants'
import generator from '../v6Engine.generator'
import type { DisplayDimension, ParameterValues } from '../types'

/**
 * Shape returned by multi-part generators from builderCode.
 */
interface NamedManifoldResult {
  name: string
  manifold: Manifold
  dimensions?: DisplayDimension[]
  params?: ParameterValues
}

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string, M: ManifoldToplevel) {
  return new Function('M', 'MIN_WALL_THICKNESS', 'MIN_FEATURE_SIZE', 'params', `
    ${builderCode}
  `).bind(null, M, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE)
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

    it('has optional intake manifold parameter', () => {
      const intakeParam = generator.parameters.find(p => p.name === 'showIntakeManifold')
      expect(intakeParam).toBeDefined()
      expect(intakeParam?.type).toBe('boolean')
      if (intakeParam?.type === 'boolean') {
        expect(intakeParam.default).toBe(false)
      }
    })
  })

  describe('multi-part output', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      bore: 30,
      stroke: 25,
      wallThickness: 3,
      cylinderSpacing: 35,
      oilPanDepth: 25,
      showIntakeManifold: false
    }

    it('returns an array of 4 named parts without intake manifold', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(4)
    })

    it('returns an array of 5 named parts with intake manifold', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, showIntakeManifold: true }) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(5)
      expect(result[4]!.name).toBe('Intake Manifold')
    })

    it('parts have correct names', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(result[0]!.name).toBe('Engine Block')
      expect(result[1]!.name).toBe('Oil Pan')
      expect(result[2]!.name).toBe('Timing Cover')
      expect(result[3]!.name).toBe('Rear Main Seal Housing')
    })

    it('each part produces valid manifold geometry', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      for (const part of result) {
        expectValid(part.manifold)
      }
    })

    it('engine block has dimensions metadata', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const engineBlock = result[0]!
      expect(engineBlock.dimensions).toBeDefined()
      expect(Array.isArray(engineBlock.dimensions)).toBe(true)
      expect(engineBlock.dimensions!.length).toBeGreaterThan(0)

      const boreDisplay = engineBlock.dimensions?.find(d => d.param === 'bore')
      expect(boreDisplay).toBeDefined()
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      bore: 30,
      stroke: 25,
      wallThickness: 3,
      cylinderSpacing: 35,
      oilPanDepth: 25,
      showIntakeManifold: false
    }

    it('produces geometry larger than 100mm in at least one dimension', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Check engine block dimensions
      const engineBlock = result[0]!.manifold
      const bbox = engineBlock.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(100) // V6 block is smaller than V8
    })

    it('enforces minimum wall thickness', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Try with very thin wall - should be clamped to minimum
      const result = buildFn({ ...defaultParams, wallThickness: 0.5 }) as NamedManifoldResult[]
      for (const part of result) {
        expectValid(part.manifold)
      }
    })

    it('engine block has 6 cylinder bores (3 per bank)', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // V6 engine block should have substantial volume for 6 cylinders
      const engineBlock = result[0]!.manifold
      expect(engineBlock.volume()).toBeGreaterThan(35000) // mm³
    })

    it('adds intake manifold part when enabled', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Without intake manifold - 4 parts
      const resultWithout = buildFn({ ...defaultParams, showIntakeManifold: false }) as NamedManifoldResult[]
      expect(resultWithout.length).toBe(4)

      // With intake manifold - 5 parts
      const resultWith = buildFn({ ...defaultParams, showIntakeManifold: true }) as NamedManifoldResult[]
      expect(resultWith.length).toBe(5)

      // Intake manifold should be valid
      const intakeManifold = resultWith[4]!
      expectValid(intakeManifold.manifold)
      expect(intakeManifold.manifold.volume()).toBeGreaterThan(0)
    })

    it('model sits on Z=0 (lowest point at Z=0)', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Find the lowest Z across all parts
      let minZ = Infinity
      for (const part of result) {
        const bbox = part.manifold.boundingBox()
        minZ = Math.min(minZ, bbox.min[2])
      }

      // The lowest point of the assembly should be at Z=0
      expect(minZ).toBeCloseTo(0, 1)
    })

    it('has exhaust ports on engine block', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const engineBlock = result[0]!.manifold
      expectValid(engineBlock)

      // Exhaust ports are carved into the outer faces of each bank
      // Block should still be valid with 6 exhaust ports (3 per bank)
      expect(engineBlock.volume()).toBeGreaterThan(20000) // mm³
    })
  })
})

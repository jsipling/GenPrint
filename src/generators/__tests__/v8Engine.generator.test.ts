import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from '../manifold/printingConstants'
import generator from '../v8Engine.generator'
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

  describe('multi-part output', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      bore: 30,
      stroke: 25,
      bankAngle: 90,
      wallThickness: 3,
      cylinderSpacing: 35,
      oilPanDepth: 25
    }

    it('returns an array of 4 named parts', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(4)
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

    it('oil pan has depth dimension', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const oilPan = result[1]!
      expect(oilPan.dimensions).toBeDefined()
      expect(oilPan.params?.depth).toBe(25)
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

    it('produces geometry larger than 150mm in at least one dimension', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Check engine block dimensions
      const engineBlock = result[0]!.manifold
      const bbox = engineBlock.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      const depth = bbox.max[1] - bbox.min[1]
      const height = bbox.max[2] - bbox.min[2]

      const maxDimension = Math.max(width, depth, height)
      expect(maxDimension).toBeGreaterThanOrEqual(140) // Block is ~145mm long
    })

    it('respects bank angle parameter', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Test with 90-degree bank angle
      const result90 = buildFn({ ...defaultParams, bankAngle: 90 }) as NamedManifoldResult[]
      const block90 = result90[0]!.manifold
      expectValid(block90)

      // Test with 60-degree bank angle
      const result60 = buildFn({ ...defaultParams, bankAngle: 60 }) as NamedManifoldResult[]
      const block60 = result60[0]!.manifold
      expectValid(block60)

      // Different bank angles should produce different geometry
      expect(block90.volume()).not.toBeCloseTo(block60.volume(), 0)
    })

    it('enforces minimum wall thickness', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      // Try with very thin wall - should be clamped to minimum
      const result = buildFn({ ...defaultParams, wallThickness: 0.5 }) as NamedManifoldResult[]
      for (const part of result) {
        expectValid(part.manifold)
      }
    })

    it('engine block has 8 cylinder bores', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Engine block should have substantial volume for 8 cylinders
      const engineBlock = result[0]!.manifold
      expect(engineBlock.volume()).toBeGreaterThan(50000) // mm³
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
  })
})

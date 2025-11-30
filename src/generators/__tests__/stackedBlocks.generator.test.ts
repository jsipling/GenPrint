import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from '../manifold/printingConstants'
import generator from '../stackedBlocks.generator'
import type { DisplayDimension, ParameterValues } from '../types'

/**
 * Shape returned by multi-part generators from builderCode.
 * Mirrors NamedManifoldResult from worker/types.ts
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

describe('stackedBlocks.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('stacked-blocks')
      expect(generator.name).toBe('Stacked Blocks')
      expect(generator.description).toBeTruthy()
      expect(generator.parameters.length).toBeGreaterThan(0)
      expect(generator.builderCode).toBeTruthy()
    })

    it('has sensible parameter defaults', () => {
      const baseSizeParam = generator.parameters.find(p => p.name === 'baseSize')
      expect(baseSizeParam).toBeDefined()
      expect(baseSizeParam?.type).toBe('number')
      if (baseSizeParam?.type === 'number') {
        expect(baseSizeParam.default).toBeGreaterThanOrEqual(20)
        expect(baseSizeParam.default).toBeLessThanOrEqual(100)
      }

      const blockHeightParam = generator.parameters.find(p => p.name === 'blockHeight')
      expect(blockHeightParam).toBeDefined()

      const shrinkFactorParam = generator.parameters.find(p => p.name === 'shrinkFactor')
      expect(shrinkFactorParam).toBeDefined()
      if (shrinkFactorParam?.type === 'number') {
        expect(shrinkFactorParam.default).toBeGreaterThan(0)
        expect(shrinkFactorParam.default).toBeLessThan(1)
      }
    })
  })

  describe('multi-part output', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      baseSize: 50,
      blockHeight: 20,
      shrinkFactor: 0.7
    }

    it('returns an array of 3 named parts', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3)
    })

    it('each part has required name and manifold properties', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      for (const part of result) {
        expect(typeof part.name).toBe('string')
        expect(part.name.length).toBeGreaterThan(0)
        expect(part.manifold).toBeDefined()
        expect(typeof part.manifold.getMesh).toBe('function')
      }
    })

    it('parts have correct names in order', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(result[0]!.name).toBe('Base Block')
      expect(result[1]!.name).toBe('Middle Block')
      expect(result[2]!.name).toBe('Top Block')
    })

    it('each part produces valid manifold geometry', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      for (const part of result) {
        expectValid(part.manifold)
      }
    })

    it('parts have dimensions metadata', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      for (const part of result) {
        expect(part.dimensions).toBeDefined()
        expect(Array.isArray(part.dimensions)).toBe(true)
        expect(part.dimensions!.length).toBeGreaterThan(0)
      }
    })

    it('parts have params for dimension formatting', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      for (const part of result) {
        expect(part.params).toBeDefined()
        expect(typeof part.params).toBe('object')
      }
    })
  })

  describe('geometry stacking', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      baseSize: 50,
      blockHeight: 20,
      shrinkFactor: 0.7
    }

    it('blocks stack with increasing Z positions', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const baseBbox = result[0]!.manifold.boundingBox()
      const middleBbox = result[1]!.manifold.boundingBox()
      const topBbox = result[2]!.manifold.boundingBox()

      // Base block should start at Z=0
      expect(baseBbox.min[2]).toBeCloseTo(0, 1)

      // Middle block should be above base
      expect(middleBbox.min[2]).toBeGreaterThan(baseBbox.min[2])
      expect(middleBbox.min[2]).toBeCloseTo(baseBbox.max[2], 1)

      // Top block should be above middle
      expect(topBbox.min[2]).toBeGreaterThan(middleBbox.min[2])
      expect(topBbox.min[2]).toBeCloseTo(middleBbox.max[2], 1)
    })

    it('blocks shrink by the shrink factor', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]
      const shrinkFactor = defaultParams.shrinkFactor as number

      const baseBbox = result[0]!.manifold.boundingBox()
      const middleBbox = result[1]!.manifold.boundingBox()
      const topBbox = result[2]!.manifold.boundingBox()

      const baseWidth = baseBbox.max[0] - baseBbox.min[0]
      const middleWidth = middleBbox.max[0] - middleBbox.min[0]
      const topWidth = topBbox.max[0] - topBbox.min[0]

      // Middle should be shrinkFactor * base
      expect(middleWidth).toBeCloseTo(baseWidth * shrinkFactor, 1)

      // Top should be shrinkFactor * middle
      expect(topWidth).toBeCloseTo(middleWidth * shrinkFactor, 1)
    })

    it('all blocks have the same height', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]
      const blockHeight = defaultParams.blockHeight as number

      for (const part of result) {
        const bbox = part.manifold.boundingBox()
        const height = bbox.max[2] - bbox.min[2]
        expect(height).toBeCloseTo(blockHeight, 1)
      }
    })

    it('total height equals 3 * blockHeight', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]
      const blockHeight = defaultParams.blockHeight as number

      const topBbox = result[2]!.manifold.boundingBox()
      expect(topBbox.max[2]).toBeCloseTo(blockHeight * 3, 1)
    })
  })

  describe('parameter variations', () => {
    it('respects baseSize parameter', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const small = buildFn({ baseSize: 30, blockHeight: 20, shrinkFactor: 0.7 }) as NamedManifoldResult[]
      const large = buildFn({ baseSize: 80, blockHeight: 20, shrinkFactor: 0.7 }) as NamedManifoldResult[]

      const smallBaseBbox = small[0]!.manifold.boundingBox()
      const largeBaseBbox = large[0]!.manifold.boundingBox()

      const smallWidth = smallBaseBbox.max[0] - smallBaseBbox.min[0]
      const largeWidth = largeBaseBbox.max[0] - largeBaseBbox.min[0]

      expect(smallWidth).toBeCloseTo(30, 1)
      expect(largeWidth).toBeCloseTo(80, 1)
      expect(largeWidth).toBeGreaterThan(smallWidth)
    })

    it('respects blockHeight parameter', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const short = buildFn({ baseSize: 50, blockHeight: 10, shrinkFactor: 0.7 }) as NamedManifoldResult[]
      const tall = buildFn({ baseSize: 50, blockHeight: 40, shrinkFactor: 0.7 }) as NamedManifoldResult[]

      const shortTopZ = short[2]!.manifold.boundingBox().max[2]
      const tallTopZ = tall[2]!.manifold.boundingBox().max[2]

      expect(shortTopZ).toBeCloseTo(30, 1) // 3 * 10
      expect(tallTopZ).toBeCloseTo(120, 1) // 3 * 40
    })

    it('respects shrinkFactor parameter', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const gradual = buildFn({ baseSize: 50, blockHeight: 20, shrinkFactor: 0.9 }) as NamedManifoldResult[]
      const steep = buildFn({ baseSize: 50, blockHeight: 20, shrinkFactor: 0.5 }) as NamedManifoldResult[]

      const gradualTopBbox = gradual[2]!.manifold.boundingBox()
      const steepTopBbox = steep[2]!.manifold.boundingBox()

      const gradualTopWidth = gradualTopBbox.max[0] - gradualTopBbox.min[0]
      const steepTopWidth = steepTopBbox.max[0] - steepTopBbox.min[0]

      // Gradual shrink should produce larger top block
      expect(gradualTopWidth).toBeGreaterThan(steepTopWidth)
      // 50 * 0.9 * 0.9 = 40.5
      expect(gradualTopWidth).toBeCloseTo(40.5, 1)
      // 50 * 0.5 * 0.5 = 12.5
      expect(steepTopWidth).toBeCloseTo(12.5, 1)
    })
  })
})

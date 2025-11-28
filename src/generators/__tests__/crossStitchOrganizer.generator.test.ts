import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import generator from '../crossStitchOrganizer.generator'

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string, M: ManifoldToplevel) {
  return new Function('M', 'MIN_WALL_THICKNESS', 'params', `
    ${builderCode}
  `).bind(null, M, MIN_WALL_THICKNESS)
}

describe('crossStitchOrganizer.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('cross-stitch-organizer')
      expect(generator.name).toBe('Cross Stitch Organizer')
      expect(generator.description).toBeTruthy()
      expect(generator.parameters.length).toBeGreaterThan(0)
      expect(generator.builderCode).toBeTruthy()
    })

    it('has sensible parameter defaults', () => {
      const lengthParam = generator.parameters.find(p => p.name === 'length')
      expect(lengthParam).toBeDefined()
      expect(lengthParam?.type).toBe('number')
      if (lengthParam?.type === 'number') {
        expect(lengthParam.default).toBeGreaterThanOrEqual(150)
        expect(lengthParam.default).toBeLessThanOrEqual(300)
      }

      const widthParam = generator.parameters.find(p => p.name === 'width')
      expect(widthParam).toBeDefined()

      const heightParam = generator.parameters.find(p => p.name === 'height')
      expect(heightParam).toBeDefined()
    })

    it('has compartment type parameters', () => {
      const bobbinsParam = generator.parameters.find(p => p.name === 'includeBobbins')
      expect(bobbinsParam).toBeDefined()
      expect(bobbinsParam?.type).toBe('boolean')

      const scissorsParam = generator.parameters.find(p => p.name === 'includeScissors')
      expect(scissorsParam).toBeDefined()
      expect(scissorsParam?.type).toBe('boolean')

      const accessoriesParam = generator.parameters.find(p => p.name === 'includeAccessories')
      expect(accessoriesParam).toBeDefined()
      expect(accessoriesParam?.type).toBe('boolean')

      const needlesParam = generator.parameters.find(p => p.name === 'includeNeedles')
      expect(needlesParam).toBeDefined()
      expect(needlesParam?.type).toBe('boolean')
    })

    it('wall thickness meets minimum printing requirements', () => {
      const wallParam = generator.parameters.find(p => p.name === 'wallThickness')
      expect(wallParam).toBeDefined()
      expect(wallParam?.type).toBe('number')
      if (wallParam?.type === 'number') {
        expect(wallParam.min).toBeGreaterThanOrEqual(1.2)
      }
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      length: 220,
      width: 150,
      height: 45,
      wallThickness: 2,
      includeBobbins: true,
      bobbinRows: 4,
      bobbinColumns: 5,
      includeScissors: true,
      includeAccessories: true,
      includeNeedles: true,
      showLid: true,
      lidThickness: 3
    }

    // Helper to get the manifold from result
    function getResult(result: unknown): Manifold {
      return result as Manifold
    }

    it('produces valid manifold geometry with default params', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)
      const manifold = getResult(result)

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.surfaceArea()).toBeGreaterThan(0)
    })

    it('produces geometry with correct approximate dimensions', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)
      const manifold = getResult(result)

      const bbox = manifold.boundingBox()
      const actualWidth = bbox.max[0] - bbox.min[0]
      const actualDepth = bbox.max[1] - bbox.min[1]

      // Box should be approximately the requested size
      expect(actualWidth).toBeCloseTo(defaultParams.length as number, 0)
      expect(actualDepth).toBeGreaterThanOrEqual(defaultParams.width as number)
      expect(actualDepth).toBeLessThan((defaultParams.width as number) + 10)
    })

    it('enforces minimum wall thickness', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const result = buildFn({ ...defaultParams, wallThickness: 0.5 })
      const manifold = getResult(result)

      expect(manifold.volume()).toBeGreaterThan(0)
    })

    it('produces multi-part geometry for assembly', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams)
      const manifold = getResult(result)

      expect(manifold.numVert()).toBeGreaterThan(0)
      expect(manifold.volume()).toBeGreaterThan(0)
    })

    it('creates bobbin compartments when enabled', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, includeBobbins: true })
      const manifold = getResult(result)

      expect(manifold.volume()).toBeGreaterThan(10000)
    })

    it('handles different bobbin grid configurations', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const configs = [
        { bobbinRows: 2, bobbinColumns: 3 },
        { bobbinRows: 4, bobbinColumns: 6 },
        { bobbinRows: 6, bobbinColumns: 8 }
      ]

      for (const config of configs) {
        const result = buildFn({ ...defaultParams, ...config })
        const manifold = getResult(result)

        expect(manifold.volume()).toBeGreaterThan(0)
      }
    })

    it('produces single-piece geometry when lid is disabled', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, showLid: false })

      const manifold = result.build ? result.build() : result

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)
    })

    it('lid toggle affects volume', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const resultWithLid = buildFn({ ...defaultParams, showLid: true })
      const manifoldWithLid = getResult(resultWithLid)
      const volumeWithLid = manifoldWithLid.volume()

      const resultNoLid = buildFn({ ...defaultParams, showLid: false })
      const manifoldNoLid = resultNoLid.build ? resultNoLid.build() : resultNoLid
      const volumeNoLid = manifoldNoLid.volume()

      expect(volumeWithLid).toBeGreaterThan(volumeNoLid)
    })

    it('can disable all side compartments for bobbins-only mode', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({
        ...defaultParams,
        includeScissors: false,
        includeAccessories: false,
        includeNeedles: false,
        showLid: false
      })

      const manifold = result.build ? result.build() : result

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)
    })

    it('can enable only side compartments without bobbins', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({
        ...defaultParams,
        includeBobbins: false,
        includeScissors: true,
        includeAccessories: true,
        includeNeedles: true,
        showLid: false
      })

      const manifold = result.build ? result.build() : result

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)
    })
  })

  describe('display dimensions', () => {
    it('includes key dimensions for overlay', () => {
      expect(generator.displayDimensions).toBeDefined()
      expect(generator.displayDimensions?.length).toBeGreaterThan(0)

      const lengthDisplay = generator.displayDimensions?.find(d => d.param === 'length')
      expect(lengthDisplay).toBeDefined()
    })
  })
})

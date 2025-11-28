import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import { shape, linearPattern, circularPattern, Compiler } from '../../geo'
import type { Shape } from '../../geo'
import generator from '../crossStitchOrganizer.generator'

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

    it('produces valid manifold geometry with default params', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.surfaceArea()).toBeGreaterThan(0)

      manifold.delete()
    })

    it('produces geometry with correct approximate dimensions', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      const bbox = manifold.boundingBox()
      const actualWidth = bbox.max[0] - bbox.min[0]
      const actualDepth = bbox.max[1] - bbox.min[1]

      // Box should be approximately the requested size
      expect(actualWidth).toBeCloseTo(defaultParams.length as number, 0)
      expect(actualDepth).toBeGreaterThanOrEqual(defaultParams.width as number)
      expect(actualDepth).toBeLessThan((defaultParams.width as number) + 10)

      manifold.delete()
    })

    it('enforces minimum wall thickness', () => {
      const manifold = executeBuilder(M, generator.builderCode, { ...defaultParams, wallThickness: 0.5 })

      expect(manifold.volume()).toBeGreaterThan(0)

      manifold.delete()
    })

    it('produces multi-part geometry for assembly', () => {
      const manifold = executeBuilder(M, generator.builderCode, defaultParams)

      expect(manifold.numVert()).toBeGreaterThan(0)
      expect(manifold.volume()).toBeGreaterThan(0)

      manifold.delete()
    })

    it('creates bobbin compartments when enabled', () => {
      const manifold = executeBuilder(M, generator.builderCode, { ...defaultParams, includeBobbins: true })

      expect(manifold.volume()).toBeGreaterThan(10000)

      manifold.delete()
    })

    it('handles different bobbin grid configurations', () => {
      const configs = [
        { bobbinRows: 2, bobbinColumns: 3 },
        { bobbinRows: 4, bobbinColumns: 6 },
        { bobbinRows: 6, bobbinColumns: 8 }
      ]

      for (const config of configs) {
        const manifold = executeBuilder(M, generator.builderCode, { ...defaultParams, ...config })

        expect(manifold.volume()).toBeGreaterThan(0)

        manifold.delete()
      }
    })

    it('produces single-piece geometry when lid is disabled', () => {
      const manifold = executeBuilder(M, generator.builderCode, { ...defaultParams, showLid: false })

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)

      manifold.delete()
    })

    it('lid toggle affects volume', () => {
      const manifoldWithLid = executeBuilder(M, generator.builderCode, { ...defaultParams, showLid: true })
      const volumeWithLid = manifoldWithLid.volume()
      manifoldWithLid.delete()

      const manifoldNoLid = executeBuilder(M, generator.builderCode, { ...defaultParams, showLid: false })
      const volumeNoLid = manifoldNoLid.volume()
      manifoldNoLid.delete()

      expect(volumeWithLid).toBeGreaterThan(volumeNoLid)
    })

    it('can disable all side compartments for bobbins-only mode', () => {
      const manifold = executeBuilder(M, generator.builderCode, {
        ...defaultParams,
        includeScissors: false,
        includeAccessories: false,
        includeNeedles: false,
        showLid: false
      })

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)

      manifold.delete()
    })

    it('can enable only side compartments without bobbins', () => {
      const manifold = executeBuilder(M, generator.builderCode, {
        ...defaultParams,
        includeBobbins: false,
        includeScissors: true,
        includeAccessories: true,
        includeNeedles: true,
        showLid: false
      })

      expect(manifold.volume()).toBeGreaterThan(0)
      expect(manifold.genus()).toBeGreaterThanOrEqual(0)

      manifold.delete()
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

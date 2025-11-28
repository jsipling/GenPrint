import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { checkSmallFeatures } from '../checks/smallFeatures'
import { MIN_SMALL_FEATURE } from '../../generators/manifold/printingConstants'

describe('smallFeatures check', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('normal size geometry (no issues)', () => {
    it('returns empty array for solid cube with sufficient size', () => {
      // 10mm cube - well above minimum feature size
      const cube = M.Manifold.cube([10, 10, 10], true)
      const result = checkSmallFeatures(cube, MIN_SMALL_FEATURE)
      cube.delete()

      expect(result).toEqual([])
    })

    it('returns empty array for feature exactly at minimum size', () => {
      const feature = M.Manifold.cube([MIN_SMALL_FEATURE, 10, 10], false)
      const result = checkSmallFeatures(feature, MIN_SMALL_FEATURE)
      feature.delete()

      expect(result).toEqual([])
    })

    it('returns empty array for cylinder with adequate radius', () => {
      // Cylinder with 5mm radius
      const cylinder = M.Manifold.cylinder(20, 5, 5, 32)
      const result = checkSmallFeatures(cylinder, MIN_SMALL_FEATURE)
      cylinder.delete()

      expect(result).toEqual([])
    })
  })

  describe('small feature geometry (issues detected)', () => {
    it('detects small cube below minimum', () => {
      // 1mm cube - all dimensions below 1.5mm minimum
      const smallCube = M.Manifold.cube([1, 1, 1], true)
      const result = checkSmallFeatures(smallCube, MIN_SMALL_FEATURE)
      smallCube.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.size).toBeCloseTo(1, 1)
      expect(result[0]!.required).toBe(MIN_SMALL_FEATURE)
    })

    it('detects thin feature on X axis', () => {
      // Very thin feature in X direction
      const thinFeature = M.Manifold.cube([0.5, 10, 10], false)
      const result = checkSmallFeatures(thinFeature, MIN_SMALL_FEATURE)
      thinFeature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.size).toBeCloseTo(0.5, 1)
    })

    it('detects thin feature on Y axis', () => {
      const thinFeature = M.Manifold.cube([10, 0.8, 10], false)
      const result = checkSmallFeatures(thinFeature, MIN_SMALL_FEATURE)
      thinFeature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.size).toBeCloseTo(0.8, 1)
    })

    it('detects thin feature on Z axis', () => {
      const thinFeature = M.Manifold.cube([10, 10, 0.5], false)
      const result = checkSmallFeatures(thinFeature, MIN_SMALL_FEATURE)
      thinFeature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.size).toBeCloseTo(0.5, 1)
    })

    it('provides bounding box for small features', () => {
      const smallFeature = M.Manifold.cube([1, 1, 1], false).translate(10, 0, 0)
      const result = checkSmallFeatures(smallFeature, MIN_SMALL_FEATURE)
      smallFeature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.bbox).toBeDefined()
      expect(result[0]!.bbox.min[0]).toBeCloseTo(10, 1)
    })
  })

  describe('axis alignment detection', () => {
    it('identifies X-aligned small feature', () => {
      const feature = M.Manifold.cube([0.5, 20, 20], false)
      const result = checkSmallFeatures(feature, MIN_SMALL_FEATURE)
      feature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('X')
    })

    it('identifies Y-aligned small feature', () => {
      const feature = M.Manifold.cube([20, 0.5, 20], false)
      const result = checkSmallFeatures(feature, MIN_SMALL_FEATURE)
      feature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('Y')
    })

    it('identifies Z-aligned small feature', () => {
      const feature = M.Manifold.cube([20, 20, 0.5], false)
      const result = checkSmallFeatures(feature, MIN_SMALL_FEATURE)
      feature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('Z')
    })

    it('identifies non-aligned small feature (cube)', () => {
      // Small cube has no clear axis alignment
      const feature = M.Manifold.cube([1, 1, 1], false)
      const result = checkSmallFeatures(feature, MIN_SMALL_FEATURE)
      feature.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('None')
    })
  })

  describe('multiple small features', () => {
    it('identifies multiple small disconnected components', () => {
      const small1 = M.Manifold.cube([1, 1, 1], false)
      const small2 = M.Manifold.cube([1, 1, 1], false).translate(20, 0, 0)
      const combined = small1.add(small2)
      small1.delete()
      small2.delete()

      const result = checkSmallFeatures(combined, MIN_SMALL_FEATURE)
      combined.delete()

      expect(result.length).toBe(2)
    })
  })

  describe('custom threshold', () => {
    it('uses custom minimum feature size', () => {
      // 2mm cube - small if threshold is 3mm, ok if threshold is 1.5mm
      const feature = M.Manifold.cube([2, 2, 2], false)

      const resultWith3mm = checkSmallFeatures(feature, 3.0)
      const resultWith1mm = checkSmallFeatures(feature, 1.5)
      feature.delete()

      expect(resultWith3mm.length).toBeGreaterThan(0)
      expect(resultWith1mm).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles zero volume geometry gracefully', () => {
      const cube = M.Manifold.cube([0, 10, 10], false)
      const result = checkSmallFeatures(cube, MIN_SMALL_FEATURE)
      cube.delete()

      expect(result).toEqual([])
    })
  })
})

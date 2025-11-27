import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions, expectBoundingBox } from '../../../../test/geometryHelpers'
import { Shape } from '../Shape'

describe('Shape', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('construction', () => {
    it('wraps a Manifold correctly', () => {
      const cube = M.Manifold.cube([10, 10, 10], true)
      const shape = new Shape(M, cube)

      expect(shape.getVolume()).toBeCloseTo(1000, 0)
      shape.delete()
    })
  })

  describe('CSG operations', () => {
    it('add() unions two shapes', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))

      const result = cube1.add(cube2)

      expectValid(result.build())
      // Combined width should be 15 (10 + 5 overlap)
      expectDimensions(result.build(), { width: 15, depth: 10, height: 10 })
      result.delete()
    })

    it('subtract() creates difference', () => {
      const outer = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const inner = new Shape(M, M.Manifold.cube([10, 10, 10], true))

      const result = outer.subtract(inner)

      // Check positive volume (valid geometry)
      // Note: Genus may be -1 for geometry with internal cavities, which is valid
      expect(result.getVolume()).toBeGreaterThan(0)
      // Volume should be 8000 - 1000 = 7000
      expect(result.getVolume()).toBeCloseTo(7000, 0)
      result.delete()
    })

    it('intersect() creates intersection', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))

      const result = cube1.intersect(cube2)

      expectValid(result.build())
      // Intersection should be 5x10x10 = 500
      expect(result.getVolume()).toBeCloseTo(500, 0)
      result.delete()
    })
  })

  describe('transforms', () => {
    it('translate() moves the shape', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const moved = cube.translate(20, 30, 40)

      expectBoundingBox(moved.build(), {
        minX: 15, maxX: 25,
        minY: 25, maxY: 35,
        minZ: 35, maxZ: 45
      })
      moved.delete()
    })

    it('rotate() rotates the shape', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 20, 5], true))
      const rotated = cube.rotate(0, 0, 90)

      // After 90 degree Z rotation, width and depth should swap
      expectDimensions(rotated.build(), { width: 20, depth: 10, height: 5 })
      rotated.delete()
    })

    it('scale() scales uniformly with single argument', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const scaled = cube.scale(2)

      expectDimensions(scaled.build(), { width: 20, depth: 20, height: 20 })
      scaled.delete()
    })

    it('scale() scales per-axis with three arguments', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const scaled = cube.scale(1, 2, 3)

      expectDimensions(scaled.build(), { width: 10, depth: 20, height: 30 })
      scaled.delete()
    })

    it('mirror() mirrors across an axis', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], false).translate(5, 0, 0))
      const mirrored = cube.mirror('x')

      expectBoundingBox(mirrored.build(), {
        minX: -15, maxX: -5
      })
      mirrored.delete()
    })
  })

  describe('patterns', () => {
    it('linearPattern() creates array along axis', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, 10, 'x')

      // For disjoint geometry, check volume instead of genus
      expect(pattern.getVolume()).toBeCloseTo(3 * 125, 0) // 3 cubes of 5x5x5
      // 3 cubes spaced 10mm apart: spans from -2.5 to 22.5 = 25mm
      expectDimensions(pattern.build(), { width: 25 })
      pattern.delete()
    })

    it('circularPattern() creates rotational array', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const pattern = cube.circularPattern(4, 'z')

      // For disjoint geometry, check volume instead of genus
      expect(pattern.getVolume()).toBeCloseTo(4 * 125, 0) // 4 cubes of 5x5x5
      // 4 cubes at 90 degree intervals around Z axis
      // Should span roughly -15 to 15 in both X and Y
      const bbox = pattern.getBoundingBox()
      expect(bbox.max[0]).toBeGreaterThan(10)
      expect(bbox.max[1]).toBeGreaterThan(10)
      pattern.delete()
    })

    it('linearPattern() with count 1 returns original', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const originalVolume = cube.getVolume()
      const pattern = cube.linearPattern(1, 20, 'x')

      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('linearPattern() with count 0 returns original unchanged', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const originalVolume = cube.getVolume()
      const pattern = cube.linearPattern(0, 20, 'x')

      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('circularPattern() with count 1 returns original', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const originalVolume = cube.getVolume()
      const pattern = cube.circularPattern(1, 'z')

      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('circularPattern() with count 0 returns original unchanged', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const originalVolume = cube.getVolume()
      const pattern = cube.circularPattern(0, 'z')

      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('linearPattern() with zero spacing clamps to minimum spacing', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, 0, 'x')

      // With clamped spacing (MIN_SMALL_FEATURE = 1.5mm), 5mm cubes will still overlap
      // but volume should be greater than a single cube (125) and less than 3x (375)
      expect(pattern.getVolume()).toBeGreaterThan(125) // More than single cube
      expect(pattern.getVolume()).toBeLessThan(375) // Less than 3 separate cubes
      pattern.delete()
    })

    it('linearPattern() with negative spacing clamps to minimum spacing', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, -10, 'x')

      // Should still produce valid geometry with positive spacing
      expect(pattern.getVolume()).toBeGreaterThan(125) // More than single cube
      pattern.delete()
    })
  })

  describe('utilities', () => {
    it('clone() creates independent copy', () => {
      const original = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const clone = original.clone()

      expect(clone.getVolume()).toBeCloseTo(original.getVolume(), 0)

      // Original should still work after clone
      original.delete()
      expect(clone.getVolume()).toBeCloseTo(1000, 0)
      clone.delete()
    })

    it('getBoundingBox() returns correct bounds', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 20, 30], true))
      const bbox = cube.getBoundingBox()

      expect(bbox.min[0]).toBeCloseTo(-5, 1)
      expect(bbox.max[0]).toBeCloseTo(5, 1)
      expect(bbox.min[1]).toBeCloseTo(-10, 1)
      expect(bbox.max[1]).toBeCloseTo(10, 1)
      expect(bbox.min[2]).toBeCloseTo(-15, 1)
      expect(bbox.max[2]).toBeCloseTo(15, 1)
      cube.delete()
    })

    it('getVolume() returns correct volume', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(cube.getVolume()).toBeCloseTo(1000, 0)
      cube.delete()
    })

    it('getSurfaceArea() returns correct area', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      // 6 faces * 100 = 600
      expect(cube.getSurfaceArea()).toBeCloseTo(600, 0)
      cube.delete()
    })

    it('isValid() returns true for valid geometry', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(cube.isValid()).toBe(true)
      cube.delete()
    })
  })

  describe('chaining', () => {
    it('supports fluent chaining of operations', () => {
      const result = new Shape(M, M.Manifold.cube([20, 20, 10], true))
        .subtract(new Shape(M, M.Manifold.cylinder(12, 5, 5, 16).translate(0, 0, -1)))
        .translate(0, 0, 5)
        .rotate(0, 0, 45)

      expectValid(result.build())
      result.delete()
    })
  })

  describe('build() ownership contract', () => {
    it('build() returns the raw Manifold for final output', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const manifold = shape.build()

      // build() returns a valid Manifold
      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeCloseTo(1000, 0)

      // Cleanup - caller is responsible after build()
      manifold.delete()
    })

    it('_getManifold() is an alias for build()', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const manifold = shape._getManifold()

      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeCloseTo(1000, 0)

      manifold.delete()
    })
  })
})

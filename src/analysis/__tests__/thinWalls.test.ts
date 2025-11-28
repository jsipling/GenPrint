import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { checkThinWalls } from '../checks/thinWalls'
import { MIN_WALL_THICKNESS } from '../../generators/manifold/printingConstants'

describe('thinWalls check', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('thick geometry (no issues)', () => {
    it('returns empty array for solid cube with sufficient thickness', () => {
      // 10mm cube - well above minimum wall thickness
      const cube = M.Manifold.cube([10, 10, 10], true)
      const result = checkThinWalls(cube, MIN_WALL_THICKNESS)
      cube.delete()

      expect(result).toEqual([])
    })

    it('returns empty array for cylinder with thick walls', () => {
      // Thick-walled hollow cylinder
      const outer = M.Manifold.cylinder(20, 10, 10, 32)
      const inner = M.Manifold.cylinder(20, 5, 5, 32)
      const thickTube = outer.subtract(inner)
      outer.delete()
      inner.delete()

      const result = checkThinWalls(thickTube, MIN_WALL_THICKNESS)
      thickTube.delete()

      expect(result).toEqual([])
    })

    it('returns empty array for geometry exactly at minimum thickness', () => {
      // Wall at exactly minimum thickness - should pass
      const wall = M.Manifold.cube([MIN_WALL_THICKNESS, 20, 20], false)
      const result = checkThinWalls(wall, MIN_WALL_THICKNESS)
      wall.delete()

      expect(result).toEqual([])
    })

    it('returns empty array for geometry just above minimum thickness', () => {
      const wall = M.Manifold.cube([MIN_WALL_THICKNESS + 0.1, 20, 20], false)
      const result = checkThinWalls(wall, MIN_WALL_THICKNESS)
      wall.delete()

      expect(result).toEqual([])
    })
  })

  describe('thin geometry (issues detected)', () => {
    it('detects thin wall on X axis', () => {
      // Very thin wall (0.5mm) in X direction
      const thinWall = M.Manifold.cube([0.5, 20, 20], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.measured).toBeCloseTo(0.5, 1)
      expect(result[0]!.required).toBe(MIN_WALL_THICKNESS)
    })

    it('detects thin wall on Y axis', () => {
      // Very thin wall (0.8mm) in Y direction
      const thinWall = M.Manifold.cube([20, 0.8, 20], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.measured).toBeCloseTo(0.8, 1)
    })

    it('detects thin wall on Z axis', () => {
      // Very thin wall (0.5mm) in Z direction
      const thinWall = M.Manifold.cube([20, 20, 0.5], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.measured).toBeCloseTo(0.5, 1)
    })

    it('provides bounding box for thin regions', () => {
      const thinWall = M.Manifold.cube([0.5, 20, 20], false).translate(10, 0, 0)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.bbox).toBeDefined()
      expect(result[0]!.bbox.min).toHaveLength(3)
      expect(result[0]!.bbox.max).toHaveLength(3)
      expect(result[0]!.bbox.min[0]).toBeCloseTo(10, 1)
    })

    it('provides estimated volume for thin regions', () => {
      const thinWall = M.Manifold.cube([0.5, 20, 20], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.estimatedVolume).toBeCloseTo(200, 0) // 0.5 * 20 * 20
    })
  })

  describe('axis alignment detection', () => {
    it('identifies X-aligned thin wall', () => {
      // Thin in X direction (X dimension is smallest)
      const thinWall = M.Manifold.cube([0.5, 20, 20], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('X')
    })

    it('identifies Y-aligned thin wall', () => {
      // Thin in Y direction (Y dimension is smallest)
      const thinWall = M.Manifold.cube([20, 0.5, 20], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('Y')
    })

    it('identifies Z-aligned thin wall', () => {
      // Thin in Z direction (Z dimension is smallest)
      const thinWall = M.Manifold.cube([20, 20, 0.5], false)
      const result = checkThinWalls(thinWall, MIN_WALL_THICKNESS)
      thinWall.delete()

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.axisAlignment).toBe('Z')
    })
  })

  describe('multiple thin regions', () => {
    it('identifies multiple thin disconnected components', () => {
      // Two separate thin walls
      const thin1 = M.Manifold.cube([0.5, 10, 10], false)
      const thin2 = M.Manifold.cube([0.5, 10, 10], false).translate(20, 0, 0)
      const combined = thin1.add(thin2)
      thin1.delete()
      thin2.delete()

      const result = checkThinWalls(combined, MIN_WALL_THICKNESS)
      combined.delete()

      expect(result.length).toBe(2)
    })
  })

  describe('custom threshold', () => {
    it('uses custom minimum thickness', () => {
      // 1.5mm wall - thin if threshold is 2mm, ok if threshold is 1.2mm
      const wall = M.Manifold.cube([1.5, 20, 20], false)

      const resultWith2mm = checkThinWalls(wall, 2.0)
      const resultWith1mm = checkThinWalls(wall, 1.0)
      wall.delete()

      expect(resultWith2mm.length).toBeGreaterThan(0)
      expect(resultWith1mm).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles zero volume geometry gracefully', () => {
      // A degenerate case - should not crash
      const cube = M.Manifold.cube([0, 10, 10], false)
      const result = checkThinWalls(cube, MIN_WALL_THICKNESS)
      cube.delete()

      expect(result).toEqual([])
    })

    it('handles complex connected geometry (L-shape)', () => {
      // L-shaped piece where both parts are thick - should pass
      const vertical = M.Manifold.cube([10, 10, 30], false)
      const horizontal = M.Manifold.cube([30, 10, 10], false)
      const lShape = vertical.add(horizontal)
      vertical.delete()
      horizontal.delete()

      const result = checkThinWalls(lShape, MIN_WALL_THICKNESS)
      lShape.delete()

      expect(result).toEqual([])
    })
  })
})

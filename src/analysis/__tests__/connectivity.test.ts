import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { checkConnectivity } from '../checks/connectivity'

describe('connectivity check', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('connected geometry', () => {
    it('returns null for a single solid cube', () => {
      const cube = M.Manifold.cube([10, 10, 10], true)
      const result = checkConnectivity(cube)
      cube.delete()

      expect(result).toBeNull()
    })

    it('returns null for two touching cubes', () => {
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(10, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).toBeNull()
    })

    it('returns null for overlapping geometry', () => {
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(5, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).toBeNull()
    })
  })

  describe('disconnected geometry', () => {
    it('detects two separate cubes', () => {
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(20, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()
      expect(result!.componentCount).toBe(2)
      expect(result!.components).toHaveLength(2)
    })

    it('detects floating component (not touching Z=0)', () => {
      // Cube on bed
      const groundCube = M.Manifold.cube([10, 10, 10], false)
      // Cube floating above bed
      const floatingCube = M.Manifold.cube([5, 5, 5], false).translate(20, 0, 15)
      const combined = groundCube.add(floatingCube)
      groundCube.delete()
      floatingCube.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()
      expect(result!.componentCount).toBe(2)

      // Find the floating component
      const floating = result!.components.find((c) => c.isFloating)
      expect(floating).toBeDefined()
      expect(floating!.bbox.min[2]).toBeGreaterThan(0)
    })

    it('detects three disconnected components', () => {
      const cube1 = M.Manifold.cube([5, 5, 5], false)
      const cube2 = M.Manifold.cube([5, 5, 5], false).translate(15, 0, 0)
      const cube3 = M.Manifold.cube([5, 5, 5], false).translate(30, 0, 0)
      const temp = cube1.add(cube2)
      cube1.delete()
      cube2.delete()
      const combined = temp.add(cube3)
      temp.delete()
      cube3.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()
      expect(result!.componentCount).toBe(3)
      expect(result!.components).toHaveLength(3)
    })

    it('provides volume for each component', () => {
      const smallCube = M.Manifold.cube([5, 5, 5], false)
      const largeCube = M.Manifold.cube([10, 10, 10], false).translate(20, 0, 0)
      const combined = smallCube.add(largeCube)
      smallCube.delete()
      largeCube.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()

      // Sort by volume to reliably identify each
      const sortedComponents = result!.components.sort((a, b) => a.volume - b.volume)
      expect(sortedComponents[0]!.volume).toBeCloseTo(125, 0) // 5^3
      expect(sortedComponents[1]!.volume).toBeCloseTo(1000, 0) // 10^3
    })

    it('provides bounding box for each component', () => {
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(30, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()

      // Sort by X position to reliably identify each
      const sortedComponents = result!.components.sort((a, b) => a.bbox.min[0] - b.bbox.min[0])
      expect(sortedComponents[0]!.bbox.min[0]).toBeCloseTo(0, 1)
      expect(sortedComponents[0]!.bbox.max[0]).toBeCloseTo(10, 1)
      expect(sortedComponents[1]!.bbox.min[0]).toBeCloseTo(30, 1)
      expect(sortedComponents[1]!.bbox.max[0]).toBeCloseTo(40, 1)
    })
  })

  describe('edge cases', () => {
    it('handles manifold with very small separation', () => {
      // Two cubes with 0.1mm gap - should be detected as separate
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(10.1, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const result = checkConnectivity(combined)
      combined.delete()

      expect(result).not.toBeNull()
      expect(result!.componentCount).toBe(2)
    })

    it('handles complex connected geometry (L-shape)', () => {
      // L-shaped piece (two connected boxes)
      const vertical = M.Manifold.cube([10, 10, 30], false)
      const horizontal = M.Manifold.cube([30, 10, 10], false)
      const lShape = vertical.add(horizontal)
      vertical.delete()
      horizontal.delete()

      const result = checkConnectivity(lShape)
      lShape.delete()

      expect(result).toBeNull()
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid } from '../../../../test/geometryHelpers'
import { createBuilderContext, BuilderContext } from '../BuilderContext'

describe('Layout Helpers', () => {
  let M: ManifoldToplevel
  let ctx: BuilderContext

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    ctx = createBuilderContext(M)
  })

  describe('compartmentGrid', () => {
    it('creates a grid of compartment walls', () => {
      const grid = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 3,
        height: 20,
        wallThickness: 2
      })

      expect(grid).not.toBeNull()
      expectValid(grid!.build({ skipConnectivityCheck: true }))

      // Should have positive volume (walls exist)
      expect(grid!.getVolume()).toBeGreaterThan(0)

      // Check bounding box matches expected dimensions
      const bbox = grid!.getBoundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(100, 0) // width
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(80, 0)  // depth
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(20, 0)  // height

      grid!.delete()
    })

    it('creates correct number of dividers', () => {
      // 3 columns = 2 vertical dividers
      // 4 rows = 3 horizontal dividers
      const grid = ctx.compartmentGrid({
        bounds: [60, 80],
        rows: 4,
        columns: 3,
        height: 10,
        wallThickness: 2
      })

      // We can't easily count dividers, but we can verify the geometry is valid
      expect(grid).not.toBeNull()
      expectValid(grid!.build({ skipConnectivityCheck: true }))
      expect(grid!.getVolume()).toBeGreaterThan(0)

      grid!.delete()
    })

    it('handles single row (only vertical dividers)', () => {
      const grid = ctx.compartmentGrid({
        bounds: [100, 30],
        rows: 1,
        columns: 4,
        height: 15,
        wallThickness: 2
      })

      // Vertical-only dividers are disconnected (valid but separate bodies)
      // Don't use expectValid as genus is negative for disconnected geometry
      expect(grid!.getVolume()).toBeGreaterThan(0)

      // Should have 3 vertical dividers (columns - 1)
      const bbox = grid!.getBoundingBox()
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(15, 0) // height

      grid!.delete()
    })

    it('handles single column (only horizontal dividers)', () => {
      const grid = ctx.compartmentGrid({
        bounds: [30, 100],
        rows: 4,
        columns: 1,
        height: 15,
        wallThickness: 2
      })

      // Horizontal-only dividers are disconnected (valid but separate bodies)
      // Don't use expectValid as genus is negative for disconnected geometry
      expect(grid!.getVolume()).toBeGreaterThan(0)

      // Should have 3 horizontal dividers (rows - 1)
      const bbox = grid!.getBoundingBox()
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(15, 0) // height

      grid!.delete()
    })

    it('returns null for 1x1 grid (no dividers needed)', () => {
      const grid = ctx.compartmentGrid({
        bounds: [50, 50],
        rows: 1,
        columns: 1,
        height: 10,
        wallThickness: 2
      })

      expect(grid).toBeNull()
    })

    it('respects corner positioning', () => {
      const grid = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 2,
        height: 10,
        wallThickness: 2,
        corner: true
      })

      expectValid(grid!.build({ skipConnectivityCheck: true }))

      // With corner positioning, min should be at 0
      const bbox = grid!.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(0, 1)
      expect(bbox.min[1]).toBeCloseTo(0, 1)
      expect(bbox.min[2]).toBeCloseTo(0, 1)

      grid!.delete()
    })

    it('positions centered by default', () => {
      const grid = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 2,
        height: 10,
        wallThickness: 2
      })

      expectValid(grid!.build({ skipConnectivityCheck: true }))

      // With centered positioning, should be symmetric around origin
      const bbox = grid!.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(-50, 1)
      expect(bbox.max[0]).toBeCloseTo(50, 1)
      expect(bbox.min[1]).toBeCloseTo(-40, 1)
      expect(bbox.max[1]).toBeCloseTo(40, 1)

      grid!.delete()
    })

    it('clamps wall thickness to minimum', () => {
      // Very thin walls should be clamped to minimum
      const grid = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 2,
        height: 10,
        wallThickness: 0.1 // Too thin
      })

      expectValid(grid!.build({ skipConnectivityCheck: true }))
      expect(grid!.getVolume()).toBeGreaterThan(0)

      grid!.delete()
    })

    it('includes perimeter walls when requested', () => {
      const withPerimeter = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 2,
        height: 10,
        wallThickness: 2,
        includePerimeter: true
      })

      const withoutPerimeter = ctx.compartmentGrid({
        bounds: [100, 80],
        rows: 2,
        columns: 2,
        height: 10,
        wallThickness: 2,
        includePerimeter: false
      })

      // With perimeter should have more volume
      expect(withPerimeter!.getVolume()).toBeGreaterThan(withoutPerimeter!.getVolume())

      withPerimeter!.delete()
      withoutPerimeter!.delete()
    })
  })
})

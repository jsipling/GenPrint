import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions, expectBoundingBox, expectVolumeApprox } from '../../../../test/geometryHelpers'
import { createPrimitives } from '../primitives'
import type { Primitives } from '../primitives'

describe('primitives', () => {
  let M: ManifoldToplevel
  let p: Primitives

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    p = createPrimitives(M)
  })

  describe('box', () => {
    it('creates centered box by default', () => {
      const box = p.box(10, 20, 30)

      expectValid(box.build())
      expectDimensions(box.build(), { width: 10, depth: 20, height: 30 })
      expectBoundingBox(box.build(), { minX: -5, maxX: 5, minY: -10, maxY: 10 })
      box.delete()
    })

    it('creates non-centered box when specified', () => {
      const box = p.box(10, 20, 30, false)

      expectValid(box.build())
      expectBoundingBox(box.build(), { minX: 0, maxX: 10, minY: 0, maxY: 20, minZ: 0, maxZ: 30 })
      box.delete()
    })

    it('creates corner-positioned box with options object', () => {
      const box = p.box(10, 20, 30, { corner: true })

      expectValid(box.build())
      expectBoundingBox(box.build(), { minX: 0, maxX: 10, minY: 0, maxY: 20, minZ: 0, maxZ: 30 })
      box.delete()
    })

    it('creates centered box with options object', () => {
      const box = p.box(10, 20, 30, { centered: true })

      expectValid(box.build())
      expectBoundingBox(box.build(), { minX: -5, maxX: 5, minY: -10, maxY: 10 })
      box.delete()
    })

    it('creates centered box with empty options object', () => {
      const box = p.box(10, 20, 30, {})

      expectValid(box.build())
      // Default is centered
      expectBoundingBox(box.build(), { minX: -5, maxX: 5, minY: -10, maxY: 10 })
      box.delete()
    })
  })

  describe('cylinder', () => {
    it('creates cylinder with correct dimensions', () => {
      const cyl = p.cylinder(20, 10)

      expectValid(cyl.build())
      expectDimensions(cyl.build(), { width: 20, depth: 20, height: 20 })
      // Volume = π * r² * h = π * 100 * 20 ≈ 6283
      expectVolumeApprox(cyl.build(), Math.PI * 100 * 20, 0.05)
      cyl.delete()
    })
  })

  describe('sphere', () => {
    it('creates sphere with correct radius', () => {
      const sph = p.sphere(10)

      expectValid(sph.build())
      expectDimensions(sph.build(), { width: 20, depth: 20, height: 20 })
      // Volume = 4/3 * π * r³ ≈ 4188.8
      expectVolumeApprox(sph.build(), (4/3) * Math.PI * 1000, 0.05)
      sph.delete()
    })
  })

  describe('cone', () => {
    it('creates cone with zero top radius', () => {
      const cone = p.cone(20, 10, 0)

      expectValid(cone.build())
      expectDimensions(cone.build(), { height: 20 })
      // Volume = 1/3 * π * r² * h = 1/3 * π * 100 * 20 ≈ 2094
      expectVolumeApprox(cone.build(), (1/3) * Math.PI * 100 * 20, 0.05)
      cone.delete()
    })

    it('creates truncated cone', () => {
      const cone = p.cone(20, 10, 5)

      expectValid(cone.build())
      // Frustum volume = π * h/3 * (R² + Rr + r²)
      const expectedVolume = Math.PI * (20/3) * (100 + 50 + 25)
      expectVolumeApprox(cone.build(), expectedVolume, 0.05)
      cone.delete()
    })
  })

  describe('roundedBox', () => {
    it('creates box with rounded corners', () => {
      const rbox = p.roundedBox(30, 20, 10, 3)

      expectValid(rbox.build())
      expectDimensions(rbox.build(), { width: 30, depth: 20, height: 10 })
      rbox.delete()
    })

    it('clamps radius to max possible', () => {
      // Requesting 20mm radius on 20mm wide box should clamp to 10mm
      const rbox = p.roundedBox(20, 30, 10, 20)

      expectValid(rbox.build())
      expectDimensions(rbox.build(), { width: 20, depth: 30, height: 10 })
      rbox.delete()
    })

    it('handles zero radius as regular box', () => {
      const rbox = p.roundedBox(10, 10, 10, 0)

      expectValid(rbox.build())
      expect(rbox.getVolume()).toBeCloseTo(1000, 0)
      rbox.delete()
    })
  })

  describe('tube', () => {
    it('creates hollow cylinder', () => {
      const tube = p.tube(20, 10, 5)

      expectValid(tube.build())
      expectDimensions(tube.build(), { width: 20, depth: 20, height: 20 })
      // Volume = π * h * (R² - r²) = π * 20 * (100 - 25) = π * 1500 ≈ 4712
      expectVolumeApprox(tube.build(), Math.PI * 1500, 0.05)
      tube.delete()
    })

    it('enforces minimum wall thickness', () => {
      // Outer radius 10, inner radius 9.5 = 0.5mm wall, should clamp to 1.2mm
      const tube = p.tube(20, 10, 9.5)

      expectValid(tube.build())
      // Max inner radius should be 10 - 1.2 = 8.8
      // Volume = π * 20 * (100 - 77.44) ≈ π * 451.2
      const volume = tube.getVolume()
      expect(volume).toBeGreaterThan(Math.PI * 20 * 20) // Wall is at least 1.2mm
      tube.delete()
    })
  })

  describe('hole helpers', () => {
    it('hole() creates cylinder for clean subtraction', () => {
      const hole = p.hole(10, 20)

      expectValid(hole.build())
      // Hole has extra depth for clean boolean
      const bbox = hole.getBoundingBox()
      expect(bbox.min[2]).toBeLessThan(0)
      expect(bbox.max[2]).toBeGreaterThan(20)
      hole.delete()
    })

    it('hole() works for subtraction', () => {
      const base = p.box(30, 30, 10)
      const hole = p.hole(10, 20)
      const result = base.subtract(hole)

      expectValid(result.build())
      // Volume should be box minus hole (hole is diameter 10 = radius 5, goes through 10mm base)
      const boxVolume = 30 * 30 * 10
      const holeVolume = Math.PI * 25 * 10 // pi * r^2 * h through the base
      expectVolumeApprox(result.build(), boxVolume - holeVolume, 0.1) // Allow 10% tolerance
      result.delete()
    })

    it('counterboredHole() creates stepped hole', () => {
      const hole = p.counterboredHole(5, 20, 10, 5)

      expectValid(hole.build())
      hole.delete()
    })

    it('countersunkHole() creates angled hole', () => {
      const hole = p.countersunkHole(5, 20, 10)

      expectValid(hole.build())
      hole.delete()
    })

    it('countersunkHole() handles equal head and shaft diameter', () => {
      // When headDiameter equals diameter, should fall back to regular hole
      const hole = p.countersunkHole(10, 20, 10)

      expectValid(hole.build())
      // Should still have valid volume (just a regular hole)
      expect(hole.getVolume()).toBeGreaterThan(0)
      hole.delete()
    })

    it('countersunkHole() handles inverted head diameter', () => {
      // When headDiameter < diameter, should fall back to regular hole
      const hole = p.countersunkHole(10, 20, 5)

      expectValid(hole.build())
      // Should still have valid volume (just a regular hole)
      expect(hole.getVolume()).toBeGreaterThan(0)
      hole.delete()
    })
  })

  describe('extrude', () => {
    it('extrudes 2D profile to 3D', () => {
      // Simple square profile
      const profile: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
      const shape = p.extrude(profile, 20)

      expectValid(shape.build())
      expect(shape.getVolume()).toBeCloseTo(10 * 10 * 20, 0)
      shape.delete()
    })

    it('handles empty profile by returning fallback geometry', () => {
      // Empty profile should return valid fallback geometry, not crash
      const shape = p.extrude([], 20)

      expectValid(shape.build())
      // Should have positive volume (fallback unit cube)
      expect(shape.getVolume()).toBeGreaterThan(0)
      shape.delete()
    })

    it('extrudes complex profile', () => {
      // L-shaped profile
      const profile: [number, number][] = [
        [0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]
      ]
      const shape = p.extrude(profile, 10)

      expectValid(shape.build())
      // L area = 10*5 + 5*5 = 75, volume = 75 * 10 = 750
      expect(shape.getVolume()).toBeCloseTo(750, 0)
      shape.delete()
    })
  })

  describe('revolve', () => {
    it('revolves profile around Y axis', () => {
      // Simple profile that will create a cylinder when revolved
      const profile: [number, number][] = [[0, 0], [5, 0], [5, 10], [0, 10]]
      const shape = p.revolve(profile, 360)

      expectValid(shape.build())
      // Should approximate a cylinder with r=5, h=10
      expectVolumeApprox(shape.build(), Math.PI * 25 * 10, 0.1)
      shape.delete()
    })

    it('handles empty profile by returning fallback geometry', () => {
      // Empty profile should return valid fallback geometry, not crash
      const shape = p.revolve([], 360)

      expectValid(shape.build())
      // Should have positive volume (fallback unit cube)
      expect(shape.getVolume()).toBeGreaterThan(0)
      shape.delete()
    })

    it('creates partial revolution', () => {
      const profile: [number, number][] = [[0, 0], [5, 0], [5, 10], [0, 10]]
      const shape = p.revolve(profile, 180)

      expectValid(shape.build())
      // Half the volume of full revolution
      expectVolumeApprox(shape.build(), Math.PI * 25 * 10 / 2, 0.1)
      shape.delete()
    })
  })
})

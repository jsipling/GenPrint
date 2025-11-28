import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { analyzeManifold, computeStats } from '../printabilityAnalyzer'
import type { ParameterDef } from '../../generators/types'

describe('printabilityAnalyzer', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('computeStats', () => {
    it('computes correct stats for a cube', () => {
      const cube = M.Manifold.cube([10, 10, 10], false)
      const stats = computeStats(cube)
      cube.delete()

      expect(stats.volume).toBeCloseTo(1000, 0) // 10^3
      expect(stats.surfaceArea).toBeCloseTo(600, 0) // 6 * 10^2
      expect(stats.bbox.min).toEqual([0, 0, 0])
      expect(stats.bbox.max).toEqual([10, 10, 10])
      expect(stats.triangleCount).toBeGreaterThan(0)
    })

    it('computes correct center of mass for centered cube', () => {
      const cube = M.Manifold.cube([10, 10, 10], true) // centered
      const stats = computeStats(cube)
      cube.delete()

      // Centered cube should have center of mass at origin
      expect(stats.centerOfMass[0]).toBeCloseTo(0, 1)
      expect(stats.centerOfMass[1]).toBeCloseTo(0, 1)
      expect(stats.centerOfMass[2]).toBeCloseTo(0, 1)
    })

    it('computes correct stats for a cylinder', () => {
      const cylinder = M.Manifold.cylinder(20, 5, 5, 32)
      const stats = computeStats(cylinder)
      cylinder.delete()

      // Volume of cylinder = π * r² * h ≈ 3.14159 * 25 * 20 ≈ 1571
      // With 32 segments, volume will be slightly less (~1560)
      expect(stats.volume).toBeGreaterThan(1500)
      expect(stats.volume).toBeLessThan(1600)
      expect(stats.bbox.min[2]).toBeCloseTo(0, 1)
      expect(stats.bbox.max[2]).toBeCloseTo(20, 1)
    })
  })

  describe('analyzeManifold', () => {
    it('returns PASS status for valid geometry', () => {
      const cube = M.Manifold.cube([10, 10, 10], false)
      const params: ParameterDef[] = []
      const values: Record<string, number> = {}

      const result = analyzeManifold(cube, params, values)
      cube.delete()

      expect(result.status).toBe('PASS')
      expect(result.stats).not.toBeNull()
      expect(result.issues).not.toBeNull()
      expect(result.issues!.thinWalls).toEqual([])
      expect(result.issues!.smallFeatures).toEqual([])
      expect(result.issues!.disconnected).toBeNull()
      expect(result.parameterCorrelations).toEqual([])
    })

    it('returns FAIL status for thin geometry', () => {
      const thinWall = M.Manifold.cube([0.5, 20, 20], false)
      const params: ParameterDef[] = [
        { type: 'number', name: 'wallThickness', label: 'Wall', min: 0, max: 10, default: 0.5 },
      ]
      const values: Record<string, number> = { wallThickness: 0.5 }

      const result = analyzeManifold(thinWall, params, values)
      thinWall.delete()

      expect(result.status).toBe('FAIL')
      expect(result.issues!.thinWalls.length).toBeGreaterThan(0)
    })

    it('returns FAIL status for disconnected geometry', () => {
      const cube1 = M.Manifold.cube([10, 10, 10], false)
      const cube2 = M.Manifold.cube([10, 10, 10], false).translate(20, 0, 0)
      const combined = cube1.add(cube2)
      cube1.delete()
      cube2.delete()

      const params: ParameterDef[] = []
      const values: Record<string, number> = {}

      const result = analyzeManifold(combined, params, values)
      combined.delete()

      expect(result.status).toBe('FAIL')
      expect(result.issues!.disconnected).not.toBeNull()
      expect(result.issues!.disconnected!.componentCount).toBe(2)
    })

    it('returns FAIL status for small features', () => {
      const smallFeature = M.Manifold.cube([1, 1, 1], false)
      const params: ParameterDef[] = []
      const values: Record<string, number> = {}

      const result = analyzeManifold(smallFeature, params, values)
      smallFeature.delete()

      expect(result.status).toBe('FAIL')
      expect(result.issues!.smallFeatures.length).toBeGreaterThan(0)
    })

    it('includes parameter correlations for issues', () => {
      const thinWall = M.Manifold.cube([0.5, 20, 20], false)
      const params: ParameterDef[] = [
        { type: 'number', name: 'wallThickness', label: 'Wall', min: 0, max: 10, default: 0.5 },
      ]
      const values: Record<string, number> = { wallThickness: 0.5 }

      const result = analyzeManifold(thinWall, params, values)
      thinWall.delete()

      expect(result.parameterCorrelations!.length).toBeGreaterThan(0)
      expect(result.parameterCorrelations![0]!.parameterName).toBe('wallThickness')
    })

    it('handles invalid geometry gracefully', () => {
      // Zero-volume geometry
      const degenerate = M.Manifold.cube([0, 10, 10], false)

      const params: ParameterDef[] = []
      const values: Record<string, number> = {}

      const result = analyzeManifold(degenerate, params, values)
      degenerate.delete()

      expect(result.status).toBe('ERROR')
      expect(result.error).toBeDefined()
      expect(result.error!.type).toBe('GEOMETRY_CRASH')
    })
  })

  describe('determinism', () => {
    it('produces identical results for identical input', () => {
      const cube = M.Manifold.cube([10, 10, 10], false)
      const params: ParameterDef[] = []
      const values: Record<string, number> = {}

      const result1 = analyzeManifold(cube, params, values)
      const result2 = analyzeManifold(cube, params, values)
      cube.delete()

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
    })
  })
})

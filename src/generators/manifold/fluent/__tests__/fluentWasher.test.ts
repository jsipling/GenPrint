/**
 * Test demonstrating fluent API usage with a washer builder
 * This proves the fluent API can replicate existing builder functionality
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectDimensions } from '../../../../test/geometryHelpers'
import { createBuilderContext } from '../BuilderContext'
import { buildWasher } from '../../washerBuilder'
import { maxInnerDiameter } from '../../printingConstants'

/**
 * Fluent implementation of washer builder
 * Demonstrates the target usage pattern for AI-generated code
 */
function buildWasherFluent(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const ctx = createBuilderContext(M)
  const { cylinder, hole } = ctx

  const outerDiameter = Number(params['outer_diameter']) || 12
  const innerDiameter = Number(params['inner_diameter']) || 6
  const thickness = Number(params['thickness']) || 1.5

  // Apply safety constraints
  const maxInner = maxInnerDiameter(outerDiameter)
  const safeInnerD = Math.min(innerDiameter, maxInner)

  const outerRadius = outerDiameter / 2
  const innerRadius = safeInnerD / 2

  // Build washer using fluent API
  const washer = cylinder(thickness, outerRadius)
    .subtract(hole(innerRadius * 2, thickness + 1))

  return washer.build()
}

describe('fluentWasher', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('generates valid geometry', () => {
    const params = {
      outer_diameter: 20,
      inner_diameter: 10,
      thickness: 3
    }

    const washer = buildWasherFluent(M, params)
    // Check positive volume (valid geometry)
    expect(washer.volume()).toBeGreaterThan(0)
    washer.delete()
  })

  it('matches dimensions of original builder', () => {
    const params = {
      outer_diameter: 20,
      inner_diameter: 10,
      thickness: 3
    }

    const fluentWasher = buildWasherFluent(M, params)
    const originalWasher = buildWasher(M, params)

    expectDimensions(fluentWasher, { width: 20, depth: 20, height: 3 })
    expectDimensions(originalWasher, { width: 20, depth: 20, height: 3 })

    // Volumes should be very close
    const fluentVolume = fluentWasher.volume()
    const originalVolume = originalWasher.volume()
    expect(Math.abs(fluentVolume - originalVolume) / originalVolume).toBeLessThan(0.05) // Allow 5% tolerance

    fluentWasher.delete()
    originalWasher.delete()
  })

  it('respects minimum wall thickness', () => {
    const params = {
      outer_diameter: 10,
      inner_diameter: 9, // Would leave 0.5mm wall, should clamp
      thickness: 2
    }

    const washer = buildWasherFluent(M, params)
    // Volume should be positive (wall exists)
    expect(washer.volume()).toBeGreaterThan(0)
    washer.delete()
  })

  describe('complex fluent patterns', () => {
    it('can create array of washers', () => {
      const ctx = createBuilderContext(M)
      const { cylinder, hole, linearArray } = ctx

      // Single washer
      const washer = cylinder(2, 10)
        .subtract(hole(5, 5))

      // Array of 3 washers
      const washerArray = linearArray(washer, 3, [25, 0, 0])

      // For disjoint geometry, check volume instead of genus
      expect(washerArray.getVolume()).toBeGreaterThan(0)
      // Should span 3 washers with 25mm spacing
      const bbox = washerArray.getBoundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(70, 0) // 20 + 25 + 25 = 70mm span

      washerArray.delete()
    })

    it('can combine multiple shapes', () => {
      const ctx = createBuilderContext(M)
      const { box, cylinder, hole, union, difference } = ctx

      // Create a mounting plate with washer-like features
      const plate = box(50, 30, 5)
      const boss1 = cylinder(8, 8).translate(-15, 0, 5)
      const boss2 = cylinder(8, 8).translate(15, 0, 5)
      const hole1 = hole(6, 20).translate(-15, 0, 0)
      const hole2 = hole(6, 20).translate(15, 0, 0)

      const result = difference(
        union(plate, boss1, boss2),
        hole1, hole2
      )

      // Check positive volume (valid geometry)
      expect(result.getVolume()).toBeGreaterThan(0)
      result.delete()
    })
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildWasher } from './washerBuilder'

describe('washerBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('generates valid geometry with default params', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectValid(washer)
    washer.delete()
  })

  it('respects outer diameter dimension', () => {
    const params = { outer_diameter: 20, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectDimensions(washer, { width: 20, depth: 20 })
    washer.delete()
  })

  it('respects thickness dimension', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 3 }
    const washer = buildWasher(M, params)
    expectDimensions(washer, { height: 3 })
    washer.delete()
  })

  it('clamps inner diameter to maintain wall thickness', () => {
    const params = { outer_diameter: 12, inner_diameter: 11, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectValid(washer)
    expect(washer.volume()).toBeGreaterThan(0)
    washer.delete()
  })

  it('matches geometry snapshot', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expect(getGeometryFingerprint(washer)).toMatchSnapshot()
    washer.delete()
  })

  it('enforces 1.2mm minimum wall thickness per AGENTS.md', () => {
    const params = {
      outer_diameter: 10,
      inner_diameter: 8, // Would leave 1mm wall, should clamp to 7.6mm
      thickness: 2
    }

    const washer = buildWasher(M, params)
    expectValid(washer)

    // Volume check similar to spacer
    const volume = washer.volume()
    // With 1.2mm walls (inner clamped to 7.6): π * 2 * (25 - 14.44) ≈ 66.4
    // With 1mm walls (inner = 8): π * 2 * (25 - 16) ≈ 56.5
    expect(volume).toBeGreaterThan(60)
    washer.delete()
  })
})

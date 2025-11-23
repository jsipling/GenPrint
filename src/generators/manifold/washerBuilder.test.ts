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
})

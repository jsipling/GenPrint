import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildSpacer } from './spacerBuilder'

describe('spacerBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('generates valid geometry with default params', () => {
    const params = {
      outer_diameter: 20,
      inner_hole: 5,
      height: 10
    }

    const spacer = buildSpacer(M, params)
    expectValid(spacer)
    spacer.delete()
  })

  it('respects outer diameter dimension', () => {
    const params = {
      outer_diameter: 30,
      inner_hole: 5,
      height: 10
    }

    const spacer = buildSpacer(M, params)
    expectDimensions(spacer, { width: 30, depth: 30 })
    spacer.delete()
  })

  it('respects height dimension', () => {
    const params = {
      outer_diameter: 20,
      inner_hole: 5,
      height: 15
    }

    const spacer = buildSpacer(M, params)
    expectDimensions(spacer, { height: 15 })
    spacer.delete()
  })

  it('clamps inner hole to maintain wall thickness', () => {
    const params = {
      outer_diameter: 20,
      inner_hole: 19, // Should be clamped to 18 (outer - 2mm wall)
      height: 10
    }

    const spacer = buildSpacer(M, params)
    expectValid(spacer)
    // Volume should be non-zero (wall exists)
    expect(spacer.volume()).toBeGreaterThan(0)
    spacer.delete()
  })

  it('handles minimum inner hole', () => {
    const params = {
      outer_diameter: 20,
      inner_hole: 1,
      height: 10
    }

    const spacer = buildSpacer(M, params)
    expectValid(spacer)
    spacer.delete()
  })

  it('matches geometry snapshot', () => {
    const params = {
      outer_diameter: 20,
      inner_hole: 5,
      height: 10
    }

    const spacer = buildSpacer(M, params)
    const fingerprint = getGeometryFingerprint(spacer)
    expect(fingerprint).toMatchSnapshot()
    spacer.delete()
  })
})

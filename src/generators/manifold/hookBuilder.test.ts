import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildHook } from './hookBuilder'

describe('hookBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 20, hook_depth: 30, hook_height: 40, thickness: 5, hole_diameter: 4
  }

  it('generates valid geometry with default params', () => {
    const hook = buildHook(M, defaultParams)
    expectValid(hook)
    hook.delete()
  })

  it('respects width dimension', () => {
    const hook = buildHook(M, { ...defaultParams, width: 30 })
    // In hook geometry: width param = Z dimension (height in bbox)
    expectDimensions(hook, { height: 30 })
    hook.delete()
  })

  it('generates with different hole diameters', () => {
    // Test that different hole diameters produce valid geometry
    const withHole = buildHook(M, { ...defaultParams, hole_diameter: 8 })
    const smallHole = buildHook(M, { ...defaultParams, hole_diameter: 2 })
    expectValid(withHole)
    expectValid(smallHole)
    withHole.delete()
    smallHole.delete()
  })

  it('matches geometry snapshot', () => {
    const hook = buildHook(M, defaultParams)
    expect(getGeometryFingerprint(hook)).toMatchSnapshot()
    hook.delete()
  })
})

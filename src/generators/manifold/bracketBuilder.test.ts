import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildBracket } from './bracketBuilder'

describe('bracketBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 20, arm_length: 40, thickness: 4,
    hole_diameter: 5, fillet_radius: 8,
    hole_count_arm_1: 2, hole_count_arm_2: 2,
    add_rib: false, rib_thickness: 3
  }

  it('generates valid geometry with default params', () => {
    const bracket = buildBracket(M, defaultParams)
    expectValid(bracket)
    bracket.delete()
  })

  it('respects width dimension', () => {
    const bracket = buildBracket(M, { ...defaultParams, width: 30 })
    expectDimensions(bracket, { depth: 30 })
    bracket.delete()
  })

  it('subtracts mounting holes', () => {
    const withHoles = buildBracket(M, { ...defaultParams, hole_count_arm_1: 2, hole_count_arm_2: 2 })
    const noHoles = buildBracket(M, { ...defaultParams, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    expect(withHoles.volume()).toBeLessThan(noHoles.volume())
    withHoles.delete()
    noHoles.delete()
  })

  it('generates valid geometry with rib enabled', () => {
    const withRib = buildBracket(M, { ...defaultParams, add_rib: true })
    expectValid(withRib)
    // Rib should add volume compared to no rib (with no fillet to overlap)
    const noFilletNoRib = buildBracket(M, { ...defaultParams, fillet_radius: 0, add_rib: false, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    const noFilletWithRib = buildBracket(M, { ...defaultParams, fillet_radius: 0, add_rib: true, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    expect(noFilletWithRib.volume()).toBeGreaterThan(noFilletNoRib.volume())
    withRib.delete()
    noFilletNoRib.delete()
    noFilletWithRib.delete()
  })

  it('handles zero fillet radius', () => {
    const bracket = buildBracket(M, { ...defaultParams, fillet_radius: 0 })
    expectValid(bracket)
    bracket.delete()
  })

  it('adds fillet volume when fillet_radius > 0', () => {
    const withFillet = buildBracket(M, { ...defaultParams, fillet_radius: 8, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    const noFillet = buildBracket(M, { ...defaultParams, fillet_radius: 0, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    expect(withFillet.volume()).toBeGreaterThan(noFillet.volume())
    withFillet.delete()
    noFillet.delete()
  })

  it('matches geometry snapshot', () => {
    const bracket = buildBracket(M, defaultParams)
    expect(getGeometryFingerprint(bracket)).toMatchSnapshot()
    bracket.delete()
  })
})

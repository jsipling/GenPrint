import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildBox } from './boxBuilder'

describe('boxBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 60, depth: 40, height: 30,
    wall_thickness: 2, bottom_thickness: 2,
    corner_radius: 3, include_lid: false,
    lid_height: 10, lid_clearance: 0.3, lid_lip_height: 5,
    dividers_x: 0, dividers_y: 0,
    finger_grip: false, stackable: false
  }

  it('generates valid geometry with default params', () => {
    const box = buildBox(M, defaultParams)
    expectValid(box)
    box.delete()
  })

  it('respects width/depth/height dimensions', () => {
    const box = buildBox(M, { ...defaultParams, width: 80, depth: 50, height: 40 })
    expectDimensions(box, { width: 80, depth: 50, height: 40 })
    box.delete()
  })

  it('generates lid when include_lid is true', () => {
    const withLid = buildBox(M, { ...defaultParams, include_lid: true })
    const withoutLid = buildBox(M, { ...defaultParams, include_lid: false })
    // Lid adds volume (separate piece next to box)
    expect(withLid.volume()).toBeGreaterThan(withoutLid.volume())
    withLid.delete()
    withoutLid.delete()
  })

  it('generates dividers when specified', () => {
    const withDividers = buildBox(M, { ...defaultParams, dividers_x: 2, dividers_y: 1 })
    const withoutDividers = buildBox(M, { ...defaultParams, dividers_x: 0, dividers_y: 0 })
    // Dividers add volume
    expect(withDividers.volume()).toBeGreaterThan(withoutDividers.volume())
    withDividers.delete()
    withoutDividers.delete()
  })

  it('generates valid geometry with finger grip enabled', () => {
    const withGrip = buildBox(M, { ...defaultParams, finger_grip: true })
    expectValid(withGrip)
    withGrip.delete()
  })

  it('generates stackable lip when enabled', () => {
    const stackable = buildBox(M, { ...defaultParams, stackable: true })
    const notStackable = buildBox(M, { ...defaultParams, stackable: false })
    // Stackable adds bottom lip volume
    expect(stackable.volume()).toBeGreaterThan(notStackable.volume())
    stackable.delete()
    notStackable.delete()
  })

  it('clamps corner radius to valid range', () => {
    const params = { ...defaultParams, corner_radius: 100 } // Exceeds limits
    const box = buildBox(M, params)
    expectValid(box)
    box.delete()
  })

  it('matches geometry snapshot', () => {
    const box = buildBox(M, defaultParams)
    expect(getGeometryFingerprint(box)).toMatchSnapshot()
    box.delete()
  })
})

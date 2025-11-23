import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildGridfinityBin } from './gridfinityBuilder'

describe('gridfinityBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    grid_x: 2, grid_y: 2, grid_z: 3,
    lip_style: 'normal', enable_magnets: false, enable_screws: false,
    dividers_x: 0, dividers_y: 0, finger_slide: false
  }

  it('generates valid geometry with default params', () => {
    const bin = buildGridfinityBin(M, defaultParams)
    expectValid(bin)
    bin.delete()
  })

  it('respects grid unit dimensions (42mm pitch)', () => {
    const bin = buildGridfinityBin(M, { ...defaultParams, grid_x: 1, grid_y: 1 })
    // 1x1 bin should be ~42mm - tolerance
    expectDimensions(bin, { width: 41.5, depth: 41.5 })
    bin.delete()
  })

  it('generates magnet holes when enabled', () => {
    const withMagnets = buildGridfinityBin(M, { ...defaultParams, enable_magnets: true })
    const noMagnets = buildGridfinityBin(M, { ...defaultParams, enable_magnets: false })
    expect(withMagnets.volume()).toBeLessThan(noMagnets.volume())
    withMagnets.delete()
    noMagnets.delete()
  })

  it('generates screw holes when enabled', () => {
    const withScrews = buildGridfinityBin(M, { ...defaultParams, enable_screws: true })
    const noScrews = buildGridfinityBin(M, { ...defaultParams, enable_screws: false })
    expect(withScrews.volume()).toBeLessThan(noScrews.volume())
    withScrews.delete()
    noScrews.delete()
  })

  it('generates dividers when specified', () => {
    const withDividers = buildGridfinityBin(M, { ...defaultParams, dividers_x: 1, dividers_y: 1 })
    const noDividers = buildGridfinityBin(M, { ...defaultParams, dividers_x: 0, dividers_y: 0 })
    expect(withDividers.volume()).toBeGreaterThan(noDividers.volume())
    withDividers.delete()
    noDividers.delete()
  })

  it('handles different lip styles', () => {
    for (const style of ['normal', 'reduced', 'minimum', 'none']) {
      const bin = buildGridfinityBin(M, { ...defaultParams, lip_style: style })
      expectValid(bin)
      bin.delete()
    }
  })

  it('handles minimum 1x1x1 bin', () => {
    const bin = buildGridfinityBin(M, { ...defaultParams, grid_x: 1, grid_y: 1, grid_z: 1 })
    expectValid(bin)
    bin.delete()
  })

  it('matches geometry snapshot', () => {
    const bin = buildGridfinityBin(M, defaultParams)
    expect(getGeometryFingerprint(bin)).toMatchSnapshot()
    bin.delete()
  })
})

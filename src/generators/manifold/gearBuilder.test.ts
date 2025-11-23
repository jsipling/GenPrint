import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildGear } from './gearBuilder'

describe('gearBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    teeth: 20, module: 2, height: 10,
    bore_diameter: 8, pressure_angle: 20,
    tolerance: 0.1, tip_sharpness: 0.1,
    include_hub: false, hub_diameter: 20, hub_height: 5
  }

  it('generates valid geometry with default params', () => {
    const gear = buildGear(M, defaultParams)
    expectValid(gear)
    gear.delete()
  })

  it('generates more teeth with higher count', () => {
    const gear20 = buildGear(M, { ...defaultParams, teeth: 20 })
    const gear30 = buildGear(M, { ...defaultParams, teeth: 30 })
    // More teeth = larger gear = more volume
    expect(gear30.volume()).toBeGreaterThan(gear20.volume())
    gear20.delete()
    gear30.delete()
  })

  it('generates hub when enabled', () => {
    const withHub = buildGear(M, { ...defaultParams, include_hub: true })
    const noHub = buildGear(M, { ...defaultParams, include_hub: false })
    expect(withHub.volume()).toBeGreaterThan(noHub.volume())
    withHub.delete()
    noHub.delete()
  })

  it('clamps bore diameter to safe value', () => {
    const gear = buildGear(M, { ...defaultParams, bore_diameter: 100 }) // Too large
    expectValid(gear)
    gear.delete()
  })

  it('handles minimum teeth count', () => {
    const gear = buildGear(M, { ...defaultParams, teeth: 8 })
    expectValid(gear)
    gear.delete()
  })

  it('handles solid gear (no bore)', () => {
    const gear = buildGear(M, { ...defaultParams, bore_diameter: 0 })
    expectValid(gear)
    gear.delete()
  })

  it('matches geometry snapshot', () => {
    const gear = buildGear(M, defaultParams)
    expect(getGeometryFingerprint(gear)).toMatchSnapshot()
    gear.delete()
  })
})

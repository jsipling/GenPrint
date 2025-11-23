import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildThumbKnob } from './thumbKnobBuilder'

describe('thumbKnobBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    screw_size: 'M5', knob_diameter: 25, height: 12, style: 'Knurled', tolerance: 0.2
  }

  it('generates valid geometry with default params', () => {
    const knob = buildThumbKnob(M, defaultParams)
    expectValid(knob)
    knob.delete()
  })

  it('generates knurled style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Knurled' })
    expectValid(knob)
    knob.delete()
  })

  it('generates lobed style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Lobed' })
    expectValid(knob)
    knob.delete()
  })

  it('generates hexagonal style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Hexagonal' })
    expectValid(knob)
    knob.delete()
  })

  it('handles different screw sizes', () => {
    for (const size of ['M3', 'M4', 'M5', 'M6', 'M8']) {
      const knob = buildThumbKnob(M, { ...defaultParams, screw_size: size })
      expectValid(knob)
      knob.delete()
    }
  })

  it('enforces minimum knob diameter for hex socket', () => {
    // Small knob should still produce valid geometry (clamped internally)
    const knob = buildThumbKnob(M, { ...defaultParams, knob_diameter: 10 })
    expectValid(knob)
    knob.delete()
  })

  it('matches geometry snapshot', () => {
    const knob = buildThumbKnob(M, defaultParams)
    expect(getGeometryFingerprint(knob)).toMatchSnapshot()
    knob.delete()
  })
})

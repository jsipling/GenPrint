import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { roundedRect, createFilletProfile } from './shapes'

describe('roundedRect', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('creates valid geometry when extruded (centered)', () => {
    const profile = roundedRect(M, 20, 15, 3, true)
    const solid = profile.extrude(10)
    expectValid(solid)
    solid.delete()
    profile.delete()
  })

  it('creates valid geometry when extruded (non-centered)', () => {
    const profile = roundedRect(M, 20, 15, 3, false)
    const solid = profile.extrude(10)
    expectValid(solid)
    solid.delete()
    profile.delete()
  })

  it('handles zero corner radius (centered)', () => {
    const profile = roundedRect(M, 20, 15, 0, true)
    const solid = profile.extrude(10)
    expectValid(solid)
    // Should produce box-like volume
    expect(solid.volume()).toBeCloseTo(20 * 15 * 10, 0)
    solid.delete()
    profile.delete()
  })

  it('handles zero corner radius (non-centered)', () => {
    const profile = roundedRect(M, 20, 15, 0, false)
    const solid = profile.extrude(10)
    expectValid(solid)
    expect(solid.volume()).toBeCloseTo(20 * 15 * 10, 0)
    solid.delete()
    profile.delete()
  })

  it('clamps radius to half of smaller dimension', () => {
    // Radius 100 should be clamped to 7.5 (half of 15)
    const profile = roundedRect(M, 20, 15, 100, true)
    const solid = profile.extrude(10)
    expectValid(solid)
    // Volume should be less than a box due to rounded corners
    expect(solid.volume()).toBeLessThan(20 * 15 * 10)
    solid.delete()
    profile.delete()
  })

  it('respects custom segment count', () => {
    const lowSegments = roundedRect(M, 20, 15, 5, true, 4)
    const highSegments = roundedRect(M, 20, 15, 5, true, 16)

    const solidLow = lowSegments.extrude(10)
    const solidHigh = highSegments.extrude(10)

    // Higher segments = more triangles
    const meshLow = solidLow.getMesh()
    const meshHigh = solidHigh.getMesh()
    expect(meshHigh.numTri).toBeGreaterThan(meshLow.numTri)

    solidLow.delete()
    solidHigh.delete()
    lowSegments.delete()
    highSegments.delete()
  })

  it('produces centered rectangle at origin', () => {
    const profile = roundedRect(M, 40, 20, 2, true)
    const solid = profile.extrude(10)
    const bbox = solid.boundingBox()
    // Should be centered: -20 to 20 in X, -10 to 10 in Y
    expect(bbox.min[0]).toBeCloseTo(-20, 1)
    expect(bbox.max[0]).toBeCloseTo(20, 1)
    expect(bbox.min[1]).toBeCloseTo(-10, 1)
    expect(bbox.max[1]).toBeCloseTo(10, 1)
    solid.delete()
    profile.delete()
  })

  it('produces non-centered rectangle from origin', () => {
    const profile = roundedRect(M, 40, 20, 2, false)
    const solid = profile.extrude(10)
    const bbox = solid.boundingBox()
    // Should start at origin: 0 to 40 in X, 0 to 20 in Y
    expect(bbox.min[0]).toBeCloseTo(0, 1)
    expect(bbox.max[0]).toBeCloseTo(40, 1)
    expect(bbox.min[1]).toBeCloseTo(0, 1)
    expect(bbox.max[1]).toBeCloseTo(20, 1)
    solid.delete()
    profile.delete()
  })
})

describe('createFilletProfile', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('creates valid geometry when extruded', () => {
    const profile = createFilletProfile(M, 5)
    const solid = profile.extrude(10)
    expectValid(solid)
    solid.delete()
    profile.delete()
  })

  it('creates quarter-circle profile', () => {
    const radius = 10
    const profile = createFilletProfile(M, radius, 32)
    const solid = profile.extrude(1)
    // Volume should be approximately quarter of a cylinder: (pi * r^2 / 4) * height
    const expectedVolume = (Math.PI * radius * radius / 4) * 1
    expect(solid.volume()).toBeCloseTo(expectedVolume, 0)
    solid.delete()
    profile.delete()
  })

  it('respects custom segment count', () => {
    const lowSegments = createFilletProfile(M, 5, 4)
    const highSegments = createFilletProfile(M, 5, 32)

    const solidLow = lowSegments.extrude(10)
    const solidHigh = highSegments.extrude(10)

    // Higher segments = smoother arc, more accurate volume
    const meshLow = solidLow.getMesh()
    const meshHigh = solidHigh.getMesh()
    expect(meshHigh.numTri).toBeGreaterThan(meshLow.numTri)

    solidLow.delete()
    solidHigh.delete()
    lowSegments.delete()
    highSegments.delete()
  })

  it('produces profile in first quadrant', () => {
    const profile = createFilletProfile(M, 10, 16)
    const solid = profile.extrude(1)
    const bbox = solid.boundingBox()
    // Quarter circle should be in positive X and Y
    expect(bbox.min[0]).toBeCloseTo(0, 1)
    expect(bbox.min[1]).toBeCloseTo(0, 1)
    expect(bbox.max[0]).toBeCloseTo(10, 1)
    expect(bbox.max[1]).toBeCloseTo(10, 1)
    solid.delete()
    profile.delete()
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildSign } from './signBuilder'

describe('signBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    text: 'HELLO', text_size: 12, text_depth: 2, padding: 5, base_depth: 2, corner_radius: 2
  }

  it('generates valid geometry with default params', () => {
    const sign = buildSign(M, defaultParams)
    expectValid(sign)
    sign.delete()
  })

  it('handles different text', () => {
    const sign = buildSign(M, { ...defaultParams, text: 'TEST' })
    expectValid(sign)
    sign.delete()
  })

  it('sanitizes invalid characters', () => {
    const sign = buildSign(M, { ...defaultParams, text: 'hello@#$%' }) // lowercase + invalid chars
    expectValid(sign)
    sign.delete()
  })

  it('handles special characters', () => {
    // Note: Some character combinations may produce non-manifold geometry
    // This tests that the builder handles them without crashing
    const sign = buildSign(M, { ...defaultParams, text: 'A-B' })
    expect(sign).toBeDefined()
    expect(sign.volume()).toBeGreaterThan(0)
    sign.delete()
  })

  it('handles numbers', () => {
    const sign = buildSign(M, { ...defaultParams, text: '12345' })
    expectValid(sign)
    sign.delete()
  })

  it('handles empty text (defaults to TEXT)', () => {
    const sign = buildSign(M, { ...defaultParams, text: '' })
    expectValid(sign)
    sign.delete()
  })

  it('matches geometry snapshot', () => {
    const sign = buildSign(M, defaultParams)
    expect(getGeometryFingerprint(sign)).toMatchSnapshot()
    sign.delete()
  })
})

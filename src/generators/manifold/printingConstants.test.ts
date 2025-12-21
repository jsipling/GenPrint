import { describe, it, expect } from 'vitest'
import {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  MIN_FEATURE_SIZE,
  COMPARISON_TOLERANCE,
  BUILDER_RESERVED_CONSTANTS
} from './printingConstants'

describe('printingConstants', () => {
  it('MIN_WALL_THICKNESS is 1.2mm', () => {
    expect(MIN_WALL_THICKNESS).toBe(1.2)
  })

  it('MIN_SMALL_FEATURE is 1.5mm', () => {
    expect(MIN_SMALL_FEATURE).toBe(1.5)
  })

  it('MIN_FEATURE_SIZE is alias for MIN_SMALL_FEATURE', () => {
    expect(MIN_FEATURE_SIZE).toBe(MIN_SMALL_FEATURE)
  })

  it('COMPARISON_TOLERANCE is 0.01mm', () => {
    expect(COMPARISON_TOLERANCE).toBe(0.01)
  })

  it('BUILDER_RESERVED_CONSTANTS lists constants passed to builder code', () => {
    expect(BUILDER_RESERVED_CONSTANTS).toContain('MIN_WALL_THICKNESS')
    expect(BUILDER_RESERVED_CONSTANTS).toContain('MIN_FEATURE_SIZE')
  })
})

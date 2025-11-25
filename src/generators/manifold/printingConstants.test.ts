import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  CORNER_SEGMENTS_PER_90,
  HOLE_CYLINDER_SEGMENTS,
  VERTEX_PRECISION,
  COMPARISON_TOLERANCE,
  safeWallThickness,
  maxInnerDiameter,
  printingWarning
} from './printingConstants'

describe('printingConstants', () => {
  describe('constants', () => {
    it('MIN_WALL_THICKNESS is 1.2mm per AGENTS.md', () => {
      expect(MIN_WALL_THICKNESS).toBe(1.2)
    })

    it('MIN_SMALL_FEATURE is 1.5mm per AGENTS.md', () => {
      expect(MIN_SMALL_FEATURE).toBe(1.5)
    })

    it('CORNER_SEGMENTS_PER_90 is 8 per AGENTS.md', () => {
      expect(CORNER_SEGMENTS_PER_90).toBe(8)
    })

    it('HOLE_CYLINDER_SEGMENTS is 16 per AGENTS.md', () => {
      expect(HOLE_CYLINDER_SEGMENTS).toBe(16)
    })

    it('VERTEX_PRECISION is 0.001mm per AGENTS.md', () => {
      expect(VERTEX_PRECISION).toBe(0.001)
    })

    it('COMPARISON_TOLERANCE is 0.01mm per AGENTS.md', () => {
      expect(COMPARISON_TOLERANCE).toBe(0.01)
    })
  })

  describe('safeWallThickness', () => {
    it('returns requested thickness when above minimum', () => {
      expect(safeWallThickness(2.0)).toBe(2.0)
      expect(safeWallThickness(5.0)).toBe(5.0)
    })

    it('clamps to MIN_WALL_THICKNESS when below', () => {
      expect(safeWallThickness(0.5)).toBe(MIN_WALL_THICKNESS)
      expect(safeWallThickness(1.0)).toBe(MIN_WALL_THICKNESS)
    })

    it('returns exactly MIN_WALL_THICKNESS at boundary', () => {
      expect(safeWallThickness(1.2)).toBe(1.2)
    })

    it('respects maxByGeometry constraint', () => {
      expect(safeWallThickness(5.0, 3.0)).toBe(3.0)
      expect(safeWallThickness(5.0, 10.0)).toBe(5.0)
    })

    it('prioritizes MIN_WALL_THICKNESS over maxByGeometry', () => {
      // Even if maxByGeometry is below minimum, clamp to minimum
      expect(safeWallThickness(0.5, 0.8)).toBe(MIN_WALL_THICKNESS)
    })
  })

  describe('maxInnerDiameter', () => {
    it('calculates correct inner diameter leaving minimum walls', () => {
      // 20mm outer - 2.4mm (1.2mm * 2 walls) = 17.6mm max inner
      expect(maxInnerDiameter(20)).toBe(17.6)
    })

    it('returns 0 for outer diameter at or below minimum', () => {
      // 2.4mm outer - 2.4mm walls = 0
      expect(maxInnerDiameter(2.4)).toBe(0)
    })

    it('returns negative for impossible geometries', () => {
      // This is technically correct math - caller should handle
      expect(maxInnerDiameter(2)).toBeLessThan(0)
    })
  })

  describe('printingWarning', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
    })

    it('logs warning with component prefix in dev mode', () => {
      // In test environment, DEV is typically true
      printingWarning('TestComponent', 'Test message')

      if (import.meta.env.DEV) {
        expect(consoleWarnSpy).toHaveBeenCalledWith('[TestComponent] Test message')
      }
    })

    it('formats message correctly', () => {
      printingWarning('Spacer', 'Wall thickness too thin')

      if (import.meta.env.DEV) {
        expect(consoleWarnSpy).toHaveBeenCalledWith('[Spacer] Wall thickness too thin')
      }
    })
  })
})

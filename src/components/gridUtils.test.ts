import { describe, it, expect } from 'vitest'
import {
  calculateTicksAndLabels,
  calculateGridParams,
  TICK_SIZE,
  SMALL_TICK_SIZE,
  MAX_TICKS_PER_AXIS,
  DEFAULT_GRID_SIZE
} from './gridUtils'

describe('gridUtils', () => {
  describe('calculateTicksAndLabels', () => {
    it('returns tick and label arrays', () => {
      const result = calculateTicksAndLabels(100)
      expect(result.ticks).toBeInstanceOf(Array)
      expect(result.labels).toBeInstanceOf(Array)
    })

    it('generates ticks for all three axes', () => {
      const result = calculateTicksAndLabels(100)

      // Check for X axis ticks (red)
      const xTicks = result.ticks.filter(t => t.color === '#ff4444')
      expect(xTicks.length).toBeGreaterThan(0)

      // Check for Y axis ticks (green)
      const yTicks = result.ticks.filter(t => t.color === '#44ff44')
      expect(yTicks.length).toBeGreaterThan(0)

      // Check for Z axis ticks (blue)
      const zTicks = result.ticks.filter(t => t.color === '#4444ff')
      expect(zTicks.length).toBeGreaterThan(0)
    })

    it('uses larger tick size for 10mm intervals', () => {
      const result = calculateTicksAndLabels(100)

      // Find a tick at 10mm position on X axis
      const tickAt10 = result.ticks.find(t =>
        t.color === '#ff4444' && t.points[0][0] === 10
      )
      expect(tickAt10).toBeDefined()
      // 10mm tick should use TICK_SIZE
      expect(Math.abs(tickAt10!.points[1][1] - tickAt10!.points[0][1])).toBeCloseTo(TICK_SIZE * 2, 5)
    })

    it('uses smaller tick size for 5mm intervals', () => {
      const result = calculateTicksAndLabels(100)

      // Find a tick at 5mm position on X axis
      const tickAt5 = result.ticks.find(t =>
        t.color === '#ff4444' && t.points[0][0] === 5
      )
      expect(tickAt5).toBeDefined()
      // 5mm tick should use SMALL_TICK_SIZE
      expect(Math.abs(tickAt5!.points[1][1] - tickAt5!.points[0][1])).toBeCloseTo(SMALL_TICK_SIZE * 2, 5)
    })

    it('generates labels at appropriate intervals', () => {
      const result = calculateTicksAndLabels(100)
      expect(result.labels.length).toBeGreaterThan(0)

      // All labels should have text containing numbers
      for (const label of result.labels) {
        expect(label.text).toMatch(/^\d+$/)
      }
    })

    it('returns tick interval in result', () => {
      const result = calculateTicksAndLabels(100)
      expect(result.tickInterval).toBeDefined()
      expect(result.tickInterval).toBeGreaterThan(0)
    })

    it('returns effective label interval in result', () => {
      const result = calculateTicksAndLabels(100)
      expect(result.effectiveLabelInterval).toBeDefined()
      expect(result.effectiveLabelInterval).toBeGreaterThanOrEqual(result.tickInterval)
    })

    it('uses larger label intervals for larger grids', () => {
      const smallGrid = calculateTicksAndLabels(100)
      const largeGrid = calculateTicksAndLabels(1000)

      expect(largeGrid.effectiveLabelInterval).toBeGreaterThan(smallGrid.effectiveLabelInterval)
    })

    it('increases tick interval for very large models to limit tick count', () => {
      // A very large grid should have tick interval > 5mm
      const veryLargeSize = MAX_TICKS_PER_AXIS * 10 * 2 // Large enough to exceed max ticks
      const result = calculateTicksAndLabels(veryLargeSize)

      expect(result.tickInterval).toBeGreaterThan(5)
    })

    it('handles edge case of zero size', () => {
      const result = calculateTicksAndLabels(0)
      // Should return empty arrays for zero-sized grid
      expect(result.ticks.length).toBe(0)
      expect(result.labels.length).toBe(0)
    })
  })

  describe('calculateGridParams', () => {
    it('returns gridRange, gridSize, and gridDivisions', () => {
      const result = calculateGridParams(100)
      expect(result).toHaveProperty('gridRange')
      expect(result).toHaveProperty('gridSize')
      expect(result).toHaveProperty('gridDivisions')
    })

    it('uses default grid size for small models', () => {
      const result = calculateGridParams(50)
      expect(result.gridRange).toBe(DEFAULT_GRID_SIZE)
      expect(result.gridSize).toBe(DEFAULT_GRID_SIZE * 2)
    })

    it('scales grid range for large models', () => {
      const result = calculateGridParams(500)
      expect(result.gridRange).toBeGreaterThanOrEqual(500)
    })

    it('rounds grid range to nearest 10mm', () => {
      const result = calculateGridParams(537)
      // Should round up to at least 540
      expect(result.gridRange % 10).toBe(0)
      expect(result.gridRange).toBeGreaterThanOrEqual(540)
    })

    it('calculates correct grid divisions (10mm per division)', () => {
      const result = calculateGridParams(100)
      expect(result.gridDivisions).toBe(result.gridSize / 10)
    })

    it('gridSize is double the gridRange (centered grid)', () => {
      const result = calculateGridParams(200)
      expect(result.gridSize).toBe(result.gridRange * 2)
    })
  })

  describe('exported constants', () => {
    it('TICK_SIZE is defined and reasonable', () => {
      expect(TICK_SIZE).toBeGreaterThan(0)
      expect(TICK_SIZE).toBeLessThan(10) // Should be small
    })

    it('SMALL_TICK_SIZE is smaller than TICK_SIZE', () => {
      expect(SMALL_TICK_SIZE).toBeLessThan(TICK_SIZE)
    })

    it('MAX_TICKS_PER_AXIS is reasonable', () => {
      expect(MAX_TICKS_PER_AXIS).toBeGreaterThan(10)
      expect(MAX_TICKS_PER_AXIS).toBeLessThanOrEqual(200)
    })

    it('DEFAULT_GRID_SIZE is reasonable for 3D printing', () => {
      // Most 3D printers have bed sizes around 200-400mm
      expect(DEFAULT_GRID_SIZE).toBeGreaterThanOrEqual(100)
      expect(DEFAULT_GRID_SIZE).toBeLessThanOrEqual(1000)
    })
  })
})

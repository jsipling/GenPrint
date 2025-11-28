import { describe, it, expect } from 'vitest'
import { formatOutput, sortIssuesByCoordinate, roundNumber } from '../outputFormatter'
import type { AnalysisResult, ThinWallIssue } from '../types'

describe('outputFormatter', () => {
  describe('roundNumber', () => {
    it('rounds to 3 decimal places by default', () => {
      expect(roundNumber(1.23456789)).toBe(1.235)
      expect(roundNumber(0.0001)).toBe(0)
      expect(roundNumber(1.9999)).toBe(2)
    })

    it('handles whole numbers cleanly', () => {
      expect(roundNumber(5.0)).toBe(5)
      expect(roundNumber(100.0)).toBe(100)
    })

    it('handles negative numbers', () => {
      expect(roundNumber(-1.23456)).toBe(-1.235)
      expect(roundNumber(-0.0001)).toBe(0)
    })
  })

  describe('sortIssuesByCoordinate', () => {
    it('sorts thin wall issues by X, then Y, then Z', () => {
      const issues: ThinWallIssue[] = [
        { measured: 1, required: 1.2, bbox: { min: [10, 0, 0], max: [15, 5, 5] }, axisAlignment: 'X', estimatedVolume: 10 },
        { measured: 1, required: 1.2, bbox: { min: [0, 0, 0], max: [5, 5, 5] }, axisAlignment: 'X', estimatedVolume: 10 },
        { measured: 1, required: 1.2, bbox: { min: [0, 10, 0], max: [5, 15, 5] }, axisAlignment: 'Y', estimatedVolume: 10 },
        { measured: 1, required: 1.2, bbox: { min: [0, 0, 10], max: [5, 5, 15] }, axisAlignment: 'Z', estimatedVolume: 10 },
      ]

      const sorted = sortIssuesByCoordinate(issues)

      expect(sorted[0]!.bbox.min).toEqual([0, 0, 0])
      expect(sorted[1]!.bbox.min).toEqual([0, 0, 10])
      expect(sorted[2]!.bbox.min).toEqual([0, 10, 0])
      expect(sorted[3]!.bbox.min).toEqual([10, 0, 0])
    })

    it('returns empty array for empty input', () => {
      expect(sortIssuesByCoordinate([])).toEqual([])
    })
  })

  describe('formatOutput', () => {
    it('produces deterministic JSON for identical input', () => {
      const result: AnalysisResult = {
        status: 'PASS',
        stats: {
          volume: 1000,
          surfaceArea: 600,
          bbox: { min: [0, 0, 0], max: [10, 10, 10] },
          centerOfMass: [5, 5, 5],
          triangleCount: 12,
        },
        issues: {
          thinWalls: [],
          smallFeatures: [],
          disconnected: null,
        },
        parameterCorrelations: [],
      }

      const output1 = formatOutput(result)
      const output2 = formatOutput(result)

      expect(output1).toBe(output2)
    })

    it('sorts thin wall issues in output', () => {
      const result: AnalysisResult = {
        status: 'FAIL',
        stats: {
          volume: 1000,
          surfaceArea: 600,
          bbox: { min: [0, 0, 0], max: [10, 10, 10] },
          centerOfMass: [5, 5, 5],
          triangleCount: 12,
        },
        issues: {
          thinWalls: [
            { measured: 0.9, required: 1.2, bbox: { min: [10, 0, 0], max: [15, 5, 5] }, axisAlignment: 'X', estimatedVolume: 10 },
            { measured: 0.8, required: 1.2, bbox: { min: [0, 0, 0], max: [5, 5, 5] }, axisAlignment: 'X', estimatedVolume: 10 },
          ],
          smallFeatures: [],
          disconnected: null,
        },
        parameterCorrelations: [],
      }

      const output = formatOutput(result)
      const parsed = JSON.parse(output)

      expect(parsed.issues.thinWalls[0].bbox.min[0]).toBe(0)
      expect(parsed.issues.thinWalls[1].bbox.min[0]).toBe(10)
    })

    it('sorts small feature issues in output', () => {
      const result: AnalysisResult = {
        status: 'FAIL',
        stats: {
          volume: 1000,
          surfaceArea: 600,
          bbox: { min: [0, 0, 0], max: [10, 10, 10] },
          centerOfMass: [5, 5, 5],
          triangleCount: 12,
        },
        issues: {
          thinWalls: [],
          smallFeatures: [
            { size: 1, required: 1.5, bbox: { min: [20, 0, 0], max: [21, 1, 1] }, axisAlignment: 'X' },
            { size: 0.5, required: 1.5, bbox: { min: [0, 0, 0], max: [0.5, 0.5, 0.5] }, axisAlignment: 'None' },
          ],
          disconnected: null,
        },
        parameterCorrelations: [],
      }

      const output = formatOutput(result)
      const parsed = JSON.parse(output)

      expect(parsed.issues.smallFeatures[0].bbox.min[0]).toBe(0)
      expect(parsed.issues.smallFeatures[1].bbox.min[0]).toBe(20)
    })

    it('rounds floating point numbers', () => {
      const result: AnalysisResult = {
        status: 'PASS',
        stats: {
          volume: 1000.123456789,
          surfaceArea: 600.987654321,
          bbox: { min: [0.111111, 0.222222, 0.333333], max: [10.444444, 10.555555, 10.666666] },
          centerOfMass: [5.777777, 5.888888, 5.999999],
          triangleCount: 12,
        },
        issues: {
          thinWalls: [],
          smallFeatures: [],
          disconnected: null,
        },
        parameterCorrelations: [],
      }

      const output = formatOutput(result)
      const parsed = JSON.parse(output)

      expect(parsed.stats.volume).toBe(1000.123)
      expect(parsed.stats.surfaceArea).toBe(600.988)
      expect(parsed.stats.bbox.min[0]).toBe(0.111)
      expect(parsed.stats.centerOfMass[2]).toBe(6)
    })

    it('produces valid JSON for error status', () => {
      const result: AnalysisResult = {
        status: 'ERROR',
        stats: null,
        issues: null,
        parameterCorrelations: null,
        error: {
          type: 'GEOMETRY_CRASH',
          message: 'Boolean operation failed',
          recoverable: false,
        },
      }

      const output = formatOutput(result)
      expect(() => JSON.parse(output)).not.toThrow()

      const parsed = JSON.parse(output)
      expect(parsed.status).toBe('ERROR')
      expect(parsed.stats).toBeNull()
      expect(parsed.error.type).toBe('GEOMETRY_CRASH')
    })

    it('handles disconnected issues', () => {
      const result: AnalysisResult = {
        status: 'FAIL',
        stats: {
          volume: 2000,
          surfaceArea: 1200,
          bbox: { min: [0, 0, 0], max: [20, 10, 10] },
          centerOfMass: [10, 5, 5],
          triangleCount: 24,
        },
        issues: {
          thinWalls: [],
          smallFeatures: [],
          disconnected: {
            componentCount: 2,
            components: [
              { volume: 1000, bbox: { min: [0, 0, 0], max: [10, 10, 10] }, isFloating: false },
              { volume: 1000, bbox: { min: [15, 0, 0], max: [20, 10, 10] }, isFloating: true },
            ],
          },
        },
        parameterCorrelations: [],
      }

      const output = formatOutput(result)
      const parsed = JSON.parse(output)

      expect(parsed.issues.disconnected.componentCount).toBe(2)
      expect(parsed.issues.disconnected.components).toHaveLength(2)
    })

    it('sorts parameter correlations by issue count', () => {
      const result: AnalysisResult = {
        status: 'FAIL',
        stats: {
          volume: 1000,
          surfaceArea: 600,
          bbox: { min: [0, 0, 0], max: [10, 10, 10] },
          centerOfMass: [5, 5, 5],
          triangleCount: 12,
        },
        issues: {
          thinWalls: [],
          smallFeatures: [],
          disconnected: null,
        },
        parameterCorrelations: [
          {
            parameterName: 'featureSize',
            currentValue: 1,
            correlatedIssueCount: 2,
            correlatedIssueTypes: ['smallFeatures'],
            suggestion: { action: 'increase', targetValue: 1.5, confidence: 'medium', reasoning: 'test' },
          },
          {
            parameterName: 'wallThickness',
            currentValue: 1,
            correlatedIssueCount: 5,
            correlatedIssueTypes: ['thinWalls'],
            suggestion: { action: 'increase', targetValue: 1.2, confidence: 'high', reasoning: 'test' },
          },
        ],
      }

      const output = formatOutput(result)
      const parsed = JSON.parse(output)

      expect(parsed.parameterCorrelations[0].parameterName).toBe('wallThickness')
      expect(parsed.parameterCorrelations[1].parameterName).toBe('featureSize')
    })
  })
})

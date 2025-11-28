import { describe, it, expect } from 'vitest'
import { correlateParameters } from '../parameterCorrelator'
import type { Issues } from '../types'
import type { ParameterDef } from '../../generators/types'
import { MIN_WALL_THICKNESS, MIN_SMALL_FEATURE } from '../../generators/manifold/printingConstants'

describe('parameterCorrelator', () => {
  // Helper to create minimal parameter definitions
  const createNumberParam = (name: string, value: number): ParameterDef => ({
    type: 'number' as const,
    name,
    label: name,
    min: 0,
    max: 100,
    default: value,
  })

  describe('thin wall correlations', () => {
    it('correlates thickness parameters to thin wall issues', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.8,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.8, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 80,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('wallThickness', 1.0)]

      const values: Record<string, number> = { wallThickness: 1.0 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.parameterName).toBe('wallThickness')
      expect(result[0]!.correlatedIssueTypes).toContain('thinWalls')
      expect(result[0]!.suggestion.action).toBe('increase')
    })

    it('correlates parameters with "wall" in the name', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.8,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.8, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 80,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('outerWall', 1.0)]

      const values: Record<string, number> = { outerWall: 1.0 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.parameterName).toBe('outerWall')
    })

    it('correlates parameters with "Width" in the name', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.8,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.8, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 80,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('ribWidth', 1.0)]

      const values: Record<string, number> = { ribWidth: 1.0 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.parameterName).toBe('ribWidth')
    })
  })

  describe('small feature correlations', () => {
    it('correlates size parameters to small feature issues', () => {
      const issues: Issues = {
        thinWalls: [],
        smallFeatures: [
          {
            size: 1.0,
            required: MIN_SMALL_FEATURE,
            bbox: { min: [0, 0, 0], max: [1, 1, 1] },
            axisAlignment: 'None',
          },
        ],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('featureSize', 1.0)]

      const values: Record<string, number> = { featureSize: 1.0 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.parameterName).toBe('featureSize')
      expect(result[0]!.correlatedIssueTypes).toContain('smallFeatures')
      expect(result[0]!.suggestion.action).toBe('increase')
    })

    it('correlates parameters with "radius" in the name', () => {
      const issues: Issues = {
        thinWalls: [],
        smallFeatures: [
          {
            size: 1.0,
            required: MIN_SMALL_FEATURE,
            bbox: { min: [0, 0, 0], max: [1, 1, 1] },
            axisAlignment: 'None',
          },
        ],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('pinRadius', 0.5)]

      const values: Record<string, number> = { pinRadius: 0.5 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.parameterName).toBe('pinRadius')
    })
  })

  describe('no issues', () => {
    it('returns empty array when no issues', () => {
      const issues: Issues = {
        thinWalls: [],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('wallThickness', 2.0)]

      const values: Record<string, number> = { wallThickness: 2.0 }

      const result = correlateParameters(issues, params, values)

      expect(result).toEqual([])
    })
  })

  describe('suggestion confidence', () => {
    it('sets high confidence for parameters well below threshold', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.5,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.5, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 50,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('wallThickness', 0.5)]

      const values: Record<string, number> = { wallThickness: 0.5 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.suggestion.confidence).toBe('high')
    })

    it('sets medium confidence for parameters near threshold', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 1.1,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [1.1, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 110,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [createNumberParam('wallThickness', 1.1)]

      const values: Record<string, number> = { wallThickness: 1.1 }

      const result = correlateParameters(issues, params, values)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.suggestion.confidence).toBe('medium')
    })
  })

  describe('sorting', () => {
    it('sorts correlations by issue count descending', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.8,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.8, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 80,
          },
          {
            measured: 0.9,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [10, 0, 0], max: [10.9, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 90,
          },
        ],
        smallFeatures: [
          {
            size: 1.0,
            required: MIN_SMALL_FEATURE,
            bbox: { min: [20, 0, 0], max: [21, 1, 1] },
            axisAlignment: 'None',
          },
        ],
        disconnected: null,
      }

      const params: ParameterDef[] = [
        createNumberParam('wallThickness', 1.0),
        createNumberParam('featureSize', 1.0),
      ]

      const values: Record<string, number> = { wallThickness: 1.0, featureSize: 1.0 }

      const result = correlateParameters(issues, params, values)

      // wallThickness should come first as it correlates with 2 issues
      expect(result[0]!.parameterName).toBe('wallThickness')
      expect(result[0]!.correlatedIssueCount).toBe(2)
    })
  })

  describe('non-number parameters', () => {
    it('skips non-number parameters', () => {
      const issues: Issues = {
        thinWalls: [
          {
            measured: 0.8,
            required: MIN_WALL_THICKNESS,
            bbox: { min: [0, 0, 0], max: [0.8, 10, 10] },
            axisAlignment: 'X',
            estimatedVolume: 80,
          },
        ],
        smallFeatures: [],
        disconnected: null,
      }

      const params: ParameterDef[] = [
        {
          type: 'string' as const,
          name: 'wallThickness',
          label: 'Wall Thickness',
          default: '1.0',
        },
      ]

      const values: Record<string, number | string | boolean> = { wallThickness: '1.0' }

      const result = correlateParameters(issues, params, values as Record<string, number>)

      expect(result).toEqual([])
    })
  })
})

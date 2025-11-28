/**
 * Parameter correlator for mapping printability issues to input parameters.
 * Helps agents identify which parameters to adjust to fix issues.
 */

import type { Issues, ParameterCorrelation, ParameterSuggestion } from './types'
import type { ParameterDef } from '../generators/types'
import { isNumberParam } from '../generators/types'
import { MIN_WALL_THICKNESS, MIN_SMALL_FEATURE } from '../generators/manifold/printingConstants'

/**
 * Patterns for matching parameter names to issue types.
 */
const THICKNESS_PATTERNS = ['thickness', 'wall', 'Width']
const SIZE_PATTERNS = ['size', 'radius', 'diameter', 'feature', 'detail']

/**
 * Check if a parameter name matches any of the given patterns.
 */
function matchesPatterns(name: string, patterns: string[]): boolean {
  const lowerName = name.toLowerCase()
  return patterns.some((pattern) => lowerName.includes(pattern.toLowerCase()))
}

/**
 * Determine confidence level based on how far the value is from the threshold.
 */
function determineConfidence(currentValue: number, threshold: number): 'high' | 'medium' | 'low' {
  const ratio = currentValue / threshold

  if (ratio < 0.7) {
    return 'high' // Well below threshold - very likely causing issues
  } else if (ratio < 0.95) {
    return 'medium' // Near threshold - likely causing issues
  } else {
    return 'low' // Close to or at threshold - might be causing issues
  }
}

/**
 * Calculate suggested target value.
 */
function calculateTargetValue(threshold: number): number {
  // Suggest 10% above the minimum to provide safety margin
  return Math.ceil(threshold * 1.1 * 10) / 10
}

/**
 * Create a parameter suggestion.
 */
function createSuggestion(
  currentValue: number,
  threshold: number,
  issueDescription: string
): ParameterSuggestion {
  return {
    action: 'increase',
    targetValue: calculateTargetValue(threshold),
    confidence: determineConfidence(currentValue, threshold),
    reasoning: `Current ${currentValue}mm is below minimum ${threshold}mm. ${issueDescription}`,
  }
}

/**
 * Correlate parameters with thin wall issues.
 */
function correlateThinWalls(
  issues: Issues,
  params: ParameterDef[],
  values: Record<string, number>
): ParameterCorrelation[] {
  if (issues.thinWalls.length === 0) {
    return []
  }

  const correlations: ParameterCorrelation[] = []

  // Find parameters that likely control wall thickness
  const thicknessParams = params.filter(
    (p) => isNumberParam(p) && matchesPatterns(p.name, THICKNESS_PATTERNS)
  )

  for (const param of thicknessParams) {
    const currentValue = values[param.name]

    // Only correlate if value is a number and below or near the threshold
    if (typeof currentValue === 'number' && currentValue < MIN_WALL_THICKNESS * 1.2) {
      correlations.push({
        parameterName: param.name,
        currentValue,
        correlatedIssueCount: issues.thinWalls.length,
        correlatedIssueTypes: ['thinWalls'],
        suggestion: createSuggestion(currentValue, MIN_WALL_THICKNESS, 'Walls may be too thin to print.'),
      })
    }
  }

  return correlations
}

/**
 * Correlate parameters with small feature issues.
 */
function correlateSmallFeatures(
  issues: Issues,
  params: ParameterDef[],
  values: Record<string, number>
): ParameterCorrelation[] {
  if (issues.smallFeatures.length === 0) {
    return []
  }

  const correlations: ParameterCorrelation[] = []

  // Find parameters that likely control feature size
  const sizeParams = params.filter(
    (p) => isNumberParam(p) && matchesPatterns(p.name, SIZE_PATTERNS)
  )

  for (const param of sizeParams) {
    const currentValue = values[param.name]

    // Only correlate if value is a number and below or near the threshold
    if (typeof currentValue === 'number' && currentValue < MIN_SMALL_FEATURE * 1.2) {
      correlations.push({
        parameterName: param.name,
        currentValue,
        correlatedIssueCount: issues.smallFeatures.length,
        correlatedIssueTypes: ['smallFeatures'],
        suggestion: createSuggestion(
          currentValue,
          MIN_SMALL_FEATURE,
          'Features may be too small to print reliably.'
        ),
      })
    }
  }

  return correlations
}

/**
 * Correlate detected issues with input parameters.
 *
 * Analyzes parameter names and values to suggest which parameters
 * should be adjusted to fix printability issues.
 *
 * @param issues - Detected printability issues
 * @param params - Generator parameter definitions
 * @param values - Current parameter values
 * @returns Array of parameter correlations sorted by issue count
 */
export function correlateParameters(
  issues: Issues,
  params: ParameterDef[],
  values: Record<string, number>
): ParameterCorrelation[] {
  const correlations: ParameterCorrelation[] = []

  // Correlate thin wall issues
  correlations.push(...correlateThinWalls(issues, params, values))

  // Correlate small feature issues
  correlations.push(...correlateSmallFeatures(issues, params, values))

  // Sort by correlation count (most impactful first)
  return correlations.sort((a, b) => b.correlatedIssueCount - a.correlatedIssueCount)
}

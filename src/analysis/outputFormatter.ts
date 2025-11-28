/**
 * Output formatter for deterministic JSON serialization.
 * Ensures identical input always produces identical output.
 */

import type {
  AnalysisResult,
  ThinWallIssue,
  SmallFeatureIssue,
  BBox,
  GeometryStats,
  Issues,
  ParameterCorrelation,
} from './types'

const DECIMAL_PLACES = 3

/**
 * Round a number to the specified decimal places.
 * Default is 3 decimal places (0.001mm precision).
 * Converts -0 to 0 for deterministic output.
 */
export function roundNumber(value: number, decimals: number = DECIMAL_PLACES): number {
  const factor = Math.pow(10, decimals)
  const result = Math.round(value * factor) / factor
  // Convert -0 to 0 for deterministic output
  return result === 0 ? 0 : result
}

/**
 * Round an array of numbers.
 */
function roundArray(arr: [number, number, number]): [number, number, number] {
  return [roundNumber(arr[0]), roundNumber(arr[1]), roundNumber(arr[2])]
}

/**
 * Round a bounding box.
 */
function roundBBox(bbox: BBox): BBox {
  return {
    min: roundArray(bbox.min),
    max: roundArray(bbox.max),
  }
}

/**
 * Compare function for sorting issues by coordinate (X, then Y, then Z).
 */
function compareByCoordinate(a: { bbox: BBox }, b: { bbox: BBox }): number {
  // Sort by X first
  if (a.bbox.min[0] !== b.bbox.min[0]) {
    return a.bbox.min[0] - b.bbox.min[0]
  }
  // Then by Y
  if (a.bbox.min[1] !== b.bbox.min[1]) {
    return a.bbox.min[1] - b.bbox.min[1]
  }
  // Then by Z
  return a.bbox.min[2] - b.bbox.min[2]
}

/**
 * Sort issues by coordinate for deterministic output.
 * Sorted by X, then Y, then Z of the minimum bounding box corner.
 */
export function sortIssuesByCoordinate<T extends { bbox: BBox }>(issues: T[]): T[] {
  return [...issues].sort(compareByCoordinate)
}

/**
 * Round and sort thin wall issues.
 */
function processThinWallIssues(issues: ThinWallIssue[]): ThinWallIssue[] {
  return sortIssuesByCoordinate(issues).map((issue) => ({
    measured: roundNumber(issue.measured),
    required: roundNumber(issue.required),
    bbox: roundBBox(issue.bbox),
    axisAlignment: issue.axisAlignment,
    estimatedVolume: roundNumber(issue.estimatedVolume),
  }))
}

/**
 * Round and sort small feature issues.
 */
function processSmallFeatureIssues(issues: SmallFeatureIssue[]): SmallFeatureIssue[] {
  return sortIssuesByCoordinate(issues).map((issue) => ({
    size: roundNumber(issue.size),
    required: roundNumber(issue.required),
    bbox: roundBBox(issue.bbox),
    axisAlignment: issue.axisAlignment,
  }))
}

/**
 * Round geometry stats.
 */
function processStats(stats: GeometryStats): GeometryStats {
  return {
    volume: roundNumber(stats.volume),
    surfaceArea: roundNumber(stats.surfaceArea),
    bbox: roundBBox(stats.bbox),
    centerOfMass: roundArray(stats.centerOfMass),
    triangleCount: stats.triangleCount,
  }
}

/**
 * Process issues with rounding and sorting.
 */
function processIssues(issues: Issues): Issues {
  return {
    thinWalls: processThinWallIssues(issues.thinWalls),
    smallFeatures: processSmallFeatureIssues(issues.smallFeatures),
    disconnected: issues.disconnected
      ? {
          componentCount: issues.disconnected.componentCount,
          components: issues.disconnected.components.map((c) => ({
            volume: roundNumber(c.volume),
            bbox: roundBBox(c.bbox),
            isFloating: c.isFloating,
          })),
        }
      : null,
  }
}

/**
 * Sort parameter correlations by issue count (most impactful first).
 */
function sortParameterCorrelations(correlations: ParameterCorrelation[]): ParameterCorrelation[] {
  return [...correlations].sort((a, b) => b.correlatedIssueCount - a.correlatedIssueCount)
}

/**
 * Process parameter correlations with rounding and sorting.
 */
function processParameterCorrelations(correlations: ParameterCorrelation[]): ParameterCorrelation[] {
  return sortParameterCorrelations(correlations).map((c) => ({
    parameterName: c.parameterName,
    currentValue: roundNumber(c.currentValue),
    correlatedIssueCount: c.correlatedIssueCount,
    correlatedIssueTypes: c.correlatedIssueTypes,
    suggestion: {
      action: c.suggestion.action,
      targetValue: roundNumber(c.suggestion.targetValue),
      confidence: c.suggestion.confidence,
      reasoning: c.suggestion.reasoning,
    },
  }))
}

/**
 * Format analysis result as deterministic JSON.
 * - Rounds floating point numbers to 3 decimal places
 * - Sorts issues by coordinate (X, then Y, then Z)
 * - Sorts parameter correlations by issue count
 */
export function formatOutput(result: AnalysisResult): string {
  const processed: AnalysisResult = {
    status: result.status,
    stats: result.stats ? processStats(result.stats) : null,
    issues: result.issues ? processIssues(result.issues) : null,
    parameterCorrelations: result.parameterCorrelations
      ? processParameterCorrelations(result.parameterCorrelations)
      : null,
  }

  if (result.error) {
    processed.error = result.error
  }

  return JSON.stringify(processed, null, 2)
}

/**
 * Main printability analyzer orchestrator.
 * Coordinates all analysis checks and produces the final result.
 */

import type { Manifold, Mesh, Box } from 'manifold-3d'
import type { AnalysisResult, GeometryStats, Issues, BBox } from './types'
import type { ParameterDef } from '../generators/types'
import { checkConnectivity } from './checks/connectivity'
import { checkThinWalls } from './checks/thinWalls'
import { checkSmallFeatures } from './checks/smallFeatures'
import { correlateParameters } from './parameterCorrelator'
import { MIN_WALL_THICKNESS, MIN_SMALL_FEATURE } from '../generators/manifold/printingConstants'

/**
 * Convert manifold bounding box to our BBox type.
 */
function toBBox(manifoldBbox: Box): BBox {
  return {
    min: [...manifoldBbox.min],
    max: [...manifoldBbox.max],
  }
}

/**
 * Compute geometry statistics from a manifold.
 */
export function computeStats(manifold: Manifold): GeometryStats {
  const bbox = toBBox(manifold.boundingBox())
  const mesh: Mesh = manifold.getMesh()

  // Compute center of mass (approximation using bounding box center for now)
  // Note: Manifold doesn't expose true center of mass directly
  const centerOfMass: [number, number, number] = [
    (bbox.min[0] + bbox.max[0]) / 2,
    (bbox.min[1] + bbox.max[1]) / 2,
    (bbox.min[2] + bbox.max[2]) / 2,
  ]

  return {
    volume: manifold.volume(),
    surfaceArea: manifold.surfaceArea(),
    bbox,
    centerOfMass,
    triangleCount: mesh.numTri,
  }
}

/**
 * Analyze a manifold for printability issues.
 *
 * @param manifold - The geometry to analyze
 * @param params - Generator parameter definitions
 * @param values - Current parameter values
 * @returns Complete analysis result
 */
export function analyzeManifold(
  manifold: Manifold,
  params: ParameterDef[],
  values: Record<string, number>
): AnalysisResult {
  // Check for invalid geometry first
  const volume = manifold.volume()
  if (volume <= 0) {
    return {
      status: 'ERROR',
      stats: null,
      issues: null,
      parameterCorrelations: null,
      error: {
        type: 'GEOMETRY_CRASH',
        message: 'Geometry has zero or negative volume. Check for degenerate or inverted faces.',
        recoverable: true,
      },
    }
  }

  // Compute stats
  const stats = computeStats(manifold)

  // Run all checks
  const thinWalls = checkThinWalls(manifold, MIN_WALL_THICKNESS)
  const smallFeatures = checkSmallFeatures(manifold, MIN_SMALL_FEATURE)
  const disconnected = checkConnectivity(manifold)

  const issues: Issues = {
    thinWalls,
    smallFeatures,
    disconnected,
  }

  // Correlate parameters with issues
  const parameterCorrelations = correlateParameters(issues, params, values)

  // Determine overall status
  const hasIssues =
    thinWalls.length > 0 || smallFeatures.length > 0 || disconnected !== null

  return {
    status: hasIssues ? 'FAIL' : 'PASS',
    stats,
    issues,
    parameterCorrelations,
  }
}

/**
 * Wrap analysis in error handling for crash safety.
 * Always returns valid JSON - never throws.
 */
export function safeAnalyze(
  manifold: Manifold,
  params: ParameterDef[],
  values: Record<string, number>
): AnalysisResult {
  try {
    return analyzeManifold(manifold, params, values)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'ERROR',
      stats: null,
      issues: null,
      parameterCorrelations: null,
      error: {
        type: 'INTERNAL',
        message: `Analysis failed: ${message}`,
        recoverable: true,
      },
    }
  }
}

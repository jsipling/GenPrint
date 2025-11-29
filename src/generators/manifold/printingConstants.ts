/**
 * Centralized constants for FDM 3D printing optimization
 * Per AGENTS.md guidelines
 */

/**
 * Minimum wall thickness for structural parts.
 * Below this thickness, FDM prints become unreliable.
 */
export const MIN_WALL_THICKNESS = 1.2

/**
 * Minimum feature size for small features.
 * Features below this size may not print reliably.
 */
export const MIN_SMALL_FEATURE = 1.5

/**
 * Number of segments per 90° arc for rounded corners.
 * At 4mm radius, yields ~0.03mm deviation—below FDM nozzle precision (~0.4mm).
 */
export const CORNER_SEGMENTS_PER_90 = 8

/**
 * Number of segments for hole cylinders.
 * Higher count ensures smooth rotation for functional holes (shafts, bearings, screws).
 */
export const HOLE_CYLINDER_SEGMENTS = 16

/**
 * Vertex precision in mm.
 * FDM resolution is ~0.1mm layer height, so finer precision is noise.
 */
export const VERTEX_PRECISION = 0.001

/**
 * Comparison tolerance in mm.
 * Smaller differences are below print resolution.
 */
export const COMPARISON_TOLERANCE = 0.01

/**
 * Maximum number of copies allowed in pattern operations.
 * Prevents memory exhaustion from extremely large arrays.
 */
export const MAX_PATTERN_COUNT = 10000

/**
 * Calculate safe wall thickness ensuring minimum printability
 * @param requested - Requested wall thickness
 * @param maxByGeometry - Maximum allowed by geometry constraints
 * @returns Clamped wall thickness
 */
export function safeWallThickness(
  requested: number,
  maxByGeometry: number = Infinity
): number {
  return Math.max(MIN_WALL_THICKNESS, Math.min(requested, maxByGeometry))
}

/**
 * Calculate maximum inner diameter given outer diameter
 * Ensures minimum wall thickness on both sides
 * @param outerDiameter - Outer diameter
 * @returns Maximum safe inner diameter
 */
export function maxInnerDiameter(outerDiameter: number): number {
  return outerDiameter - MIN_WALL_THICKNESS * 2
}

/**
 * Emit a dev warning for printing concerns
 * Only logs in development mode
 * @param component - Component name for prefix
 * @param message - Warning message
 */
export function printingWarning(component: string, message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[${component}] ${message}`)
  }
}

/**
 * List of constant names that are passed to builder code as function parameters.
 * These are reserved and must not be redeclared in builder code.
 * Keep in sync with manifold.worker.ts executeUserBuilder() function signature.
 */
export const BUILDER_RESERVED_CONSTANTS = ['MIN_WALL_THICKNESS'] as const

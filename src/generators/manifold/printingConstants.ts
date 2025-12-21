/**
 * Centralized constants for FDM 3D printing optimization
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
 * Alias for MIN_SMALL_FEATURE to match the name used in AI-generated code.
 */
export const MIN_FEATURE_SIZE = MIN_SMALL_FEATURE

/**
 * Comparison tolerance in mm.
 * Smaller differences are below print resolution.
 */
export const COMPARISON_TOLERANCE = 0.01

/**
 * List of constant names that are passed to builder code as function parameters.
 * These are reserved and must not be redeclared in builder code.
 * Keep in sync with manifold.worker.ts executeUserBuilder() function signature.
 */
export const BUILDER_RESERVED_CONSTANTS = ['MIN_WALL_THICKNESS', 'MIN_FEATURE_SIZE'] as const

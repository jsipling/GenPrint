/**
 * TypeScript interfaces for the printability analyzer tool.
 * All output is JSON, optimized for LLM context windows and agent-driven development.
 */

/**
 * Axis-aligned bounding box with min/max coordinates.
 */
export interface BBox {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Issue representing a wall section that is too thin to print reliably.
 */
export interface ThinWallIssue {
  /** Actual measured thickness in mm */
  measured: number
  /** Minimum required thickness from printing constants */
  required: number
  /** Bounding box of the thin region */
  bbox: BBox
  /** Detected axis alignment (helps identify cube() vs cylinder() calls) */
  axisAlignment: 'X' | 'Y' | 'Z' | 'None'
  /** Volume of the thin region in mm³ */
  estimatedVolume: number
}

/**
 * Issue representing a feature that is too small to print reliably.
 */
export interface SmallFeatureIssue {
  /** Smallest dimension in mm */
  size: number
  /** Minimum required size for reliable printing */
  required: number
  /** Bounding box of the small feature */
  bbox: BBox
  /** Detected axis alignment */
  axisAlignment: 'X' | 'Y' | 'Z' | 'None'
}

/**
 * Issue representing disconnected geometry components.
 */
export interface DisconnectedIssue {
  /** Total number of disconnected parts */
  componentCount: number
  /** Details for each component */
  components: Array<{
    /** Volume in mm³ */
    volume: number
    /** Bounding box */
    bbox: BBox
    /** True if component does not touch the print bed (Z=0) */
    isFloating: boolean
  }>
}

/**
 * All detected issues grouped by type.
 */
export interface Issues {
  thinWalls: ThinWallIssue[]
  smallFeatures: SmallFeatureIssue[]
  disconnected: DisconnectedIssue | null
}

/**
 * Suggestion for fixing an issue by adjusting a parameter.
 */
export interface ParameterSuggestion {
  action: 'increase' | 'decrease'
  targetValue: number
  confidence: 'high' | 'medium' | 'low'
  /** Brief explanation for agent context */
  reasoning: string
}

/**
 * Correlation between a parameter and detected issues.
 */
export interface ParameterCorrelation {
  parameterName: string
  currentValue: number
  correlatedIssueCount: number
  correlatedIssueTypes: string[]
  suggestion: ParameterSuggestion
}

/**
 * Global geometry statistics for understanding scale.
 */
export interface GeometryStats {
  /** Volume in mm³ */
  volume: number
  /** Surface area in mm² */
  surfaceArea: number
  /** Axis-aligned bounding box */
  bbox: BBox
  /** Center of mass coordinates */
  centerOfMass: [number, number, number]
  /** Total triangle count */
  triangleCount: number
}

/**
 * Error types that can occur during analysis.
 */
export type ErrorType = 'GEOMETRY_CRASH' | 'INVALID_INPUT' | 'TIMEOUT' | 'INTERNAL'

/**
 * Error information when analysis fails.
 */
export interface AnalysisError {
  type: ErrorType
  message: string
  recoverable: boolean
}

/**
 * Overall analysis status.
 */
export type AnalysisStatus = 'PASS' | 'FAIL' | 'ERROR'

/**
 * Complete analysis result - the main output type.
 * All output is a single JSON object with deterministic ordering.
 */
export interface AnalysisResult {
  status: AnalysisStatus
  /** Global geometry stats (null if status === 'ERROR') */
  stats: GeometryStats | null
  /** Issues grouped by type (null if status === 'ERROR') */
  issues: Issues | null
  /** Parameter-to-issue mappings (null if status === 'ERROR') */
  parameterCorrelations: ParameterCorrelation[] | null
  /** Only present if status === 'ERROR' */
  error?: AnalysisError
}

/**
 * Options for running the analyzer.
 */
export interface AnalyzerOptions {
  /** Generator ID to analyze */
  generatorId: string
  /** Parameter overrides (uses defaults for missing values) */
  params?: Record<string, number | string | boolean>
  /** Optional region to isolate for analysis (minX,maxX,minY,maxY,minZ,maxZ) */
  isolateRegion?: BBox
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number
}

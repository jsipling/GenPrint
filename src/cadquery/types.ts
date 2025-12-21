/**
 * 3D vector type
 */
export type Vec3 = [number, number, number]

/**
 * 2D vector type for sketch operations
 */
export type Vec2 = [number, number]

/**
 * Axis specification
 */
export type Axis = 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z'

/**
 * Standard plane specification
 */
export type Plane = 'XY' | 'XZ' | 'YZ'

/**
 * Selector string patterns (CadQuery compatible)
 * Examples: ">Z", "<X", "|Y", "#Z", ">Z[0]", ">Z and |X"
 */
export type SelectorString = string

/**
 * Result of a geometry query - indices into mesh data
 */
export interface SelectionResult {
  type: 'faces' | 'edges' | 'vertices'
  indices: number[]
  centroids: Vec3[]
  normals?: Vec3[]
}

/**
 * Local coordinate system definition
 */
export interface CoordinateSystem {
  origin: Vec3
  xDir: Vec3
  yDir: Vec3
  zDir: Vec3
}

/**
 * Options for extrusion
 */
export interface ExtrudeOptions {
  /** Degrees of taper (positive = smaller top) */
  taper?: number
  /** Degrees of twist over extrusion */
  twist?: number
  /** Center extrusion on workplane */
  centered?: boolean
}

/**
 * Options for approximate fillet
 */
export interface FilletOptions {
  /** Fillet radius */
  radius: number
  /** Mesh smoothing iterations (default: 3) */
  iterations?: number
}

/**
 * Options for approximate chamfer
 */
export interface ChamferOptions {
  /** Chamfer distance */
  distance: number
}

/**
 * Face data extracted from mesh for selector evaluation
 */
export interface FaceData {
  index: number
  centroid: Vec3
  normal: Vec3
  vertices: number[]
}

/**
 * Edge data extracted from mesh for selector evaluation
 */
export interface EdgeData {
  index: number
  start: Vec3
  end: Vec3
  midpoint: Vec3
  direction: Vec3
  length: number
}

/**
 * Token types for selector parsing
 */
export type SelectorToken =
  | { type: 'direction'; axis: 'X' | 'Y' | 'Z'; sign: 1 | -1 }
  | { type: 'parallel'; axis: 'X' | 'Y' | 'Z' }
  | { type: 'perpendicular'; axis: 'X' | 'Y' | 'Z' }
  | { type: 'index'; value: number }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'not' }
  | { type: 'radius'; op: '<' | '>' | '=='; value: number }

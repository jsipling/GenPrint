/**
 * Shared types for worker communication
 * Used by both the worker and the main thread
 */

import type { Manifold } from 'manifold-3d'
import type { MeshData, ParameterValues, BoundingBox, NamedPart, DisplayDimension } from '../generators/types'

/**
 * Request to build geometry using builder code.
 * All generators (built-in and user-created) use the same message type.
 */
export interface BuildRequest {
  type: 'build'
  id: number
  builderCode: string
  params: ParameterValues
  circularSegments: number
}

export interface BuildResponse {
  type: 'build-result'
  id: number
  success: boolean
  // Single-part result (existing, backwards compatible)
  meshData?: MeshData
  boundingBox?: BoundingBox
  // Multi-part result (new)
  parts?: NamedPart[]
  error?: string
  timing?: number
}

/**
 * What a generator returns for a named part (before conversion to MeshData).
 * Used when a generator returns multiple distinct parts.
 */
export interface NamedManifoldResult {
  /** Unique identifier for this part within the model */
  name: string
  /** The manifold geometry for this part */
  manifold: Manifold
  /** Optional dimensions to show in tooltip */
  dimensions?: DisplayDimension[]
  /** Optional parameter values for dimension formatting */
  params?: ParameterValues
}

export interface ReadyMessage {
  type: 'ready'
}

export interface InitErrorMessage {
  type: 'init-error'
  error: string
}

export type WorkerResponse = BuildResponse | ReadyMessage | InitErrorMessage
export type WorkerMessage = BuildRequest

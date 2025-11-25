/**
 * Shared types for worker communication
 * Used by both the worker and the main thread
 */

import type { MeshData, ParameterValues, BoundingBox } from '../generators/types'

export interface BuildRequest {
  type: 'build'
  id: number
  generatorId: string
  params: ParameterValues
  circularSegments: number
}

export interface BuildResponse {
  type: 'build-result'
  id: number
  success: boolean
  meshData?: MeshData
  boundingBox?: BoundingBox
  error?: string
  timing?: number
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

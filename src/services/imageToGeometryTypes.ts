import type { ParameterDef, ParameterValues } from '../generators/types'

/**
 * Request to analyze an image for 3D geometry generation.
 */
export interface ImageToGeometryRequest {
  /** The generated design image (data URL) */
  imageDataUrl: string
  /** User's original prompt describing what to create */
  prompt: string
  /** Optional: Current generator's builder code for context */
  currentBuilderCode?: string
  /** Optional: Current generator's parameters */
  currentParams?: ParameterValues
  /** Optional: Current generator's name */
  currentModelName?: string
  /** Optional: Error from previous attempt for retry context */
  previousError?: string
}

/**
 * Result of AI analysis with generated code and parameters.
 */
export interface GeometryAnalysis {
  /** AI's understanding of what to create */
  description: string
  /** Manifold-3D compatible JavaScript code */
  builderCode: string
  /** Name for the generated model */
  suggestedName: string
  /** Extracted configurable parameters */
  parameters: ParameterDef[]
  /** Default values for parameters */
  defaultParams: ParameterValues
}

/**
 * Response from the image-to-geometry service.
 */
export interface ImageToGeometryResponse {
  success: boolean
  analysis?: GeometryAnalysis
  error?: string
}

/**
 * Service interface for analyzing images and generating 3D geometry code.
 */
export interface ImageToGeometryService {
  analyzeImage(request: ImageToGeometryRequest): Promise<ImageToGeometryResponse>
  isAnalyzing(): boolean
  cancelAnalysis(): void
}

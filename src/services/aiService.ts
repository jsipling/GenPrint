import type { ImageGenerationService, SketchModel, GeometryModel } from './types'
import type { ImageToGeometryService } from './imageToGeometryTypes'
import { createOpenAiService } from './openaiService'
import { createGoogleAiService } from './googleAiService'
import { createMockAiService } from './mockAiService'
import { createImageToGeometryService } from './imageToGeometryService'

/**
 * Check if an API key is available for a given provider.
 */
export function hasApiKey(provider: 'openai' | 'google'): boolean {
  if (provider === 'openai') {
    const key = import.meta.env.VITE_OPENAI_API_KEY
    return Boolean(key && typeof key === 'string' && key.trim().length > 0)
  }
  if (provider === 'google') {
    const key = import.meta.env.VITE_GOOGLE_AI_API_KEY
    return Boolean(key && typeof key === 'string' && key.trim().length > 0)
  }
  return false
}

/**
 * Creates an AI image generation service for sketch processing.
 * Uses the specified model if its API key is available.
 */
export function createAiService(model?: SketchModel): ImageGenerationService {
  const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  const googleApiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY as string | undefined

  // If a specific model is requested, try to use it
  if (model) {
    if (model.startsWith('openai-') && openaiApiKey?.trim()) {
      if (import.meta.env.DEV) {
        console.log(`[AI Service] Using OpenAI service (${model})`)
      }
      return createOpenAiService(openaiApiKey, model as 'openai-gpt-image-1-mini' | 'openai-gpt-image-1.5')
    }
    if (model.startsWith('gemini-') && googleApiKey?.trim()) {
      if (import.meta.env.DEV) {
        console.log(`[AI Service] Using Google AI service (${model})`)
      }
      return createGoogleAiService(googleApiKey, model as 'gemini-2.5-flash-image')
    }
  }

  // Default behavior: prioritize OpenAI, then Google, then mock
  if (openaiApiKey?.trim()) {
    if (import.meta.env.DEV) {
      console.log('[AI Service] Using OpenAI service (gpt-image-1-mini)')
    }
    return createOpenAiService(openaiApiKey)
  }

  if (googleApiKey?.trim()) {
    if (import.meta.env.DEV) {
      console.log('[AI Service] Using Google AI service')
    }
    return createGoogleAiService(googleApiKey)
  }

  // Fall back to mock service
  if (import.meta.env.DEV) {
    console.log('[AI Service] No API key found, using mock service')
  }
  return createMockAiService()
}

/**
 * Creates an image-to-geometry service for converting design images to 3D models.
 * Returns null if no appropriate API key is configured.
 */
export function createImageToGeometryAiService(model?: GeometryModel): ImageToGeometryService | null {
  const googleApiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY as string | undefined

  // If a specific model is requested, use the appropriate service
  if (model && model.startsWith('gemini-') && googleApiKey?.trim()) {
    if (import.meta.env.DEV) {
      console.log(`[AI Service] Using Google ${model} for image-to-geometry (OpenSCAD format)`)
    }
    // Use 'openscad' format - now supports variables for parametric updates
    return createImageToGeometryService(googleApiKey, model as 'gemini-3-pro-preview' | 'gemini-2.5-pro' | 'gemini-2.5-flash', 'openscad')
  }

  // Default: use Google
  if (googleApiKey?.trim()) {
    const modelToUse = 'gemini-3-flash-preview'
    if (import.meta.env.DEV) {
      console.log(`[AI Service] Using ${modelToUse} for image-to-geometry (OpenSCAD format)`)
    }
    // Use 'openscad' format - now supports variables for parametric updates
    return createImageToGeometryService(googleApiKey, modelToUse, 'openscad')
  }

  return null  // No mock for this service - requires API key
}

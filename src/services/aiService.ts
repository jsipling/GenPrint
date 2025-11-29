import type { ImageGenerationService } from './types'
import type { ImageToGeometryService } from './imageToGeometryTypes'
import { createOpenAiService } from './openaiService'
import { createGoogleAiService } from './googleAiService'
import { createMockAiService } from './mockAiService'
import { createImageToGeometryService } from './imageToGeometryService'

/**
 * Creates an AI image generation service.
 * Priority order:
 * 1. OpenAI (gpt-image-1-mini) if VITE_OPENAI_API_KEY is set
 * 2. Google AI if VITE_GOOGLE_AI_API_KEY is set
 * 3. Mock service for development/testing
 */
export function createAiService(): ImageGenerationService {
  // Check for OpenAI API key first (highest priority)
  const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (openaiApiKey && typeof openaiApiKey === 'string' && openaiApiKey.trim().length > 0) {
    if (import.meta.env.DEV) {
      console.log('[AI Service] Using OpenAI service (gpt-image-1-mini)')
    }
    return createOpenAiService(openaiApiKey)
  }

  // Fall back to Google AI
  const googleApiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY

  if (googleApiKey && typeof googleApiKey === 'string' && googleApiKey.trim().length > 0) {
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
 * Uses Google's Gemini 3 Pro Preview model.
 * Returns null if no Google API key is configured.
 */
export function createImageToGeometryAiService(): ImageToGeometryService | null {
  const googleApiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY

  if (googleApiKey && typeof googleApiKey === 'string' && googleApiKey.trim().length > 0) {
    if (import.meta.env.DEV) {
      console.log('[AI Service] Using Gemini 3 Pro Preview for image-to-geometry')
    }
    return createImageToGeometryService(googleApiKey)
  }

  return null  // No mock for this service - requires Google AI
}

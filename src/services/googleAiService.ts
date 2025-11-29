import { GoogleGenAI } from '@google/genai'
import type {
  ImageGenerationService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GenerationError
} from './types'
import { compressSketchImage, parseDataUrl } from '../utils/imageCompression'

class AiGenerationError extends Error implements GenerationError {
  constructor(
    public code: GenerationError['code'],
    message: string,
    public retryable: boolean
  ) {
    super(message)
    this.name = 'AiGenerationError'
  }
}

// Map our model IDs to actual Google model names
type GoogleModelId = 'gemini-2.5-flash-image'

function getGoogleModelName(_modelId: GoogleModelId): string {
  return 'gemini-2.5-flash-image'
}

// Pricing for gemini-2.5-flash-image (per 1M tokens / per image)
// Source: https://ai.google.dev/gemini-api/docs/pricing
// Input: $0.30 per 1M tokens (text/image)
// Output: $0.039 per image (1290 tokens at $30/1M = ~$0.039)
const SKETCH_MODEL_PRICING = {
  inputPerMillionTokens: 0.30,
  outputPerImage: 0.039,
  outputTokensPerImage: 1290
}

/**
 * Google AI service implementation using Gemini for native image generation.
 */
export function createGoogleAiService(apiKey: string, modelId: GoogleModelId = 'gemini-2.5-flash-image'): ImageGenerationService {
  const modelName = getGoogleModelName(modelId)
  let generating = false
  let abortController: AbortController | null = null

  const ai = new GoogleGenAI({ apiKey })

  return {
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
      // Validation
      if (!request.sketchDataUrl && !request.prompt) {
        throw new AiGenerationError(
          'VALIDATION',
          'Either sketch or prompt must be provided',
          false
        )
      }

      if (request.sketchDataUrl && !request.sketchDataUrl.startsWith('data:image/')) {
        throw new AiGenerationError('VALIDATION', 'Invalid sketch data URL format', false)
      }

      // Check if already generating
      if (generating) {
        throw new AiGenerationError('VALIDATION', 'Generation already in progress', true)
      }

      generating = true
      abortController = new AbortController()

      try {
        // Build content parts
        const contents: Array<string | { inlineData: { data: string; mimeType: string } }> = []

        // Add sketch image if provided
        if (request.sketchDataUrl) {
          // Compress sketch for reduced latency and cost
          const compressedSketch = await compressSketchImage(request.sketchDataUrl)

          if (import.meta.env.DEV) {
            console.log('[Google AI] Sketch compression:', {
              original: `${Math.round(request.sketchDataUrl.length / 1024)}KB`,
              compressed: `${Math.round(compressedSketch.length / 1024)}KB`,
              reduction: `${Math.round((1 - compressedSketch.length / request.sketchDataUrl.length) * 100)}%`
            })
          }

          const { data, mimeType } = parseDataUrl(compressedSketch)
          contents.push({
            inlineData: {
              data,
              mimeType
            }
          })
        }

        // Build prompt text
        let promptText: string
        if (request.sketchDataUrl && request.prompt) {
          promptText = `Transform this sketch into a clean, professional technical orthographic drawing. ${request.prompt}. Generate an image.`
        } else if (request.sketchDataUrl) {
          promptText = 'Transform this sketch into a clean, professional technical orthographic drawing suitable for 3D modeling. Generate an image.'
        } else {
          promptText = `Create a clean, professional technical orthographic drawing: ${request.prompt}. Generate an image.`
        }
        contents.push(promptText)

        if (import.meta.env.DEV) {
          console.log('[Google AI] Generating image with prompt:', promptText.substring(0, 100) + '...')
        }

        // Call Gemini API with image generation
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseModalities: ['image', 'text']
          }
        })

        // Log response metadata with cost calculation
        if (import.meta.env.DEV) {
          const promptTokens = response?.usageMetadata?.promptTokenCount ?? 0
          const responseTokens = response?.usageMetadata?.candidatesTokenCount ?? 0

          // Calculate cost: input tokens + per-image output cost
          const inputCost = (promptTokens / 1_000_000) * SKETCH_MODEL_PRICING.inputPerMillionTokens
          const outputCost = SKETCH_MODEL_PRICING.outputPerImage // Per generated image
          const totalCost = inputCost + outputCost

          console.log(`[${modelName}] Response metadata:`, {
            promptTokens,
            responseTokens,
            totalTokens: response?.usageMetadata?.totalTokenCount,
            estimatedCost: `$${totalCost.toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)}/image)`
          })
        }

        // Check if cancelled
        if (abortController.signal.aborted) {
          throw new AiGenerationError('NETWORK', 'Generation cancelled by user', true)
        }

        // Extract image from response
        let imageUrl: string | null = null

        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png'
              imageUrl = `data:${mimeType};base64,${part.inlineData.data}`
              break
            }
          }
        }

        if (!imageUrl) {
          // If no image was generated, return text response as error
          const textResponse = response.text || 'No image generated'
          throw new AiGenerationError(
            'API_ERROR',
            `Image generation failed: ${textResponse.substring(0, 200)}`,
            true
          )
        }

        if (import.meta.env.DEV) {
          console.log('[Google AI] Image generated successfully')
        }

        const result: ImageGenerationResponse = {
          imageUrl,
          timestamp: Date.now()
        }

        // Add conversationId if continuing conversation
        if (request.continueConversation) {
          result.conversationId = `google_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`
        }

        return result
      } catch (error) {
        if (error instanceof AiGenerationError) {
          throw error
        }

        // Handle Google AI API errors
        if (error instanceof Error) {
          if (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid')) {
            throw new AiGenerationError('API_ERROR', 'Invalid Google AI API key', false)
          }
          if (error.message.includes('RATE_LIMIT') || error.message.includes('rate')) {
            throw new AiGenerationError('RATE_LIMIT', 'API rate limit exceeded', true)
          }
          if (error.message.includes('quota')) {
            throw new AiGenerationError('RATE_LIMIT', 'API quota exceeded', true)
          }
          throw new AiGenerationError('API_ERROR', `Generation failed: ${error.message}`, true)
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new AiGenerationError('NETWORK', 'Network connection failed', true)
        }

        // Default error
        throw new AiGenerationError('API_ERROR', 'Unknown error occurred', true)
      } finally {
        generating = false
        abortController = null
      }
    },

    cancelGeneration(): void {
      if (abortController) {
        abortController.abort()
      }
    },

    isGenerating(): boolean {
      return generating
    }
  }
}

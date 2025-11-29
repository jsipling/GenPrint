import { GoogleGenerativeAI } from '@google/generative-ai'
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

/**
 * Google AI service implementation using Gemini for vision analysis
 * and Imagen for image generation.
 */
export function createGoogleAiService(apiKey: string, modelId: GoogleModelId = 'gemini-2.5-flash-image'): ImageGenerationService {
  const modelName = getGoogleModelName(modelId)
  let generating = false
  let abortController: AbortController | null = null

  const genAI = new GoogleGenerativeAI(apiKey)

  /**
   * Analyze sketch using Gemini vision model
   */
  async function analyzeSketch(sketchDataUrl: string, userPrompt: string): Promise<string> {
    try {
      // Compress sketch for reduced latency and cost
      const compressedSketch = await compressSketchImage(sketchDataUrl)

      if (import.meta.env.DEV) {
        console.log('[Google AI] Sketch compression:', {
          original: `${Math.round(sketchDataUrl.length / 1024)}KB`,
          compressed: `${Math.round(compressedSketch.length / 1024)}KB`,
          reduction: `${Math.round((1 - compressedSketch.length / sketchDataUrl.length) * 100)}%`
        })
      }

      const model = genAI.getGenerativeModel({ model: modelName })
      const { data, mimeType } = parseDataUrl(compressedSketch)

      const promptText = userPrompt
        ? `Analyze this sketch and describe it as a technical orthographic drawing. User says: ${userPrompt}`
        : 'Analyze this sketch and describe it as a detailed technical orthographic drawing suitable for 3D modeling.'

      const result = await model.generateContent([
        {
          inlineData: {
            data,
            mimeType
          }
        },
        promptText
      ])

      const response = result.response
      const text = response.text()

      if (!text) {
        throw new AiGenerationError(
          'API_ERROR',
          'Gemini returned empty analysis response',
          true
        )
      }

      return text
    } catch (error) {
      if (error instanceof AiGenerationError) {
        throw error
      }

      // Handle Google AI API errors
      if (error instanceof Error) {
        if (error.message.includes('API_KEY_INVALID')) {
          throw new AiGenerationError('API_ERROR', 'Invalid Google AI API key', false)
        }
        if (error.message.includes('RATE_LIMIT')) {
          throw new AiGenerationError('RATE_LIMIT', 'API rate limit exceeded', true)
        }
        if (error.message.includes('quota')) {
          throw new AiGenerationError('RATE_LIMIT', 'API quota exceeded', true)
        }
        throw new AiGenerationError('API_ERROR', `Gemini analysis failed: ${error.message}`, true)
      }

      throw new AiGenerationError('API_ERROR', 'Unknown error during sketch analysis', true)
    }
  }

  /**
   * Generate image using Imagen (via Gemini image generation)
   * Note: As of now, Google's generative AI SDK doesn't have direct Imagen support.
   * This is a placeholder that uses Gemini's capabilities.
   * For production, you would use Vertex AI Imagen API separately.
   */
  async function generateImage(description: string): Promise<string> {
    // Currently, the @google/generative-ai package doesn't support image generation
    // This would require Vertex AI Imagen API integration
    // For now, we'll return a placeholder implementation

    try {
      // TODO: Integrate with Vertex AI Imagen API when available
      // For now, create a placeholder response that indicates the description was processed
      const model = genAI.getGenerativeModel({ model: modelName })

      // Generate a refined prompt for image generation (simulated)
      const result = await model.generateContent([
        `Based on this description, create a concise technical drawing prompt suitable for image generation: ${description}`
      ])

      const refinedPrompt = result.response.text()

      // Since we can't actually generate images yet with this SDK,
      // return a placeholder SVG with the description
      const encodedText = encodeURIComponent(refinedPrompt.substring(0, 100))
      const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#2a2a3a"/>
        <text x="50%" y="30%" font-family="Arial" font-size="14" fill="#66b4ff" text-anchor="middle">
          Google AI Processing Complete
        </text>
        <foreignObject x="10" y="50%" width="380" height="180">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: #aaaaaa; font-family: Arial; font-size: 12px; padding: 10px; word-wrap: break-word;">
            ${encodedText}
          </div>
        </foreignObject>
      </svg>`

      const base64Svg = btoa(svg)
      return `data:image/svg+xml;base64,${base64Svg}`
    } catch (error) {
      if (error instanceof AiGenerationError) {
        throw error
      }

      if (error instanceof Error) {
        throw new AiGenerationError('API_ERROR', `Image generation failed: ${error.message}`, true)
      }

      throw new AiGenerationError('API_ERROR', 'Unknown error during image generation', true)
    }
  }

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
        let description: string

        // Determine the workflow based on what's provided
        if (request.sketchDataUrl && request.prompt) {
          // Workflow 1: Sketch + prompt - analyze sketch with user context
          description = await analyzeSketch(request.sketchDataUrl, request.prompt)
        } else if (request.sketchDataUrl) {
          // Workflow 2: Sketch only - analyze without user prompt
          description = await analyzeSketch(request.sketchDataUrl, '')
        } else {
          // Workflow 3: Prompt only - use prompt directly for generation
          description = `Create a technical orthographic drawing: ${request.prompt}`
        }

        // Check if cancelled during analysis
        if (abortController.signal.aborted) {
          throw new AiGenerationError('NETWORK', 'Generation cancelled by user', true)
        }

        // Generate image from description
        const imageUrl = await generateImage(description)

        // Check if cancelled during generation
        if (abortController.signal.aborted) {
          throw new AiGenerationError('NETWORK', 'Generation cancelled by user', true)
        }

        const response: ImageGenerationResponse = {
          imageUrl,
          timestamp: Date.now()
        }

        // Add conversationId if continuing conversation
        if (request.continueConversation) {
          response.conversationId = `google_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`
        }

        return response
      } catch (error) {
        if (error instanceof AiGenerationError) {
          throw error
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new AiGenerationError('NETWORK', 'Network connection failed', true)
        }

        // Default error
        throw new AiGenerationError(
          'API_ERROR',
          error instanceof Error ? error.message : 'Unknown error occurred',
          true
        )
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

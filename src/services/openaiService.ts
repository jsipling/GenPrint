import OpenAI from 'openai'
import type {
  ImageGenerationService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GenerationError
} from './types'
import { compressSketchImage } from '../utils/imageCompression'

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

/**
 * Convert a data URL to a File object for the OpenAI API
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(',')
  const header = parts[0]
  const base64Data = parts[1]

  if (!header || !base64Data) {
    throw new Error('Invalid data URL format')
  }

  const mimeMatch = header.match(/data:(.*?);/)
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png'
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return new File([bytes], filename, { type: mimeType })
}

// Map our model IDs to actual OpenAI model names
type OpenAiModelId = 'openai-gpt-image-1-mini' | 'openai-gpt-image-1'

function getOpenAiModelName(modelId: OpenAiModelId): string {
  switch (modelId) {
    case 'openai-gpt-image-1':
      return 'gpt-image-1'
    case 'openai-gpt-image-1-mini':
    default:
      return 'gpt-image-1-mini'
  }
}

/**
 * OpenAI service implementation for image generation.
 * Uses images.edit when sketch is provided, images.generate for text-only.
 */
export function createOpenAiService(apiKey: string, modelId: OpenAiModelId = 'openai-gpt-image-1-mini'): ImageGenerationService {
  const modelName = getOpenAiModelName(modelId)
  let generating = false
  let abortController: AbortController | null = null

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  })

  /**
   * Generate image using the configured OpenAI model
   * Uses images.edit when sketch is provided to include the image input
   */
  async function generateImage(
    prompt: string,
    sketchDataUrl?: string
  ): Promise<string> {
    try {
      // Build the prompt for 3D interpretation
      let technicalPrompt = 'Interpret this user\'s drawing. They are attempting to draw a 3D object that will be used to print with a 3D printer. Your interpretation should be a clean 3D drawing with only lines. The following is the user\'s description of their sketch:'

      // Append user's prompt if provided for additional context
      if (prompt) {
        technicalPrompt += ` ${prompt}`
      }

      // Log the request (without image data)
      if (import.meta.env.DEV) {
        console.log(`[OpenAI ${modelName}] Request:`, {
          model: modelName,
          prompt: technicalPrompt,
          hasSketch: !!sketchDataUrl,
          sketchSize: sketchDataUrl ? `${Math.round(sketchDataUrl.length / 1024)}KB` : 'N/A',
          size: '1024x1024',
          quality: 'low'
        })
      }

      let response

      if (sketchDataUrl) {
        // Compress sketch for reduced latency and cost
        const compressedSketch = await compressSketchImage(sketchDataUrl)

        if (import.meta.env.DEV) {
          console.log('[OpenAI] Sketch compression:', {
            original: `${Math.round(sketchDataUrl.length / 1024)}KB`,
            compressed: `${Math.round(compressedSketch.length / 1024)}KB`,
            reduction: `${Math.round((1 - compressedSketch.length / sketchDataUrl.length) * 100)}%`
          })
        }

        // Use images.edit to include the sketch as input
        const sketchFile = dataUrlToFile(compressedSketch, 'sketch.jpg')
        response = await openai.images.edit({
          model: modelName,
          image: sketchFile,
          prompt: technicalPrompt,
          size: '1024x1024',
          quality: 'low',
          n: 1
        })
      } else {
        // Text-only generation
        response = await openai.images.generate({
          model: modelName,
          prompt: technicalPrompt,
          size: '1024x1024',
          quality: 'low',
          n: 1
        })
      }

      // gpt-image-1-mini returns b64_json, not url
      const b64Json = response.data?.[0]?.b64_json
      const url = response.data?.[0]?.url

      if (!b64Json && !url) {
        throw new AiGenerationError(
          'API_ERROR',
          `${modelName} returned empty image response.`,
          true
        )
      }

      // Convert base64 to data URL if we got b64_json, otherwise use url
      const imageUrl = b64Json
        ? `data:image/png;base64,${b64Json}`
        : url!

      return imageUrl
    } catch (error) {
      if (error instanceof AiGenerationError) {
        throw error
      }

      // Handle OpenAI API errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new AiGenerationError('RATE_LIMIT', 'API rate limit exceeded', true)
        }
        if (error.status === 401) {
          throw new AiGenerationError('API_ERROR', 'Invalid OpenAI API key', false)
        }
        if (error.status === 400) {
          throw new AiGenerationError('API_ERROR', `${modelName} request invalid: ${error.message}`, true)
        }
        throw new AiGenerationError('API_ERROR', `${modelName} generation failed: ${error.message}`, true)
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AiGenerationError('NETWORK', 'Network connection failed', true)
      }

      throw new AiGenerationError(
        'API_ERROR',
        error instanceof Error ? error.message : 'Unknown error during image generation',
        true
      )
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
        // Build the prompt based on what's provided
        let prompt: string

        if (request.sketchDataUrl && request.prompt) {
          // Workflow 1: Sketch + prompt - combine user prompt with sketch reference
          prompt = request.prompt
        } else if (request.sketchDataUrl) {
          // Workflow 2: Sketch only - use default technical drawing prompt
          prompt = 'detailed technical orthographic drawing suitable for 3D modeling'
        } else {
          // Workflow 3: Prompt only - use user prompt directly
          prompt = request.prompt ?? ''
        }

        // Generate image with gpt-image-1-mini (supports both text and image inputs)
        const imageUrl = await generateImage(prompt, request.sketchDataUrl)

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
          response.conversationId = `openai_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`
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

import type {
  ImageGenerationService,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GenerationError
} from './types'

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
 * Mock AI service that returns placeholder images after a delay.
 * Used for development and testing without real API calls.
 */
export function createMockAiService(delay = 1500): ImageGenerationService {
  let generating = false
  let abortController: AbortController | null = null

  // Collection of placeholder SVG images
  const placeholderImages = [
    // Cube placeholder
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzJhMmEzYSIvPjxyZWN0IHg9IjEwMCIgeT0iMTAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRhOTBkOSIgc3Ryb2tlPSIjNjZiNGZmIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI1MCUiIHk9IjM1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWFhYWFhIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5HZW5lcmF0ZWQgQ3ViZTwvdGV4dD48L3N2Zz4=',
    // Cylinder placeholder
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzJhMmEzYSIvPjxlbGxpcHNlIGN4PSIyMDAiIGN5PSIyMDAiIHJ4PSI4MCIgcnk9IjEyMCIgZmlsbD0iIzRhOTBkOSIgc3Ryb2tlPSIjNjZiNGZmIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI1MCUiIHk9IjM1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjYWFhYWFhIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5HZW5lcmF0ZWQgQ3lsaW5kZXI8L3RleHQ+PC9zdmc+',
    // Sphere placeholder
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzJhMmEzYSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjIwMCIgcj0iMTAwIiBmaWxsPSIjNGE5MGQ5IiBzdHJva2U9IiM2NmI0ZmYiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwJSIgeT0iMzUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNhYWFhYWEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkdlbmVyYXRlZCBTcGhlcmU8L3RleHQ+PC9zdmc+'
  ]

  return {
    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
      // Validate that at least sketch or prompt is provided
      if (!request.sketchDataUrl && !request.prompt) {
        throw new AiGenerationError('VALIDATION', 'Either sketch or prompt must be provided', false)
      }

      if (generating) {
        throw new AiGenerationError('VALIDATION', 'Generation already in progress', true)
      }

      generating = true
      abortController = new AbortController()

      try {
        // Simulate API delay
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(), delay)

          abortController!.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
            reject(new AiGenerationError('NETWORK', 'Generation cancelled by user', true))
          })
        })

        // Select a random placeholder image
        const imageUrl = placeholderImages[Math.floor(Math.random() * placeholderImages.length)] ?? ''

        const response: ImageGenerationResponse = {
          imageUrl,
          timestamp: Date.now()
        }

        if (request.continueConversation) {
          response.conversationId = `mock_conv_${Date.now()}`
        }

        return response
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

export interface ImageGenerationRequest {
  sketchDataUrl?: string
  prompt?: string
  conversationHistory?: ConversationMessage[]
  continueConversation: boolean
}

export interface ImageGenerationResponse {
  imageUrl: string
  conversationId?: string
  timestamp: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  timestamp: number
}

export interface GenerationError {
  code: 'TIMEOUT' | 'NETWORK' | 'API_ERROR' | 'VALIDATION' | 'RATE_LIMIT'
  message: string
  retryable: boolean
}

export interface ImageGenerationService {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  cancelGeneration(): void
  isGenerating(): boolean
}

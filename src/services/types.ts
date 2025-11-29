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

// Available AI models for sketch generation
export type SketchModel =
  | 'openai-gpt-image-1-mini'
  | 'openai-gpt-image-1'
  | 'gemini-2.5-flash-image'

// Available AI models for Apply to 3D Model
export type GeometryModel =
  | 'gemini-3-pro-preview'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'

export interface SketchModelOption {
  id: SketchModel
  name: string
  provider: 'openai' | 'google'
}

export interface GeometryModelOption {
  id: GeometryModel
  name: string
}

export const SKETCH_MODELS: SketchModelOption[] = [
  { id: 'openai-gpt-image-1-mini', name: 'GPT Image Mini', provider: 'openai' },
  { id: 'openai-gpt-image-1', name: 'GPT Image', provider: 'openai' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', provider: 'google' }
]

export const GEOMETRY_MODELS: GeometryModelOption[] = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
]

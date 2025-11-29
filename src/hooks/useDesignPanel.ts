import { useState, useCallback } from 'react'
import type {
  ImageGenerationService,
  ConversationMessage
} from '../services/types'

interface GeneratedImage {
  url: string
  timestamp: number
}

const MAX_HISTORY = 20

export function useDesignPanel(aiService: ImageGenerationService) {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [continueConversation, setContinueConversation] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1))
  }, [images.length])

  const previousImage = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const setConversationMode = useCallback((enabled: boolean) => {
    setContinueConversation(enabled)
  }, [])

  const generateImage = useCallback(async (sketchDataUrl: string) => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await aiService.generateImage({
        sketchDataUrl,
        prompt,
        continueConversation,
        conversationHistory: continueConversation ? conversationHistory : undefined
      })

      const newImage: GeneratedImage = {
        url: response.imageUrl,
        timestamp: response.timestamp
      }

      // Add to history (newest first), limit to MAX_HISTORY
      setImages((prev) => {
        const updated = [newImage, ...prev]
        return updated.slice(0, MAX_HISTORY)
      })

      // New image becomes current (index 0)
      setCurrentIndex(0)

      // Update conversation history
      if (continueConversation) {
        setConversationHistory((prev) => [
          ...prev,
          { role: 'user', content: prompt, timestamp: Date.now() },
          {
            role: 'assistant',
            content: 'Generated image',
            imageUrl: response.imageUrl,
            timestamp: response.timestamp
          }
        ])
      } else {
        // Reset conversation history when not continuing
        setConversationHistory([
          { role: 'user', content: prompt, timestamp: Date.now() },
          {
            role: 'assistant',
            content: 'Generated image',
            imageUrl: response.imageUrl,
            timestamp: response.timestamp
          }
        ])
      }

      // Clear prompt after successful generation
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, continueConversation, conversationHistory, aiService])

  return {
    images,
    currentIndex,
    prompt,
    isGenerating,
    error,
    continueConversation,
    conversationHistory,
    setPrompt,
    setConversationMode,
    nextImage,
    previousImage,
    generateImage
  }
}

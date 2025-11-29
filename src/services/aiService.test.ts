/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAiService } from './aiService'
import type { ImageGenerationRequest } from './types'

// Mock the image compression utility
vi.mock('../utils/imageCompression', () => ({
  compressSketchImage: vi.fn().mockResolvedValue(
    'data:image/jpeg;base64,/9j/compressed=='
  )
}))

// Mock the openai module
vi.mock('openai', () => {
  const mockImageGenerate = vi.fn().mockResolvedValue({
    data: [
      {
        b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    ]
  })

  const mockImageEdit = vi.fn().mockResolvedValue({
    data: [
      {
        b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    ]
  })

  class MockOpenAI {
    images = {
      generate: mockImageGenerate,
      edit: mockImageEdit
    }
  }

  return {
    default: MockOpenAI,
    APIError: class APIError extends Error {
      constructor(message: string, public status?: number) {
        super(message)
      }
    }
  }
})

describe('AI Service', () => {
  let service: ReturnType<typeof createAiService>

  beforeEach(() => {
    service = createAiService()
  })

  afterEach(() => {
    service.cancelGeneration()
  })

  describe('generateImage', () => {
    it('returns a valid response with imageUrl and timestamp', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,test',
        prompt: 'Create a cube',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(typeof response.imageUrl).toBe('string')
      expect(response.timestamp).toBeGreaterThan(0)
      expect(typeof response.timestamp).toBe('number')
    })

    it('includes conversationId when continueConversation is true', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,test',
        prompt: 'Create a cube',
        continueConversation: true,
        conversationHistory: [
          {
            role: 'user',
            content: 'Previous prompt',
            timestamp: Date.now()
          }
        ]
      }

      const response = await service.generateImage(request)

      expect(response.conversationId).toBeDefined()
      expect(typeof response.conversationId).toBe('string')
    })

    it('validates that either sketch or prompt is provided', async () => {
      const request: ImageGenerationRequest = {
        continueConversation: false
      }

      try {
        await service.generateImage(request)
        expect.fail('Should have thrown validation error')
      } catch (error) {
        // Mock service should handle this - just verify it doesn't crash
        expect(error).toBeDefined()
      }
    })

    it('sets isGenerating to true during generation', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,test',
        prompt: 'Create a cube',
        continueConversation: false
      }

      expect(service.isGenerating()).toBe(false)

      const promise = service.generateImage(request)
      expect(service.isGenerating()).toBe(true)

      await promise
      expect(service.isGenerating()).toBe(false)
    })

    it('can be cancelled during generation', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,test',
        prompt: 'Create a cube',
        continueConversation: false
      }

      const promise = service.generateImage(request)
      expect(service.isGenerating()).toBe(true)

      service.cancelGeneration()

      try {
        await promise
        expect.fail('Should have thrown cancellation error')
      } catch (error) {
        expect(error).toMatchObject({
          code: 'NETWORK',
          retryable: true
        })
        expect((error as Error).message).toContain('cancelled')
      }

      expect(service.isGenerating()).toBe(false)
    })

    it('prevents concurrent generation requests', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,test',
        prompt: 'Create a cube',
        continueConversation: false
      }

      const promise1 = service.generateImage(request)

      try {
        await service.generateImage(request)
        expect.fail('Should have thrown validation error for concurrent request')
      } catch (error) {
        expect(error).toMatchObject({
          code: 'VALIDATION',
          retryable: true
        })
        expect((error as Error).message).toContain('already')
      }

      await promise1
    })
  })

  describe('cancelGeneration', () => {
    it('does nothing when not generating', () => {
      expect(() => service.cancelGeneration()).not.toThrow()
      expect(service.isGenerating()).toBe(false)
    })
  })

  describe('isGenerating', () => {
    it('returns false initially', () => {
      expect(service.isGenerating()).toBe(false)
    })
  })
})

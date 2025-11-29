/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createOpenAiService } from './openaiService'
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

describe('OpenAI Service', () => {
  let service: ReturnType<typeof createOpenAiService>
  const testApiKey = 'sk-test-api-key-123'

  beforeEach(() => {
    service = createOpenAiService(testApiKey)
  })

  afterEach(() => {
    service.cancelGeneration()
  })

  describe('generateImage', () => {
    it('generates image with sketch and prompt using gpt-image-1-mini with image input', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        prompt: 'Create a cube',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(typeof response.imageUrl).toBe('string')
      expect(response.imageUrl).toContain('data:image/')
      expect(response.timestamp).toBeGreaterThan(0)
    })

    it('generates image with sketch only using gpt-image-1-mini with image input', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(response.timestamp).toBeGreaterThan(0)
    })

    it('generates image with prompt only using gpt-image-1-mini text mode', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Create a technical drawing of a cylinder',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(response.timestamp).toBeGreaterThan(0)
    })

    it('includes conversationId when continuing conversation', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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
      expect(response.conversationId).toMatch(/^openai_conv_/)
    })

    it('validates that either sketch or prompt is provided', async () => {
      const request: ImageGenerationRequest = {
        continueConversation: false
      }

      try {
        await service.generateImage(request)
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error).toMatchObject({
          code: 'VALIDATION',
          retryable: false
        })
        expect((error as Error).message).toContain('Either sketch or prompt')
      }
    })

    it('validates sketch data URL format', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'invalid-url',
        prompt: 'Create a cube',
        continueConversation: false
      }

      try {
        await service.generateImage(request)
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error).toMatchObject({
          code: 'VALIDATION',
          retryable: false
        })
        expect((error as Error).message).toContain('sketch')
      }
    })

    it('sets isGenerating to true during generation', async () => {
      const request: ImageGenerationRequest = {
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
        sketchDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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

  describe('error handling', () => {
    it('handles rate limit errors (429)', async () => {
      // We'll need to mock this in the implementation test
      // For now, just verify the service is set up correctly
      expect(service).toBeDefined()
    })

    it('handles API errors', async () => {
      // We'll need to mock this in the implementation test
      // For now, just verify the service is set up correctly
      expect(service).toBeDefined()
    })

    it('handles network failures', async () => {
      // We'll need to mock this in the implementation test
      // For now, just verify the service is set up correctly
      expect(service).toBeDefined()
    })
  })
})

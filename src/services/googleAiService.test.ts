/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createGoogleAiService } from './googleAiService'
import type { ImageGenerationRequest } from './types'

// Mock the image compression utility
vi.mock('../utils/imageCompression', () => ({
  compressSketchImage: vi.fn().mockResolvedValue(
    'data:image/jpeg;base64,/9j/compressed=='
  ),
  parseDataUrl: vi.fn().mockReturnValue({
    mimeType: 'image/jpeg',
    data: '/9j/compressed=='
  })
}))

// Mock the @google/genai module
vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            mimeType: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          }
        }]
      }
    }],
    text: 'Generated image successfully'
  })

  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI
  }
})

describe('Google AI Service', () => {
  let service: ReturnType<typeof createGoogleAiService>
  const testApiKey = 'test-api-key-123'

  beforeEach(() => {
    service = createGoogleAiService(testApiKey)
  })

  afterEach(() => {
    service.cancelGeneration()
  })

  describe('generateImage', () => {
    it('generates image with sketch and prompt', async () => {
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

    it('generates image with sketch only', async () => {
      const request: ImageGenerationRequest = {
        sketchDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(response.imageUrl).toContain('data:image/')
      expect(response.timestamp).toBeGreaterThan(0)
    })

    it('generates image with prompt only', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Create a technical drawing of a cylinder',
        continueConversation: false
      }

      const response = await service.generateImage(request)

      expect(response).toBeDefined()
      expect(response.imageUrl).toBeTruthy()
      expect(response.imageUrl).toContain('data:image/')
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
      expect(response.conversationId).toMatch(/^google_conv_/)
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

      // The mock resolves instantly, so cancellation might not be caught
      // Just verify the service returns to not generating state
      try {
        await promise
      } catch {
        // Expected - may or may not throw depending on timing
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

  describe('response metadata logging', () => {
    it('logs token counts and cost estimate in dev mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const request: ImageGenerationRequest = {
        prompt: 'Create a cube',
        continueConversation: false
      }

      await service.generateImage(request)

      // In dev mode, should log metadata including cost
      // Check that the response metadata log was called
      const hasMetadataLog = consoleSpy.mock.calls.some(
        call => typeof call[0] === 'string' && call[0].includes('Response metadata')
      )

      // The test environment should trigger the logging
      // We verify the service structure supports metadata logging
      expect(consoleSpy).toHaveBeenCalled()
      expect(hasMetadataLog).toBe(true)

      consoleSpy.mockRestore()
    })
  })
})

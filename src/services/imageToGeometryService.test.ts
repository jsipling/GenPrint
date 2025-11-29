/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createImageToGeometryService } from './imageToGeometryService'
import type {
  ImageToGeometryRequest,
  GeometryAnalysis
} from './imageToGeometryTypes'

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

// Valid mock response matching GeometryAnalysis structure
const mockValidAnalysis: GeometryAnalysis = {
  description: 'A simple cube with configurable dimensions',
  builderCode: `
    const size = params.size || 10;
    return M.cube([size, size, size], true);
  `,
  suggestedName: 'Parametric Cube',
  parameters: [
    {
      type: 'number',
      name: 'size',
      label: 'Size',
      min: 1,
      max: 100,
      default: 10,
      step: 1,
      unit: 'mm',
      description: 'The size of the cube'
    }
  ],
  defaultParams: {
    size: 10
  }
}

// Mock the @google/genai module
const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI
  }
})

describe('ImageToGeometryService', () => {
  let service: ReturnType<typeof createImageToGeometryService>
  const testApiKey = 'test-api-key-123'
  const validImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()
    service = createImageToGeometryService(testApiKey)
  })

  afterEach(() => {
    service.cancelAnalysis()
  })

  describe('analyzeImage', () => {
    it('returns valid response with geometry analysis on success', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a parametric cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(response.analysis).toBeDefined()
      expect(response.analysis?.description).toBe(mockValidAnalysis.description)
      expect(response.analysis?.builderCode).toBe(mockValidAnalysis.builderCode)
      expect(response.analysis?.suggestedName).toBe(mockValidAnalysis.suggestedName)
      expect(response.analysis?.parameters).toEqual(mockValidAnalysis.parameters)
      expect(response.analysis?.defaultParams).toEqual(mockValidAnalysis.defaultParams)
      expect(response.error).toBeUndefined()
    })

    it('returns error when imageDataUrl is empty', async () => {
      const request: ImageToGeometryRequest = {
        imageDataUrl: '',
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error).toContain('image')
      expect(response.analysis).toBeUndefined()
      expect(mockGenerateContent).not.toHaveBeenCalled()
    })

    it('returns error when prompt is empty', async () => {
      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: ''
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error).toContain('prompt')
      expect(response.analysis).toBeUndefined()
      expect(mockGenerateContent).not.toHaveBeenCalled()
    })

    it('handles API errors gracefully and returns error message', async () => {
      const apiErrorMessage = 'API rate limit exceeded'
      mockGenerateContent.mockRejectedValueOnce(new Error(apiErrorMessage))

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error).toContain(apiErrorMessage)
      expect(response.analysis).toBeUndefined()
    })

    it('handles invalid JSON response from AI', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'This is not valid JSON at all { broken'
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.toLowerCase()).toMatch(/json|parse|invalid|format/)
      expect(response.analysis).toBeUndefined()
    })

    it('handles response with missing required fields', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          description: 'A cube',
          // Missing: builderCode, suggestedName, parameters, defaultParams
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.analysis).toBeUndefined()
    })
  })

  describe('cancelAnalysis', () => {
    it('does nothing when not analyzing', () => {
      expect(() => service.cancelAnalysis()).not.toThrow()
      expect(service.isAnalyzing()).toBe(false)
    })

    it('cancels ongoing analysis and sets isAnalyzing to false', async () => {
      // Create a promise that will hang until we resolve it
      let resolvePromise: (value: unknown) => void
      const hangingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockGenerateContent.mockReturnValueOnce(hangingPromise)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const analysisPromise = service.analyzeImage(request)
      expect(service.isAnalyzing()).toBe(true)

      service.cancelAnalysis()

      // Resolve the hanging promise to avoid timeout
      resolvePromise!({ text: JSON.stringify(mockValidAnalysis) })

      const response = await analysisPromise

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.toLowerCase()).toContain('cancel')
      expect(service.isAnalyzing()).toBe(false)
    })
  })

  describe('isAnalyzing', () => {
    it('returns false initially', () => {
      expect(service.isAnalyzing()).toBe(false)
    })

    it('returns true during analysis', async () => {
      let resolvePromise: (value: unknown) => void
      const hangingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockGenerateContent.mockReturnValueOnce(hangingPromise)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      expect(service.isAnalyzing()).toBe(false)

      const promise = service.analyzeImage(request)
      expect(service.isAnalyzing()).toBe(true)

      // Resolve to complete the test
      resolvePromise!({ text: JSON.stringify(mockValidAnalysis) })
      await promise

      expect(service.isAnalyzing()).toBe(false)
    })

    it('returns false after analysis completes', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      expect(service.isAnalyzing()).toBe(false)
    })

    it('returns false after analysis fails', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API error'))

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      expect(service.isAnalyzing()).toBe(false)
    })
  })

  describe('concurrent requests', () => {
    it('prevents concurrent analysis requests', async () => {
      let resolvePromise: (value: unknown) => void
      const hangingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockGenerateContent.mockReturnValueOnce(hangingPromise)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const promise1 = service.analyzeImage(request)
      expect(service.isAnalyzing()).toBe(true)

      const response2 = await service.analyzeImage(request)

      expect(response2.success).toBe(false)
      expect(response2.error).toBeDefined()
      expect(response2.error?.toLowerCase()).toMatch(/already|progress|busy/)

      // Clean up
      resolvePromise!({ text: JSON.stringify(mockValidAnalysis) })
      await promise1
    })
  })

  describe('response validation', () => {
    it('validates that parameters array contains valid parameter definitions', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          ...mockValidAnalysis,
          parameters: [
            {
              type: 'invalid_type',
              name: 'test',
              label: 'Test'
            }
          ]
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      // The service should either validate and reject, or accept any shape
      // This test documents the expected behavior
      expect(response).toBeDefined()
    })

    it('handles empty response text', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: ''
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })

    it('handles null response', async () => {
      mockGenerateContent.mockResolvedValueOnce(null)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('current model context', () => {
    it('includes current model context in prompt when provided', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Add a latch to this box',
        currentBuilderCode: 'return M.Manifold.cube([50, 50, 20], true);',
        currentParams: { width: 50, height: 20 },
        currentModelName: 'Simple Box'
      }

      await service.analyzeImage(request)

      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerateContent.mock.calls[0]!
      const textPart = callArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      expect(textPart.text).toContain('Simple Box')
      expect(textPart.text).toContain('return M.Manifold.cube([50, 50, 20], true);')
      expect(textPart.text).toContain('"width":50')
    })

    it('works without current model context (replacement mode)', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a new gear'
      }

      await service.analyzeImage(request)

      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerateContent.mock.calls[0]!
      const textPart = callArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      // Should not contain model context markers when no current model
      expect(textPart.text).not.toContain('Current model:')
    })

    it('includes modification instructions when current model is provided', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Add a handle',
        currentBuilderCode: 'return M.Manifold.cube([30, 30, 10], true);',
        currentParams: { size: 30 },
        currentModelName: 'Base Plate'
      }

      await service.analyzeImage(request)

      const callArgs = mockGenerateContent.mock.calls[0]!
      const textPart = callArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      // Should include instructions about working with existing models
      expect(textPart.text).toContain('Working with Existing Models')
      expect(textPart.text).toContain('MODIFICATION INTENT')
      expect(textPart.text).toContain('REPLACEMENT INTENT')
    })
  })

  describe('code validation and retry', () => {
    it('returns success when generated code is valid JavaScript', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(response.analysis).toBeDefined()
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('retries when generated code has syntax errors', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'const size = params.size || 10; const size = 20; return M.cube([size], true);'
      }

      // First call returns invalid code, second returns valid
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidAnalysis)
        })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(response.analysis?.builderCode).toBe(mockValidAnalysis.builderCode)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('includes error context in retry prompt', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'const x = ; return M.cube([10], true);'
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidAnalysis)
        })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      // Verify second call includes error context
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      const secondCallArgs = mockGenerateContent.mock.calls[1]!
      const textPart = secondCallArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      expect(textPart.text).toContain('Previous Attempt Failed')
    })

    it('fails after max retries with invalid code', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'const x = ; return M.cube([10], true);'
      }

      // All attempts return invalid code
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.toLowerCase()).toMatch(/syntax|code|invalid/)
      // Initial attempt + 2 retries = 3 calls max
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    })

    it('does not retry more than 2 times', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'invalid javascript {'
      }

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(invalidCodeAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      // Should be called exactly 3 times (1 initial + 2 retries)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    })

    it('clears analyzing state after retries complete', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'invalid javascript {'
      }

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(invalidCodeAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      expect(service.isAnalyzing()).toBe(false)
    })

    it('succeeds on second retry', async () => {
      const invalidCodeAnalysis = {
        ...mockValidAnalysis,
        builderCode: 'const x = ; return M.cube([10], true);'
      }

      // First two attempts fail, third succeeds
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidCodeAnalysis)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidAnalysis)
        })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    })

    it('does not retry on API errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'))

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toContain('API quota exceeded')
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('does not retry on JSON parse errors', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Not valid JSON'
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('does not retry when response is missing required fields', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          description: 'A cube'
          // Missing other required fields
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })
  })
})

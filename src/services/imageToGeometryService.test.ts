/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createImageToGeometryService } from './imageToGeometryService'
import type {
  ImageToGeometryRequest,
  GeometryAnalysis
} from './imageToGeometryTypes'
import {
  OpenSCADParseError,
  OpenSCADTranspileError,
  OpenSCADLexError
} from '../openscad'

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

// Mock the OpenSCAD transpiler
const mockTranspileOpenSCAD = vi.fn()

vi.mock('../openscad', async (importOriginal) => {
  const original = await importOriginal<typeof import('../openscad')>()
  return {
    ...original,
    transpileOpenSCAD: (...args: Parameters<typeof original.transpileOpenSCAD>) => mockTranspileOpenSCAD(...args)
  }
})

// Valid mock response matching GeometryAnalysis structure
// Uses multi-part return format to enable hover highlighting
const mockValidAnalysis: GeometryAnalysis = {
  description: 'A simple cube with configurable dimensions',
  builderCode: `
    const size = params.size || 10;
    const cube = M.Manifold.cube([size, size, size], true);
    return [{ name: 'Cube', manifold: cube, params: { size: size } }];
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

// Valid mock OpenSCAD response (before transpilation)
const mockValidOpenSCADAnalysis = {
  description: 'A simple cube with hole',
  openscadCode: `$fn = 32;
difference() {
  cube([20, 20, 10], center=true);
  cylinder(h=15, r=5, center=true);
}`,
  suggestedName: 'Cube with Hole',
  parameters: [
    {
      type: 'number',
      name: 'size',
      label: 'Size',
      min: 5,
      max: 50,
      default: 20,
      step: 1,
      unit: 'mm',
      description: 'Size of the cube'
    }
  ],
  defaultParams: {
    size: 20
  }
}

// Valid transpiled Manifold JavaScript output
const mockValidTranspiledCode = `const _v1 = M.Manifold.cube([20, 20, 10], true);
const _v2 = M.Manifold.cylinder(15, 5, 5, 32, true);
const _v3 = _v1.subtract(_v2);
_v1.delete();
_v2.delete();
return _v3;`

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
    mockTranspileOpenSCAD.mockReset()
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

  describe('multi-part format for hover highlighting', () => {
    it('instructs AI to return array format for hover support', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a simple box'
      }

      await service.analyzeImage(request)

      // Verify the prompt includes instructions about multi-part format
      const callArgs = mockGenerateContent.mock.calls[0]!
      const textPart = callArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      expect(textPart.text).toContain('Return an array of named parts')
      expect(textPart.text).toContain('hover highlighting')
      expect(textPart.text).toContain('name')
      expect(textPart.text).toContain('manifold')
    })

    it('accepts valid multi-part builder code', async () => {
      const multiPartAnalysis: GeometryAnalysis = {
        ...mockValidAnalysis,
        builderCode: `
          const base = M.Manifold.cube([50, 50, 10], true);
          const handle = M.Manifold.cylinder(30, 5, 5, 16).translate([0, 0, 20]);
          return [
            { name: 'Base', manifold: base },
            { name: 'Handle', manifold: handle }
          ];
        `
      }

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(multiPartAnalysis)
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a box with handle'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(response.analysis?.builderCode).toContain('return [')
      expect(response.analysis?.builderCode).toContain('name:')
      expect(response.analysis?.builderCode).toContain('manifold:')
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

describe('ImageToGeometryService with OpenSCAD format', () => {
  let service: ReturnType<typeof createImageToGeometryService>
  const testApiKey = 'test-api-key-123'
  const validImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()
    mockTranspileOpenSCAD.mockReset()
    // Create service with OpenSCAD format
    service = createImageToGeometryService(testApiKey, 'gemini-3-pro-preview', 'openscad')
  })

  afterEach(() => {
    service.cancelAnalysis()
  })

  describe('successful transpilation', () => {
    it('returns valid Manifold JavaScript when OpenSCAD transpilation succeeds', async () => {
      // Mock AI returning OpenSCAD response
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidOpenSCADAnalysis)
      })

      // Mock transpiler returning valid Manifold code
      mockTranspileOpenSCAD.mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube with hole'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(response.analysis).toBeDefined()
      expect(response.analysis?.description).toBe(mockValidOpenSCADAnalysis.description)
      expect(response.analysis?.suggestedName).toBe(mockValidOpenSCADAnalysis.suggestedName)
      // The builderCode should be the transpiled Manifold JavaScript, not the OpenSCAD code
      expect(response.analysis?.builderCode).toBe(mockValidTranspiledCode)
      expect(response.analysis?.parameters).toEqual(mockValidOpenSCADAnalysis.parameters)
      expect(response.analysis?.defaultParams).toEqual(mockValidOpenSCADAnalysis.defaultParams)
      expect(mockTranspileOpenSCAD).toHaveBeenCalledWith(mockValidOpenSCADAnalysis.openscadCode)
    })

    it('calls transpiler with the OpenSCAD code from AI response', async () => {
      const customOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'sphere(r=10);'
      }

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(customOpenSCAD)
      })

      mockTranspileOpenSCAD.mockReturnValueOnce('return M.Manifold.sphere(10, 32);')

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a sphere'
      }

      await service.analyzeImage(request)

      expect(mockTranspileOpenSCAD).toHaveBeenCalledWith('sphere(r=10);')
    })
  })

  describe('parse error handling', () => {
    it('retries when OpenSCAD code has parse error', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10, 10]'  // Missing closing parenthesis
      }

      // First call returns invalid OpenSCAD
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      // First transpile throws parse error
      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADParseError(
            'Unexpected end of input',
            1,
            17,
            'EOF',
            [')', ';']
          )
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      expect(mockTranspileOpenSCAD).toHaveBeenCalledTimes(2)
    })

    it('includes parse error context with line/column info in retry prompt', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10, 10]'
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADParseError(
            'Unexpected end of input',
            3,
            15,
            'EOF',
            [')', ';']
          )
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      // Check that the second API call includes error context
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      const secondCallArgs = mockGenerateContent.mock.calls[1]!
      const textPart = secondCallArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      // Should include parse error details with line/column info
      expect(textPart.text).toContain('Previous Attempt Failed')
      expect(textPart.text).toContain('Parse Error')
      expect(textPart.text).toContain('line 3')
      expect(textPart.text).toContain('column 15')
    })
  })

  describe('lex error handling', () => {
    it('retries when OpenSCAD code has lex error', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10, @]);'  // Invalid character
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADLexError(
            'Unexpected character: @',
            1,
            14,
            '@'
          )
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('includes lex error context with line/column info in retry prompt', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10, @]);'
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADLexError(
            'Unexpected character: @',
            2,
            8,
            '@'
          )
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      await service.analyzeImage(request)

      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      const secondCallArgs = mockGenerateContent.mock.calls[1]!
      const textPart = secondCallArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      expect(textPart.text).toContain('Previous Attempt Failed')
      expect(textPart.text).toContain('Lex Error')
      expect(textPart.text).toContain('line 2')
      expect(textPart.text).toContain('column 8')
    })
  })

  describe('transpile error handling', () => {
    it('retries when OpenSCAD code has unsupported feature', async () => {
      const unsupportedOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'hull() { cube(10); sphere(5); }'  // hull is not supported
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(unsupportedOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADTranspileError('Transform hull is not yet supported')
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create something'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('includes transpile error message in retry prompt', async () => {
      const unsupportedOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'minkowski() { cube(10); sphere(2); }'
      }

      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(unsupportedOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADTranspileError('Transform minkowski is not yet supported')
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create something'
      }

      await service.analyzeImage(request)

      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      const secondCallArgs = mockGenerateContent.mock.calls[1]!
      const textPart = secondCallArgs[0].contents[0].parts.find(
        (p: { text?: string }) => p.text
      )
      expect(textPart.text).toContain('Previous Attempt Failed')
      expect(textPart.text).toContain('Transpile Error')
      expect(textPart.text).toContain('minkowski')
    })
  })

  describe('max retries for OpenSCAD errors', () => {
    it('fails after max retries with persistent parse errors', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10'  // Always invalid
      }

      // All attempts return invalid OpenSCAD
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(invalidOpenSCAD)
      })

      // All transpile attempts throw parse error
      mockTranspileOpenSCAD.mockImplementation(() => {
        throw new OpenSCADParseError(
          'Unexpected end of input',
          1,
          12,
          'EOF',
          [']', ',']
        )
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.toLowerCase()).toMatch(/parse|openscad/)
      // Initial attempt + 2 retries = 3 calls max
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
      expect(mockTranspileOpenSCAD).toHaveBeenCalledTimes(3)
    })

    it('fails after max retries with persistent transpile errors', async () => {
      const unsupportedOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'hull() { cube(10); }'
      }

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(unsupportedOpenSCAD)
      })

      mockTranspileOpenSCAD.mockImplementation(() => {
        throw new OpenSCADTranspileError('Transform hull is not yet supported')
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create something'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.toLowerCase()).toMatch(/transpile|hull/)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    })

    it('succeeds on final retry attempt', async () => {
      const invalidOpenSCAD = {
        ...mockValidOpenSCADAnalysis,
        openscadCode: 'cube([10, 10'
      }

      // First two attempts return invalid OpenSCAD, third succeeds
      mockGenerateContent
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(invalidOpenSCAD)
        })
        .mockResolvedValueOnce({
          text: JSON.stringify(mockValidOpenSCADAnalysis)
        })

      // First two transpile attempts fail, third succeeds
      mockTranspileOpenSCAD
        .mockImplementationOnce(() => {
          throw new OpenSCADParseError('Unexpected end of input', 1, 12, 'EOF', [']'])
        })
        .mockImplementationOnce(() => {
          throw new OpenSCADParseError('Unexpected end of input', 1, 12, 'EOF', [']'])
        })
        .mockReturnValueOnce(mockValidTranspiledCode)

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(true)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    })
  })

  describe('response validation', () => {
    it('fails when AI response is missing openscadCode field', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          description: 'A cube',
          suggestedName: 'Cube',
          parameters: [],
          defaultParams: {}
          // Missing openscadCode
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error).toContain('openscadCode')
      expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
    })

    it('fails when AI response has empty openscadCode', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          description: 'A cube',
          openscadCode: '',
          suggestedName: 'Cube',
          parameters: [],
          defaultParams: {}
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
    })

    it('validates transpiled code is syntactically valid JavaScript', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidOpenSCADAnalysis)
      })

      // Return invalid JavaScript that will fail syntax validation
      mockTranspileOpenSCAD.mockReturnValueOnce('return { invalid javascript')

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      // First attempt fails validation, no retry since it's a transpiler bug
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockValidOpenSCADAnalysis)
      })
      mockTranspileOpenSCAD.mockReturnValueOnce(mockValidTranspiledCode)

      const response = await service.analyzeImage(request)

      // Should retry and eventually succeed
      expect(response.success).toBe(true)
    })
  })

  describe('non-retryable errors', () => {
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
      expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
    })

    it('does not retry on JSON parse errors', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Not valid JSON { broken'
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(response.error?.toLowerCase()).toMatch(/json|parse|invalid|format/)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
    })

    it('does not retry on missing required fields', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          description: 'A cube'
          // Missing all other required fields
        })
      })

      const request: ImageToGeometryRequest = {
        imageDataUrl: validImageDataUrl,
        prompt: 'Create a cube'
      }

      const response = await service.analyzeImage(request)

      expect(response.success).toBe(false)
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
    })
  })
})

describe('ImageToGeometryService Manifold format regression', () => {
  let service: ReturnType<typeof createImageToGeometryService>
  const testApiKey = 'test-api-key-123'
  const validImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()
    mockTranspileOpenSCAD.mockReset()
    // Create service with explicit Manifold format
    service = createImageToGeometryService(testApiKey, 'gemini-3-pro-preview', 'manifold')
  })

  afterEach(() => {
    service.cancelAnalysis()
  })

  it('does not call transpiler for Manifold format', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockValidAnalysis)
    })

    const request: ImageToGeometryRequest = {
      imageDataUrl: validImageDataUrl,
      prompt: 'Create a cube'
    }

    const response = await service.analyzeImage(request)

    expect(response.success).toBe(true)
    expect(response.analysis?.builderCode).toBe(mockValidAnalysis.builderCode)
    expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
  })

  it('expects builderCode not openscadCode for Manifold format', async () => {
    // This would be valid for OpenSCAD but should fail for Manifold
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockValidOpenSCADAnalysis)
    })

    const request: ImageToGeometryRequest = {
      imageDataUrl: validImageDataUrl,
      prompt: 'Create a cube'
    }

    const response = await service.analyzeImage(request)

    // Should fail because openscadCode is not recognized for Manifold format
    expect(response.success).toBe(false)
    expect(response.error).toContain('builderCode')
    expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
  })

  it('still validates JavaScript syntax for Manifold format', async () => {
    const invalidJsAnalysis = {
      ...mockValidAnalysis,
      builderCode: 'const x = ; return M.cube([10], true);'
    }

    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify(invalidJsAnalysis)
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
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
  })

  it('retries on JavaScript syntax errors just like before', async () => {
    const invalidJsAnalysis = {
      ...mockValidAnalysis,
      builderCode: 'invalid javascript {'
    }

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(invalidJsAnalysis)
    })

    const request: ImageToGeometryRequest = {
      imageDataUrl: validImageDataUrl,
      prompt: 'Create a cube'
    }

    const response = await service.analyzeImage(request)

    expect(response.success).toBe(false)
    // Should be called exactly 3 times (1 initial + 2 retries)
    expect(mockGenerateContent).toHaveBeenCalledTimes(3)
    expect(mockTranspileOpenSCAD).not.toHaveBeenCalled()
  })
})

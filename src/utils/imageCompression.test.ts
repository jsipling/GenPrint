/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { compressSketchImage, parseDataUrl } from './imageCompression'

// Minimal valid 1x1 PNG (red pixel)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`

// Mock canvas context
interface MockCanvasContext {
  fillStyle: string
  fillRect: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
}

// Track mock state for assertions
let mockCanvasWidth = 0
let mockCanvasHeight = 0
let mockImageWidth = 100
let mockImageHeight = 100
let mockToDataURLCalls: Array<{ type: string; quality: number }> = []

// Mock Image class for controlled loading
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  width = mockImageWidth
  height = mockImageHeight

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    // Simulate async image loading
    setTimeout(() => {
      if (value.startsWith('data:image/')) {
        this.onload?.()
      } else {
        this.onerror?.()
      }
    }, 0)
  }
}

// Mock canvas element
function createMockCanvas() {
  const mockCtx: MockCanvasContext = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn()
  }

  return {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn((type: string, quality: number) => {
      mockToDataURLCalls.push({ type, quality })
      // Return a mock JPEG data URL
      return 'data:image/jpeg;base64,/9j/mock=='
    }),
    _ctx: mockCtx
  }
}

let mockCanvas: ReturnType<typeof createMockCanvas>

beforeEach(() => {
  mockCanvasWidth = 0
  mockCanvasHeight = 0
  mockImageWidth = 100
  mockImageHeight = 100
  mockToDataURLCalls = []
  mockCanvas = createMockCanvas()

  // Mock document.createElement for canvas
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      const canvas = mockCanvas as unknown as HTMLCanvasElement
      // Track width/height assignments
      Object.defineProperty(canvas, 'width', {
        get: () => mockCanvasWidth,
        set: (v: number) => {
          mockCanvasWidth = v
        },
        configurable: true
      })
      Object.defineProperty(canvas, 'height', {
        get: () => mockCanvasHeight,
        set: (v: number) => {
          mockCanvasHeight = v
        },
        configurable: true
      })
      return canvas
    }
    return originalCreateElement(tagName)
  })

  // Mock Image constructor
  vi.stubGlobal('Image', MockImage)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('parseDataUrl', () => {
  it('extracts mimeType and base64 data from PNG', () => {
    const result = parseDataUrl(TINY_PNG_DATA_URL)

    expect(result.mimeType).toBe('image/png')
    expect(result.data).toBe(TINY_PNG_BASE64)
  })

  it('extracts mimeType and base64 data from JPEG', () => {
    const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    const result = parseDataUrl(jpegDataUrl)

    expect(result.mimeType).toBe('image/jpeg')
    expect(result.data).toBe('/9j/4AAQSkZJRg==')
  })

  it('throws on invalid format - missing base64 prefix', () => {
    expect(() => parseDataUrl('data:image/png,invaliddata')).toThrow(
      'Invalid data URL format'
    )
  })

  it('throws on invalid format - no data prefix', () => {
    expect(() => parseDataUrl('image/png;base64,abc123')).toThrow(
      'Invalid data URL format'
    )
  })

  it('throws on non-string input', () => {
    expect(() => parseDataUrl(null as unknown as string)).toThrow()
  })
})

describe('compressSketchImage', () => {
  describe('basic functionality', () => {
    it('returns a data URL string', async () => {
      const result = await compressSketchImage(TINY_PNG_DATA_URL)

      expect(typeof result).toBe('string')
      expect(result).toMatch(/^data:image\//)
    })

    it('returns JPEG format output by default', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockToDataURLCalls.length).toBe(1)
      expect(mockToDataURLCalls[0]?.type).toBe('image/jpeg')
    })

    it('creates canvas and draws image', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
      expect(mockCanvas._ctx.fillRect).toHaveBeenCalled()
      expect(mockCanvas._ctx.drawImage).toHaveBeenCalled()
    })
  })

  describe('size handling', () => {
    it('does not resize images smaller than maxSize (1024px)', async () => {
      mockImageWidth = 500
      mockImageHeight = 400

      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvasWidth).toBe(500)
      expect(mockCanvasHeight).toBe(400)
    })

    it('resizes images larger than maxSize on width', async () => {
      mockImageWidth = 2048
      mockImageHeight = 512

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 1024 })

      expect(mockCanvasWidth).toBe(1024)
      expect(mockCanvasHeight).toBe(256) // Maintains 4:1 aspect ratio
    })

    it('resizes images larger than maxSize on height', async () => {
      mockImageWidth = 512
      mockImageHeight = 2048

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 1024 })

      expect(mockCanvasWidth).toBe(256) // Maintains 1:4 aspect ratio
      expect(mockCanvasHeight).toBe(1024)
    })

    it('resizes images where both dimensions exceed maxSize', async () => {
      mockImageWidth = 2000
      mockImageHeight = 1500

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 1024 })

      // Width is larger, so it becomes 1024, height scales proportionally
      expect(mockCanvasWidth).toBe(1024)
      expect(mockCanvasHeight).toBe(768) // 1500 * (1024/2000) = 768
    })

    it('maintains aspect ratio when resizing', async () => {
      mockImageWidth = 1600
      mockImageHeight = 900
      const originalAspectRatio = mockImageWidth / mockImageHeight

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 800 })

      const resultAspectRatio = mockCanvasWidth / mockCanvasHeight
      expect(resultAspectRatio).toBeCloseTo(originalAspectRatio, 2)
    })

    it('handles images exactly at maxSize', async () => {
      mockImageWidth = 1024
      mockImageHeight = 768

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 1024 })

      expect(mockCanvasWidth).toBe(1024)
      expect(mockCanvasHeight).toBe(768)
    })
  })

  describe('quality settings', () => {
    it('uses default quality of 0.72', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockToDataURLCalls.length).toBe(1)
      expect(mockToDataURLCalls[0]?.quality).toBe(0.72)
    })

    it('accepts custom quality parameter', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL, { quality: 0.5 })

      expect(mockToDataURLCalls.length).toBe(1)
      expect(mockToDataURLCalls[0]?.quality).toBe(0.5)
    })

    it('accepts custom maxSize parameter', async () => {
      mockImageWidth = 800
      mockImageHeight = 600

      await compressSketchImage(TINY_PNG_DATA_URL, { maxSize: 400 })

      expect(mockCanvasWidth).toBe(400)
      expect(mockCanvasHeight).toBe(300) // Maintains aspect ratio
    })
  })

  describe('edge cases', () => {
    it('handles 1x1 pixel images', async () => {
      mockImageWidth = 1
      mockImageHeight = 1

      const result = await compressSketchImage(TINY_PNG_DATA_URL)

      expect(result).toMatch(/^data:image\/jpeg/)
      expect(mockCanvasWidth).toBe(1)
      expect(mockCanvasHeight).toBe(1)
    })

    it('handles square images', async () => {
      mockImageWidth = 500
      mockImageHeight = 500

      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvasWidth).toBe(mockCanvasHeight)
    })

    it('handles landscape images', async () => {
      mockImageWidth = 800
      mockImageHeight = 400

      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvasWidth).toBeGreaterThan(mockCanvasHeight)
    })

    it('handles portrait images', async () => {
      mockImageWidth = 400
      mockImageHeight = 800

      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvasHeight).toBeGreaterThan(mockCanvasWidth)
    })

    it('fills canvas with white background for transparency', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvas._ctx.fillStyle).toBe('white')
      expect(mockCanvas._ctx.fillRect).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('throws on invalid data URL format', async () => {
      await expect(compressSketchImage('not-a-data-url')).rejects.toThrow(
        'Invalid data URL format'
      )
    })

    it('throws on non-image data URL', async () => {
      const textDataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='
      await expect(compressSketchImage(textDataUrl)).rejects.toThrow(
        'Failed to load image'
      )
    })

    it('throws when canvas context unavailable', async () => {
      mockCanvas.getContext = vi.fn().mockReturnValue(null)

      await expect(compressSketchImage(TINY_PNG_DATA_URL)).rejects.toThrow(
        'Failed to get canvas context'
      )
    })
  })

  describe('default options', () => {
    it('uses 1024 as default maxSize', async () => {
      mockImageWidth = 2000
      mockImageHeight = 1000

      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockCanvasWidth).toBe(1024)
    })

    it('uses 0.72 as default quality', async () => {
      await compressSketchImage(TINY_PNG_DATA_URL)

      expect(mockToDataURLCalls[0]?.quality).toBe(0.72)
    })
  })
})

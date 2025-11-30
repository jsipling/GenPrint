/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createCompositeImage } from './sketchComposite'
import type { MultiViewSketchData } from '../types/sketch'

describe('createCompositeImage', () => {
  let mockCanvas: HTMLCanvasElement
  let mockContext: CanvasRenderingContext2D
  let mockImage: {
    src: string
    width: number
    height: number
    onload: (() => void) | null
    onerror: ((err: Event) => void) | null
  }

  beforeEach(() => {
    // Create mock canvas and context
    mockCanvas = document.createElement('canvas')
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: ''
    } as unknown as CanvasRenderingContext2D

    // Create mock image that auto-triggers onload
    mockImage = {
      src: '',
      width: 250,
      height: 250,
      onload: null,
      onerror: null
    }

    // Mock Image constructor - use class syntax
    global.Image = class {
      src = ''
      width = 250
      height = 250
      onload: (() => void) | null = null
      onerror: ((err: Event) => void) | null = null

      constructor() {
        // Auto-trigger onload after setting src
        setTimeout(() => {
          if (this.onload) {
            this.onload()
          }
        }, 0)
      }
    } as unknown as typeof Image

    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)
    vi.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext)
    mockCanvas.toDataURL = vi.fn(() => 'data:image/png;base64,composite')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty string when all views are empty', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: true },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    const result = await createCompositeImage(data)
    expect(result).toBe('')
  })

  it('creates composite with only non-empty views', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: false }
    }

    const result = await createCompositeImage(data)

    expect(result).toBe('data:image/png;base64,composite')
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  it('arranges views horizontally', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: false },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: false }
    }

    await createCompositeImage(data)

    // Canvas should be created with appropriate width for 3 views
    // Each view is 250px wide, with 20px spacing, plus 40px padding
    // Width = 40 + 250 + 20 + 250 + 20 + 250 + 40 = 870px
    // Height = 40 + 40 + 250 + 40 = 370px (40px top padding, 40px label, 250px canvas, 40px bottom)
    expect(mockCanvas.width).toBeGreaterThan(700) // Should accommodate 3 views
  })

  it('adds labels above each view', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    await createCompositeImage(data)

    // Should have drawn label for top view
    expect(mockContext.fillText).toHaveBeenCalledWith(
      expect.stringContaining('Top'),
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('handles single view correctly', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    const result = await createCompositeImage(data)

    expect(result).toBe('data:image/png;base64,composite')
    // Canvas should be narrower with only one view
    expect(mockCanvas.width).toBeLessThan(400)
  })

  it('preserves view order: top, side, front', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: false },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: false }
    }

    await createCompositeImage(data)

    // Check that fillText was called in the correct order
    const calls = (mockContext.fillText as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0]).toContain('Top')
    expect(calls[1]?.[0]).toContain('Side')
    expect(calls[2]?.[0]).toContain('Front')
  })

  it('uses white background for composite', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    // Track fillStyle changes
    const fillStyleSetter = vi.fn()
    Object.defineProperty(mockContext, 'fillStyle', {
      get: () => mockContext.fillStyle,
      set: fillStyleSetter
    })

    await createCompositeImage(data)

    // Should have set fillStyle to white at some point (for background)
    expect(fillStyleSetter).toHaveBeenCalledWith('#ffffff')
    expect(mockContext.fillRect).toHaveBeenCalled()
  })

  it('loads images before drawing', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    await createCompositeImage(data)

    expect(mockContext.drawImage).toHaveBeenCalled()
  })

  it('handles image load errors gracefully', async () => {
    const data: MultiViewSketchData = {
      top: { view: 'top', dataUrl: 'data:image/png;base64,top', isEmpty: false },
      side: { view: 'side', dataUrl: 'data:image/png;base64,side', isEmpty: true },
      front: { view: 'front', dataUrl: 'data:image/png;base64,front', isEmpty: true }
    }

    // Mock Image constructor that triggers error
    global.Image = class {
      src = ''
      width = 250
      height = 250
      onload: (() => void) | null = null
      onerror: ((err: Event) => void) | null = null

      constructor() {
        // Auto-trigger onerror after setting src
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new Event('error'))
          }
        }, 0)
      }
    } as unknown as typeof Image

    const result = await createCompositeImage(data)

    // Should return empty string on error
    expect(result).toBe('')
  })
})

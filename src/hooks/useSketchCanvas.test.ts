/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSketchCanvas } from './useSketchCanvas'

describe('useSketchCanvas', () => {
  let canvas: HTMLCanvasElement
  let mockContext: Partial<CanvasRenderingContext2D>

  // Helper to create mock mouse events
  const createMouseEvent = (offsetX: number, offsetY: number): React.MouseEvent<HTMLCanvasElement> => {
    return {
      offsetX,
      offsetY,
      nativeEvent: new MouseEvent('mousemove')
    } as unknown as React.MouseEvent<HTMLCanvasElement>
  }

  beforeEach(() => {
    // Create a real canvas element
    canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400

    // Create mock context with necessary methods
    mockContext = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(400 * 400 * 4),
        width: 400,
        height: 400,
        colorSpace: 'srgb' as PredefinedColorSpace
      })),
      putImageData: vi.fn()
    }

    // Mock getContext
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as CanvasRenderingContext2D)

    // Mock toDataURL on canvas
    canvas.toDataURL = vi.fn(() => 'data:image/png;base64,mockdata') as unknown as () => string
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with default tool as pen', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    expect(result.current.currentTool).toBe('pen')
  })

  it('changes tool when setTool is called', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('circle')
    })

    expect(result.current.currentTool).toBe('circle')
  })

  it('clears the canvas when clear is called', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.clear()
    })

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 400, 400)
  })

  it('supports undo operation', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    // Draw something first to create history
    act(() => {
      result.current.handleMouseDown(createMouseEvent(10, 10))
      result.current.handleMouseMove(createMouseEvent(20, 20))
      result.current.handleMouseUp()
    })

    // Undo should be available
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })

    expect(mockContext.putImageData).toHaveBeenCalled()
  })

  it('exports canvas as data URL', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    const dataUrl = result.current.exportAsDataUrl()

    expect(dataUrl).toBe('data:image/png;base64,mockdata')
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  it('handles drawing with pen tool', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('pen')
      result.current.handleMouseDown(createMouseEvent(10, 10))
      result.current.handleMouseMove(createMouseEvent(20, 20))
      result.current.handleMouseUp()
    })

    expect(mockContext.beginPath).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
  })

  it('handles drawing circles', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('circle')
    })

    // Tool is set correctly
    expect(result.current.currentTool).toBe('circle')

    act(() => {
      result.current.handleMouseDown(createMouseEvent(100, 100))
    })

    act(() => {
      result.current.handleMouseMove(createMouseEvent(150, 150))
    })

    // Circle preview is drawn
    expect(mockContext.arc).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()

    act(() => {
      result.current.handleMouseUp()
    })
  })

  it('handles drawing rectangles', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('rectangle')
    })

    // Tool is set correctly
    expect(result.current.currentTool).toBe('rectangle')

    act(() => {
      result.current.handleMouseDown(createMouseEvent(50, 50))
    })

    act(() => {
      result.current.handleMouseMove(createMouseEvent(150, 150))
    })

    // Rectangle preview is drawn
    expect(mockContext.rect).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()

    act(() => {
      result.current.handleMouseUp()
    })
  })

  it('handles drawing lines', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('line')
      result.current.handleMouseDown(createMouseEvent(10, 10))
      result.current.handleMouseMove(createMouseEvent(100, 100))
      result.current.handleMouseUp()
    })

    expect(mockContext.moveTo).toHaveBeenCalled()
    expect(mockContext.lineTo).toHaveBeenCalled()
  })

  it('handles eraser tool', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    act(() => {
      result.current.setTool('eraser')
      result.current.handleMouseDown(createMouseEvent(50, 50))
      result.current.handleMouseMove(createMouseEvent(60, 60))
      result.current.handleMouseUp()
    })

    // Eraser uses destination-out composite operation, not clearRect
    // It uses stroke instead
    expect(mockContext.stroke).toHaveBeenCalled()
  })

  it('does not draw when mouse is not down', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    const callCountBefore = (mockContext.lineTo as ReturnType<typeof vi.fn>).mock.calls.length

    act(() => {
      // Only move without mouse down
      result.current.handleMouseMove(createMouseEvent(20, 20))
    })

    const callCountAfter = (mockContext.lineTo as ReturnType<typeof vi.fn>).mock.calls.length

    expect(callCountAfter).toBe(callCountBefore)
  })

  it('supports touch events for mobile', () => {
    const { result } = renderHook(() => useSketchCanvas(canvas))

    const touch = {
      clientX: 110,
      clientY: 110
    } as Touch

    const touchEvent = {
      touches: [touch],
      preventDefault: vi.fn()
    } as unknown as React.TouchEvent<HTMLCanvasElement>

    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = vi.fn(() => ({
      left: 10,
      top: 10,
      width: 400,
      height: 400,
      right: 410,
      bottom: 410,
      x: 10,
      y: 10,
      toJSON: () => ({})
    }))

    act(() => {
      result.current.handleTouchStart(touchEvent)
      result.current.handleTouchMove(touchEvent)
      result.current.handleTouchEnd()
    })

    expect(touchEvent.preventDefault).toHaveBeenCalled()
    expect(mockContext.beginPath).toHaveBeenCalled()
  })
})

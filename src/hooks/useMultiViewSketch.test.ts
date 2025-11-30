/** @vitest-environment jsdom */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiViewSketch } from './useMultiViewSketch'
import type { SketchView } from '../types/sketch'

describe('useMultiViewSketch', () => {
  let canvasRefs: Record<SketchView, React.RefObject<HTMLCanvasElement | null>>
  let mockContexts: Record<SketchView, Partial<CanvasRenderingContext2D>>

  const createMouseEvent = (offsetX: number, offsetY: number): React.MouseEvent<HTMLCanvasElement> => {
    return {
      offsetX,
      offsetY,
      nativeEvent: new MouseEvent('mousemove')
    } as unknown as React.MouseEvent<HTMLCanvasElement>
  }

  beforeEach(() => {
    // Create canvases for each view
    const views: SketchView[] = ['top', 'side', 'front']
    canvasRefs = {} as Record<SketchView, React.RefObject<HTMLCanvasElement | null>>
    mockContexts = {} as Record<SketchView, Partial<CanvasRenderingContext2D>>

    views.forEach(view => {
      const canvas = document.createElement('canvas')
      canvas.width = 250
      canvas.height = 250
      canvasRefs[view] = { current: canvas }

      const mockContext: Partial<CanvasRenderingContext2D> = {
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
          data: new Uint8ClampedArray(250 * 250 * 4),
          width: 250,
          height: 250,
          colorSpace: 'srgb' as PredefinedColorSpace
        })),
        putImageData: vi.fn()
      }

      mockContexts[view] = mockContext
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as CanvasRenderingContext2D)
      canvas.toDataURL = vi.fn(() => `data:image/png;base64,${view}data`) as unknown as () => string
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with top view as active', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    expect(result.current.activeView).toBe('top')
  })

  it('changes active view when setActiveView is called', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    act(() => {
      result.current.setActiveView('side')
    })

    expect(result.current.activeView).toBe('side')
  })

  it('returns toolbar controls for the active view', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    expect(result.current.currentTool).toBe('pen')
    expect(result.current.canUndo).toBe(false)
  })

  it('routes tool changes to active canvas', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    act(() => {
      result.current.setTool('circle')
    })

    expect(result.current.currentTool).toBe('circle')
  })

  it('clears only the active canvas', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    act(() => {
      result.current.setActiveView('top')
      result.current.clear()
    })

    expect(mockContexts.top.clearRect).toHaveBeenCalledWith(0, 0, 250, 250)
    expect(mockContexts.side.clearRect).not.toHaveBeenCalled()
    expect(mockContexts.front.clearRect).not.toHaveBeenCalled()
  })

  it('provides separate controls for each view', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    // Get controls for top view
    const topControls = result.current.getViewControls('top')
    expect(topControls).toBeDefined()
    expect(topControls.handleMouseDown).toBeDefined()

    // Get controls for side view
    const sideControls = result.current.getViewControls('side')
    expect(sideControls).toBeDefined()
    expect(sideControls.handleMouseDown).toBeDefined()

    // Controls should be different objects
    expect(topControls).not.toBe(sideControls)
  })

  it('exports data URLs for all three views', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    const data = result.current.exportAllViews()

    expect(data.top.view).toBe('top')
    expect(data.top.dataUrl).toBe('data:image/png;base64,topdata')
    expect(data.side.view).toBe('side')
    expect(data.side.dataUrl).toBe('data:image/png;base64,sidedata')
    expect(data.front.view).toBe('front')
    expect(data.front.dataUrl).toBe('data:image/png;base64,frontdata')
  })

  it('detects empty canvases in export', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    const data = result.current.exportAllViews()

    // All canvases should be empty initially
    expect(data.top.isEmpty).toBe(true)
    expect(data.side.isEmpty).toBe(true)
    expect(data.front.isEmpty).toBe(true)
  })

  it('switches active view and routes drawing to new canvas', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    // Draw on top view
    act(() => {
      result.current.setActiveView('top')
      const controls = result.current.getViewControls('top')
      controls.handleMouseDown(createMouseEvent(10, 10))
      controls.handleMouseMove(createMouseEvent(20, 20))
      controls.handleMouseUp()
    })

    expect(mockContexts.top.lineTo).toHaveBeenCalled()

    // Switch to side view and draw
    act(() => {
      result.current.setActiveView('side')
      const controls = result.current.getViewControls('side')
      controls.handleMouseDown(createMouseEvent(30, 30))
      controls.handleMouseMove(createMouseEvent(40, 40))
      controls.handleMouseUp()
    })

    expect(mockContexts.side.lineTo).toHaveBeenCalled()
  })

  it('maintains separate tool state when switching views', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    // Set tool to circle
    act(() => {
      result.current.setTool('circle')
    })

    expect(result.current.currentTool).toBe('circle')

    // Switch view - tool should persist
    act(() => {
      result.current.setActiveView('side')
    })

    expect(result.current.currentTool).toBe('circle')
  })

  it('handles undo on active canvas only', () => {
    const { result } = renderHook(() => useMultiViewSketch(canvasRefs))

    // Draw on top view to create history
    act(() => {
      result.current.setActiveView('top')
      const controls = result.current.getViewControls('top')
      controls.handleMouseDown(createMouseEvent(10, 10))
      controls.handleMouseMove(createMouseEvent(20, 20))
      controls.handleMouseUp()
    })

    // Undo on top view
    act(() => {
      result.current.undo()
    })

    expect(mockContexts.top.putImageData).toHaveBeenCalled()
    expect(mockContexts.side.putImageData).not.toHaveBeenCalled()
  })

  it('returns empty string for missing canvas', () => {
    const partialCanvasRefs = {
      top: canvasRefs.top,
      side: { current: null },
      front: { current: null }
    } as Record<SketchView, React.RefObject<HTMLCanvasElement | null>>
    const { result } = renderHook(() => useMultiViewSketch(partialCanvasRefs))

    const data = result.current.exportAllViews()

    expect(data.top.dataUrl).toBeTruthy()
    expect(data.side.dataUrl).toBe('')
    expect(data.front.dataUrl).toBe('')
  })
})

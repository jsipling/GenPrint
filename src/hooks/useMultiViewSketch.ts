import React, { useState, useMemo, useCallback } from 'react'
import { useSketchCanvas } from './useSketchCanvas'
import type { SketchView, MultiViewSketchData, ViewData } from '../types/sketch'
import { isCanvasEmpty } from '../types/sketch'
import type { DrawingTool, UseSketchCanvasReturn } from './useSketchCanvas'

export interface UseMultiViewSketchReturn {
  activeView: SketchView
  setActiveView: (view: SketchView) => void
  currentTool: DrawingTool
  setTool: (tool: DrawingTool) => void
  clear: () => void
  undo: () => void
  canUndo: boolean
  getViewControls: (view: SketchView) => UseSketchCanvasReturn
  exportAllViews: () => MultiViewSketchData
}

/**
 * Hook for managing three separate sketch canvases (top, side, front views)
 * with a shared toolbar that applies to the active view.
 */
export function useMultiViewSketch(
  canvasRefs: Record<SketchView, React.RefObject<HTMLCanvasElement | null>>
): UseMultiViewSketchReturn {
  const [activeView, setActiveView] = useState<SketchView>('top')

  // Create three separate canvas hooks
  const topCanvas = useSketchCanvas(canvasRefs.top.current)
  const sideCanvas = useSketchCanvas(canvasRefs.side.current)
  const frontCanvas = useSketchCanvas(canvasRefs.front.current)

  // Map view to canvas hook
  const canvasHooks: Record<SketchView, UseSketchCanvasReturn> = useMemo(
    () => ({
      top: topCanvas,
      side: sideCanvas,
      front: frontCanvas
    }),
    [topCanvas, sideCanvas, frontCanvas]
  )

  // Get the active canvas hook
  const activeCanvasHook = canvasHooks[activeView]

  // Shared toolbar controls that route to active canvas
  const currentTool = activeCanvasHook.currentTool
  const canUndo = activeCanvasHook.canUndo

  const setTool = (tool: DrawingTool) => {
    // Set tool on all canvases to maintain consistency
    topCanvas.setTool(tool)
    sideCanvas.setTool(tool)
    frontCanvas.setTool(tool)
  }

  const clear = () => {
    activeCanvasHook.clear()
  }

  const undo = () => {
    activeCanvasHook.undo()
  }

  const getViewControls = (view: SketchView): UseSketchCanvasReturn => {
    return canvasHooks[view]
  }

  const exportAllViews = useCallback((): MultiViewSketchData => {
    const views: SketchView[] = ['top', 'side', 'front']
    const data: Partial<MultiViewSketchData> = {}

    views.forEach(view => {
      const canvas = canvasRefs[view].current
      const hook = canvasHooks[view]

      const viewData: ViewData = {
        view,
        dataUrl: canvas ? hook.exportAsDataUrl() : '',
        isEmpty: canvas ? isCanvasEmpty(canvas) : true
      }

      data[view] = viewData
    })

    return data as MultiViewSketchData
  }, [canvasRefs, canvasHooks])

  return {
    activeView,
    setActiveView,
    currentTool,
    setTool,
    clear,
    undo,
    canUndo,
    getViewControls,
    exportAllViews
  }
}

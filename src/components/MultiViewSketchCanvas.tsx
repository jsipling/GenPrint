import { useRef, useEffect, useCallback } from 'react'
import { useMultiViewSketch } from '../hooks/useMultiViewSketch'
import { SketchToolbar } from './SketchToolbar'
import type { SketchView, MultiViewSketchData } from '../types/sketch'
import { getViewLabel } from '../types/sketch'

interface MultiViewSketchCanvasProps {
  onExport?: (data: MultiViewSketchData) => void
}

export function MultiViewSketchCanvas({ onExport }: MultiViewSketchCanvasProps) {
  // Canvas refs for each view
  const topCanvasRef = useRef<HTMLCanvasElement>(null)
  const sideCanvasRef = useRef<HTMLCanvasElement>(null)
  const frontCanvasRef = useRef<HTMLCanvasElement>(null)

  const canvasRefs = {
    top: topCanvasRef,
    side: sideCanvasRef,
    front: frontCanvasRef
  }

  const {
    activeView,
    setActiveView,
    currentTool,
    setTool,
    clear,
    undo,
    canUndo,
    getViewControls,
    exportAllViews
  } = useMultiViewSketch(canvasRefs)

  // Export callback that parent can trigger
  const handleExportData = useCallback(() => {
    if (onExport) {
      const data = exportAllViews()
      onExport(data)
    }
  }, [onExport, exportAllViews])

  // Export once on mount to initialize parent state
  useEffect(() => {
    handleExportData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Wrap mouse/touch handlers to trigger export after drawing
  const handleMouseUp = useCallback((view: SketchView) => {
    const controls = getViewControls(view)
    return () => {
      controls.handleMouseUp()
      handleExportData()
    }
  }, [getViewControls, handleExportData])

  const handleTouchEnd = useCallback((view: SketchView) => {
    const controls = getViewControls(view)
    return () => {
      controls.handleTouchEnd()
      handleExportData()
    }
  }, [getViewControls, handleExportData])

  // Render a single canvas view
  const renderCanvas = (view: SketchView, ref: React.RefObject<HTMLCanvasElement | null>) => {
    const controls = getViewControls(view)
    const isActive = activeView === view

    return (
      <div key={view} className="mb-4">
        <label className="block text-sm font-medium mb-2 text-gray-300">
          {getViewLabel(view)}
        </label>
        <canvas
          ref={ref}
          data-testid={`canvas-${view}`}
          role="img"
          aria-label={`${getViewLabel(view)} sketch canvas`}
          width={250}
          height={250}
          className={`w-full border-2 rounded bg-white cursor-crosshair touch-none ${
            isActive ? 'border-blue-500' : 'border-gray-300'
          }`}
          onClick={() => setActiveView(view)}
          onMouseDown={controls.handleMouseDown}
          onMouseMove={controls.handleMouseMove}
          onMouseUp={handleMouseUp(view)}
          onMouseLeave={handleMouseUp(view)}
          onTouchStart={controls.handleTouchStart}
          onTouchMove={controls.handleTouchMove}
          onTouchEnd={handleTouchEnd(view)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Single shared toolbar */}
      <SketchToolbar
        currentTool={currentTool}
        onToolChange={setTool}
        onClear={clear}
        onUndo={undo}
        canUndo={canUndo}
      />

      {/* Three canvases stacked vertically */}
      <div className="flex flex-col mt-3" data-testid="multi-view-canvases">
        {renderCanvas('top', topCanvasRef)}
        {renderCanvas('side', sideCanvasRef)}
        {renderCanvas('front', frontCanvasRef)}
      </div>
    </div>
  )
}

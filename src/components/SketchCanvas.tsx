import { useRef, useEffect } from 'react'
import { useSketchCanvas } from '../hooks/useSketchCanvas'
import { SketchToolbar } from './SketchToolbar'

interface SketchCanvasProps {
  onExport?: (dataUrl: string) => void
}

export function SketchCanvas({ onExport }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const {
    currentTool,
    setTool,
    clear,
    undo,
    canUndo,
    exportAsDataUrl,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useSketchCanvas(canvasRef.current)

  // Export canvas data URL whenever it changes (optional feature)
  useEffect(() => {
    if (onExport && canvasRef.current) {
      const dataUrl = exportAsDataUrl()
      if (dataUrl) {
        onExport(dataUrl)
      }
    }
  }, [currentTool, onExport, exportAsDataUrl])

  return (
    <div className="flex flex-col">
      <SketchToolbar
        currentTool={currentTool}
        onToolChange={setTool}
        onClear={clear}
        onUndo={undo}
        canUndo={canUndo}
      />

      <canvas
        ref={canvasRef}
        data-testid="sketch-canvas"
        width={400}
        height={400}
        className="border-2 border-gray-600 rounded bg-white cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  )
}

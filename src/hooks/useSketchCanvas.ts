import { useState, useRef, useCallback, useEffect } from 'react'

export type DrawingTool = 'pen' | 'circle' | 'rectangle' | 'line' | 'eraser'

export interface UseSketchCanvasReturn {
  currentTool: DrawingTool
  setTool: (tool: DrawingTool) => void
  clear: () => void
  undo: () => void
  canUndo: boolean
  exportAsDataUrl: () => string
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseUp: () => void
  handleTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void
  handleTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void
  handleTouchEnd: () => void
}

export function useSketchCanvas(canvas: HTMLCanvasElement | null): UseSketchCanvasReturn {
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen')
  const [canUndo, setCanUndo] = useState(false)

  const isDrawingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const historyRef = useRef<ImageData[]>([])
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  // Initialize context
  useEffect(() => {
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        contextRef.current = ctx
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2
        ctx.strokeStyle = '#000000'

        // Save initial blank state
        saveToHistory(ctx, canvas)
      }
    }
  }, [canvas])

  const saveToHistory = useCallback((ctx: CanvasRenderingContext2D, cvs: HTMLCanvasElement) => {
    const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height)
    historyRef.current.push(imageData)
    setCanUndo(historyRef.current.length > 1)
  }, [])

  const setTool = useCallback((tool: DrawingTool) => {
    setCurrentTool(tool)
  }, [])

  const clear = useCallback(() => {
    if (!canvas || !contextRef.current) return

    const ctx = contextRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save cleared state to history
    saveToHistory(ctx, canvas)
  }, [canvas, saveToHistory])

  const undo = useCallback(() => {
    if (!canvas || !contextRef.current || historyRef.current.length <= 1) return

    // Remove current state
    historyRef.current.pop()

    // Get previous state
    const prevState = historyRef.current[historyRef.current.length - 1]
    if (prevState) {
      contextRef.current.putImageData(prevState, 0, 0)
      setCanUndo(historyRef.current.length > 1)
    }
  }, [canvas])

  const exportAsDataUrl = useCallback((): string => {
    if (!canvas) return ''
    return canvas.toDataURL('image/png')
  }, [canvas])

  const startDrawing = useCallback((x: number, y: number) => {
    if (!contextRef.current) return

    isDrawingRef.current = true
    startPosRef.current = { x, y }

    const ctx = contextRef.current

    if (currentTool === 'pen' || currentTool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }, [currentTool])

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current || !contextRef.current || !canvas) return

    const ctx = contextRef.current

    if (currentTool === 'pen') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = 20
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }, [currentTool, canvas])

  const finishDrawing = useCallback(() => {
    if (!isDrawingRef.current || !contextRef.current || !canvas) return

    const ctx = contextRef.current

    // Finalize the drawing operation
    isDrawingRef.current = false

    // Save to history
    if (currentTool !== 'eraser') {
      ctx.globalCompositeOperation = 'source-over'
    }

    saveToHistory(ctx, canvas)
  }, [currentTool, canvas, saveToHistory])

  const getCanvasCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    return { x, y }
  }, [canvas])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e)
    startDrawing(x, y)
  }, [startDrawing, getCanvasCoordinates])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e)

    if (!isDrawingRef.current || !contextRef.current || !canvas) return

    const ctx = contextRef.current
    const start = startPosRef.current

    if (currentTool === 'pen' || currentTool === 'eraser') {
      draw(x, y)
    } else {
      // For shapes, draw preview
      const prevState = historyRef.current[historyRef.current.length - 1]
      if (prevState) {
        ctx.putImageData(prevState, 0, 0)
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2

      if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2))
        ctx.beginPath()
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (currentTool === 'rectangle') {
        ctx.beginPath()
        ctx.rect(start.x, start.y, x - start.x, y - start.y)
        ctx.stroke()
      } else if (currentTool === 'line') {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    }
  }, [currentTool, draw, canvas])

  const handleMouseUp = useCallback(() => {
    finishDrawing()
  }, [finishDrawing])

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvas) return

    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    startDrawing(x, y)
  }, [canvas, startDrawing])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvas) return

    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    if (!isDrawingRef.current || !contextRef.current) return

    const ctx = contextRef.current
    const start = startPosRef.current

    if (currentTool === 'pen' || currentTool === 'eraser') {
      draw(x, y)
    } else {
      // For shapes, draw preview (same as mouse move)
      const prevState = historyRef.current[historyRef.current.length - 1]
      if (prevState) {
        ctx.putImageData(prevState, 0, 0)
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2

      if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2))
        ctx.beginPath()
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (currentTool === 'rectangle') {
        ctx.beginPath()
        ctx.rect(start.x, start.y, x - start.x, y - start.y)
        ctx.stroke()
      } else if (currentTool === 'line') {
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    }
  }, [canvas, currentTool, draw])

  const handleTouchEnd = useCallback(() => {
    finishDrawing()
  }, [finishDrawing])

  return {
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
  }
}

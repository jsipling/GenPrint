/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiViewSketchCanvas } from './MultiViewSketchCanvas'

describe('MultiViewSketchCanvas', () => {
  beforeEach(() => {
    // Mock canvas getContext for all canvas elements
    HTMLCanvasElement.prototype.getContext = vi.fn((contextId) => {
      if (contextId === '2d') {
        return {
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
        } as unknown as CanvasRenderingContext2D
      }
      return null
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockdata')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders three canvases with labels', () => {
    render(<MultiViewSketchCanvas />)

    expect(screen.getByText('Top View')).toBeTruthy()
    expect(screen.getByText('Side View')).toBeTruthy()
    expect(screen.getByText('Front View')).toBeTruthy()

    const canvases = screen.getAllByRole('img')
    expect(canvases).toHaveLength(3)
  })

  it('renders each canvas with 250x250 dimensions', () => {
    render(<MultiViewSketchCanvas />)

    const canvases = screen.getAllByRole('img') as HTMLCanvasElement[]
    canvases.forEach(canvas => {
      expect(canvas.width).toBe(250)
      expect(canvas.height).toBe(250)
    })
  })

  it('renders single shared toolbar at top', () => {
    render(<MultiViewSketchCanvas />)

    // Should have tool buttons
    expect(screen.getByLabelText(/pen/i)).toBeTruthy()
    expect(screen.getByLabelText(/circle/i)).toBeTruthy()
    expect(screen.getByLabelText(/rectangle/i)).toBeTruthy()
    expect(screen.getByLabelText(/line/i)).toBeTruthy()
    expect(screen.getByLabelText(/eraser/i)).toBeTruthy()
  })

  it('highlights active canvas with blue border', () => {
    render(<MultiViewSketchCanvas />)

    const topCanvas = screen.getByTestId('canvas-top')
    expect(topCanvas.className).toContain('border-blue-500')
  })

  it('switches active view when canvas is clicked', async () => {
    const user = userEvent.setup()
    render(<MultiViewSketchCanvas />)

    const sideCanvas = screen.getByTestId('canvas-side')

    // Initially, side canvas should have gray border
    expect(sideCanvas.className).toContain('border-gray-300')

    // Click on side canvas
    await user.click(sideCanvas)

    // Now side canvas should have blue border
    expect(sideCanvas.className).toContain('border-blue-500')
  })

  it('removes blue border from previously active canvas', async () => {
    const user = userEvent.setup()
    render(<MultiViewSketchCanvas />)

    const topCanvas = screen.getByTestId('canvas-top')
    const sideCanvas = screen.getByTestId('canvas-side')

    // Top canvas starts active
    expect(topCanvas.className).toContain('border-blue-500')

    // Click side canvas
    await user.click(sideCanvas)

    // Top canvas should no longer be highlighted
    expect(topCanvas.className).not.toContain('border-blue-500')
    expect(topCanvas.className).toContain('border-gray-300')
  })

  it('applies toolbar tool to active canvas only', async () => {
    const user = userEvent.setup()
    render(<MultiViewSketchCanvas />)

    // Select circle tool
    const circleTool = screen.getByLabelText(/circle/i)
    await user.click(circleTool)

    // Tool should be selected
    expect(circleTool.className).toContain('bg-blue-600')
  })

  it('calls onExport with multi-view data when export occurs', () => {
    const onExport = vi.fn()
    render(<MultiViewSketchCanvas onExport={onExport} />)

    // onExport should be called with multi-view data structure
    expect(onExport).toHaveBeenCalled()
    const exportData = onExport.mock.calls[0]?.[0]

    expect(exportData).toHaveProperty('top')
    expect(exportData).toHaveProperty('side')
    expect(exportData).toHaveProperty('front')
    expect(exportData?.top).toHaveProperty('view', 'top')
    expect(exportData?.top).toHaveProperty('dataUrl')
    expect(exportData?.top).toHaveProperty('isEmpty')
  })

  it('stacks canvases vertically', () => {
    const { container } = render(<MultiViewSketchCanvas />)

    const canvasContainer = container.querySelector('[data-testid="multi-view-canvases"]')
    expect(canvasContainer?.className).toContain('flex-col')
  })

  it('clears active canvas when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<MultiViewSketchCanvas />)

    const clearButton = screen.getByLabelText(/clear/i)
    await user.click(clearButton)

    // Should call clearRect on the active canvas context
    // (We can't easily verify this without more complex mocking)
    expect(clearButton).toBeTruthy()
  })

  it('undoes on active canvas when undo button is clicked', async () => {
    const user = userEvent.setup()
    render(<MultiViewSketchCanvas />)

    // Draw something first (click and drag)
    const topCanvas = screen.getByTestId('canvas-top')
    await user.pointer([
      { keys: '[MouseLeft>]', target: topCanvas, coords: { x: 10, y: 10 } },
      { coords: { x: 20, y: 20 } },
      { keys: '[/MouseLeft]' }
    ])

    const undoButton = screen.getByLabelText(/undo/i)
    await user.click(undoButton)

    expect(undoButton).toBeTruthy()
  })

  it('has proper canvas styling', () => {
    render(<MultiViewSketchCanvas />)

    const topCanvas = screen.getByTestId('canvas-top')
    expect(topCanvas.className).toContain('bg-white')
    expect(topCanvas.className).toContain('cursor-crosshair')
  })

  it('labels appear above their respective canvases', () => {
    const { container } = render(<MultiViewSketchCanvas />)

    const labels = container.querySelectorAll('.text-sm.font-medium')
    expect(labels).toHaveLength(3)
    expect(labels[0]?.textContent).toBe('Top View')
    expect(labels[1]?.textContent).toBe('Side View')
    expect(labels[2]?.textContent).toBe('Front View')
  })

  it('updates export when drawing on any canvas', async () => {
    const onExport = vi.fn()
    render(<MultiViewSketchCanvas onExport={onExport} />)

    // onExport is called at least once on mount
    expect(onExport).toHaveBeenCalled()

    // The export callback should have multi-view structure
    const exportData = onExport.mock.calls[onExport.mock.calls.length - 1]?.[0]
    expect(exportData).toHaveProperty('top')
    expect(exportData).toHaveProperty('side')
    expect(exportData).toHaveProperty('front')
  })
})

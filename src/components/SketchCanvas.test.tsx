/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SketchCanvas } from './SketchCanvas'

describe('SketchCanvas', () => {
  const mockOnExport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders canvas element', () => {
    render(<SketchCanvas onExport={mockOnExport} />)

    const canvas = screen.getByTestId('sketch-canvas')
    expect(canvas).toBeTruthy()
    expect(canvas.tagName).toBe('CANVAS')
  })

  it('renders toolbar with drawing tools', () => {
    render(<SketchCanvas onExport={mockOnExport} />)

    expect(screen.getAllByLabelText('Pen').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Circle').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Rectangle').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Line').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Eraser').length).toBeGreaterThan(0)
  })

  it('sets canvas dimensions correctly', () => {
    render(<SketchCanvas onExport={mockOnExport} />)

    const canvases = screen.getAllByTestId('sketch-canvas') as HTMLCanvasElement[]
    expect(canvases[0]?.width).toBe(400)
    expect(canvases[0]?.height).toBe(400)
  })

  it('has correct styling classes', () => {
    render(<SketchCanvas onExport={mockOnExport} />)

    const canvases = screen.getAllByTestId('sketch-canvas')
    expect(canvases[0]?.className).toContain('border')
    expect(canvases[0]?.className).toContain('bg-white')
  })

  it('renders clear and undo buttons', () => {
    render(<SketchCanvas onExport={mockOnExport} />)

    expect(screen.getAllByLabelText('Clear canvas').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Undo').length).toBeGreaterThan(0)
  })
})

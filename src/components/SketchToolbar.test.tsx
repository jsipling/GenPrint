/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SketchToolbar } from './SketchToolbar'

describe('SketchToolbar', () => {
  const mockSetTool = vi.fn()
  const mockClear = vi.fn()
  const mockUndo = vi.fn()

  const defaultProps = {
    currentTool: 'pen' as const,
    onToolChange: mockSetTool,
    onClear: mockClear,
    onUndo: mockUndo,
    canUndo: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all tool buttons', () => {
    render(<SketchToolbar {...defaultProps} />)

    expect(screen.getByLabelText('Pen')).toBeTruthy()
    expect(screen.getByLabelText('Circle')).toBeTruthy()
    expect(screen.getByLabelText('Rectangle')).toBeTruthy()
    expect(screen.getByLabelText('Line')).toBeTruthy()
    expect(screen.getByLabelText('Eraser')).toBeTruthy()
  })

  it('highlights the currently selected tool', () => {
    render(<SketchToolbar {...defaultProps} currentTool="circle" />)

    const circleButtons = screen.getAllByLabelText('Circle')
    // Find the highlighted button (may be first or second due to StrictMode)
    const highlightedButton = circleButtons.find(btn => btn.className.includes('bg-blue-600'))
    expect(highlightedButton).toBeTruthy()
  })

  it('calls onToolChange when a tool button is clicked', () => {
    render(<SketchToolbar {...defaultProps} />)

    const circleButtons = screen.getAllByLabelText('Circle')
    fireEvent.click(circleButtons[0]!)

    expect(mockSetTool).toHaveBeenCalledWith('circle')
  })

  it('renders clear button', () => {
    render(<SketchToolbar {...defaultProps} />)

    expect(screen.getAllByLabelText('Clear canvas').length).toBeGreaterThan(0)
  })

  it('calls onClear when clear button is clicked', () => {
    render(<SketchToolbar {...defaultProps} />)

    const clearButtons = screen.getAllByLabelText('Clear canvas')
    fireEvent.click(clearButtons[0]!)

    expect(mockClear).toHaveBeenCalled()
  })

  it('renders undo button', () => {
    render(<SketchToolbar {...defaultProps} />)

    expect(screen.getAllByLabelText('Undo').length).toBeGreaterThan(0)
  })

  it('calls onUndo when undo button is clicked', () => {
    render(<SketchToolbar {...defaultProps} canUndo={true} />)

    const undoButtons = screen.getAllByLabelText('Undo')
    fireEvent.click(undoButtons[0]!)

    expect(mockUndo).toHaveBeenCalled()
  })

  it('disables undo button when canUndo is false', () => {
    render(<SketchToolbar {...defaultProps} canUndo={false} />)

    const undoButtons = screen.getAllByLabelText('Undo')
    const disabledButton = undoButtons.find(btn => btn.hasAttribute('disabled'))
    expect(disabledButton).toBeTruthy()
  })

  it('does not highlight non-selected tools', () => {
    render(<SketchToolbar {...defaultProps} currentTool="pen" />)

    const circleButtons = screen.getAllByLabelText('Circle')
    expect(circleButtons[0]?.className).not.toContain('bg-blue-600')
    expect(circleButtons[0]?.className).toContain('bg-gray-700')
  })
})

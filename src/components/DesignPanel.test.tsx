/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DesignPanel } from './DesignPanel'
import type { ImageGenerationService } from '../services/types'

describe('DesignPanel', () => {
  let mockService: ImageGenerationService

  beforeEach(() => {
    mockService = {
      generateImage: vi.fn().mockResolvedValue({
        imageUrl: 'test.png',
        timestamp: Date.now()
      }),
      cancelGeneration: vi.fn(),
      isGenerating: vi.fn(() => false)
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all child components', () => {
    render(<DesignPanel aiService={mockService} />)

    // Should render SketchCanvas
    expect(screen.getByTestId('sketch-canvas')).toBeTruthy()

    // Should render GeneratedImageDisplay (empty state)
    expect(screen.getByTestId('empty-state')).toBeTruthy()

    // Should render PromptInput
    expect(screen.getByTestId('prompt-textarea')).toBeTruthy()
    expect(screen.getByTestId('generate-button')).toBeTruthy()
  })

  it('is collapsible with toggle button', async () => {
    const user = userEvent.setup()
    const { container } = render(<DesignPanel aiService={mockService} />)

    // Find collapse button
    const collapseButton = screen.getByLabelText(/collapse design panel/i)
    expect(collapseButton).toBeTruthy()

    // Click to collapse
    await user.click(collapseButton)

    // Check that content is hidden
    const panel = container.querySelector('[data-testid="design-panel-content"]')
    expect(panel?.className).toContain('hidden')
  })

  it('expands when clicking expand button', async () => {
    const user = userEvent.setup()
    const { container } = render(<DesignPanel aiService={mockService} />)

    // Collapse first
    await user.click(screen.getByLabelText(/collapse design panel/i))

    // Then expand
    await user.click(screen.getByLabelText(/expand design panel/i))

    // Check that content is visible
    const panel = container.querySelector('[data-testid="design-panel-content"]')
    expect(panel?.className).not.toContain('hidden')
  })

  it('passes prompt to generateImage', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn().mockResolvedValue({
      imageUrl: 'test.png',
      timestamp: Date.now()
    })
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    // Type prompt
    const textarea = screen.getByTestId('prompt-textarea')
    await user.type(textarea, 'A mechanical gear')

    // Click generate
    await user.click(screen.getByTestId('generate-button'))

    // Should call generateImage with prompt
    expect(mockGenerate).toHaveBeenCalled()
    const callArgs = mockGenerate.mock.calls[0]?.[0]
    expect(callArgs?.prompt).toBe('A mechanical gear')
  })

  it('displays generated images', async () => {
    const user = userEvent.setup()

    render(<DesignPanel aiService={mockService} />)

    // Generate an image
    await user.type(screen.getByTestId('prompt-textarea'), 'Test')
    await user.click(screen.getByTestId('generate-button'))

    // Wait for image to appear
    const img = await screen.findByTestId('generated-image')
    expect(img).toBeTruthy()
  })

  it('shows loading state during generation', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ imageUrl: 'test.png', timestamp: Date.now() }), 100))
    )
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    await user.type(screen.getByTestId('prompt-textarea'), 'Test')
    await user.click(screen.getByTestId('generate-button'))

    // Should show generating state
    expect(screen.getByTestId('loading-state')).toBeTruthy()
  })

  it('navigates between images using history controls', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn()
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    // Generate two images
    mockGenerate.mockResolvedValueOnce({ imageUrl: 'img1.png', timestamp: 1 })
    await user.type(screen.getByTestId('prompt-textarea'), 'First')
    await user.click(screen.getByTestId('generate-button'))

    await screen.findByTestId('image-counter')
    expect(screen.getByTestId('image-counter').textContent).toBe('1 of 1')

    mockGenerate.mockResolvedValueOnce({ imageUrl: 'img2.png', timestamp: 2 })
    await user.type(screen.getByTestId('prompt-textarea'), 'Second')
    await user.click(screen.getByTestId('generate-button'))

    await screen.findByTestId('image-counter')
    expect(screen.getByTestId('image-counter').textContent).toBe('1 of 2')

    // Navigate to previous image
    await user.click(screen.getByTestId('next-button'))
    expect(screen.getByTestId('image-counter').textContent).toBe('2 of 2')
  })

  it('shows error message on generation failure', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn().mockRejectedValue(new Error('API Error'))
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    await user.type(screen.getByTestId('prompt-textarea'), 'Test')
    await user.click(screen.getByTestId('generate-button'))

    // Should show error
    const errorMessage = await screen.findByTestId('error-message')
    expect(errorMessage.textContent).toContain('API Error')
  })

  it('toggles conversation mode via checkbox', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn().mockResolvedValue({
      imageUrl: 'test.png',
      timestamp: Date.now()
    })
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    const checkbox = screen.getByTestId('conversation-checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(false)

    await user.click(checkbox)
    expect((checkbox as HTMLInputElement).checked).toBe(true)

    // Generate with conversation mode on
    await user.type(screen.getByTestId('prompt-textarea'), 'Test')
    await user.click(screen.getByTestId('generate-button'))

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        continueConversation: true
      })
    )
  })

  it('has proper styling classes', () => {
    const { container } = render(<DesignPanel aiService={mockService} />)

    const panel = container.firstChild as HTMLElement
    expect(panel.className).toContain('bg-gray-800')
    expect(panel.className).toContain('text-white')
  })

  it('renders title header', () => {
    render(<DesignPanel aiService={mockService} />)

    expect(screen.getByText('AI Design Assistant')).toBeTruthy()
  })

  it('clears prompt after successful generation', async () => {
    const user = userEvent.setup()

    render(<DesignPanel aiService={mockService} />)

    const textarea = screen.getByTestId('prompt-textarea') as HTMLTextAreaElement
    await user.type(textarea, 'Test prompt')

    expect(textarea.value).toBe('Test prompt')

    await user.click(screen.getByTestId('generate-button'))

    // Wait for generation to complete and prompt to clear
    await screen.findByTestId('generated-image')
    expect(textarea.value).toBe('')
  })

  it('calls generateImage when generate button clicked', async () => {
    const user = userEvent.setup()
    const mockGenerate = vi.fn().mockResolvedValue({
      imageUrl: 'test.png',
      timestamp: Date.now()
    })
    mockService.generateImage = mockGenerate

    render(<DesignPanel aiService={mockService} />)

    await user.type(screen.getByTestId('prompt-textarea'), 'Test')
    await user.click(screen.getByTestId('generate-button'))

    expect(mockGenerate).toHaveBeenCalled()
    const callArgs = mockGenerate.mock.calls[0]?.[0]
    expect(callArgs?.prompt).toBe('Test')
  })
})

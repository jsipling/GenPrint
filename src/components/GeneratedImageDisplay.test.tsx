/** @vitest-environment jsdom */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeneratedImageDisplay } from './GeneratedImageDisplay'

describe('GeneratedImageDisplay', () => {
  afterEach(() => {
    cleanup()
  })
  it('shows empty state when no images', () => {
    render(
      <GeneratedImageDisplay
        images={[]}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('displays current image when images exist', () => {
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() },
      { url: 'https://example.com/image2.png', timestamp: Date.now() }
    ]

    render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const img = screen.getByTestId('generated-image') as HTMLImageElement
    expect(img.src).toBe('https://example.com/image1.png')
  })

  it('displays second image when currentIndex is 1', () => {
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() },
      { url: 'https://example.com/image2.png', timestamp: Date.now() }
    ]

    render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={1}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const img = screen.getByTestId('generated-image') as HTMLImageElement
    expect(img.src).toBe('https://example.com/image2.png')
  })

  it('shows loading state when isLoading is true', () => {
    render(
      <GeneratedImageDisplay
        images={[]}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByTestId('loading-state')).toBeTruthy()
  })

  it('shows error state when error is provided', () => {
    render(
      <GeneratedImageDisplay
        images={[]}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        error="Failed to generate image"
      />
    )

    expect(screen.getByTestId('error-state')).toBeTruthy()
    expect(screen.getByTestId('error-message').textContent).toBe('Failed to generate image')
  })

  it('renders navigation controls when images exist', () => {
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() },
      { url: 'https://example.com/image2.png', timestamp: Date.now() }
    ]

    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={0}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    expect(screen.getByTestId('previous-button')).toBeTruthy()
    expect(screen.getByTestId('next-button')).toBeTruthy()
    expect(screen.getByTestId('image-counter').textContent).toBe('1 of 2')
  })

  it('does not render navigation when no images', () => {
    render(
      <GeneratedImageDisplay
        images={[]}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.queryByTestId('previous-button')).toBeFalsy()
    expect(screen.queryByTestId('next-button')).toBeFalsy()
  })

  it('calls navigation callbacks from ImageHistoryNav', async () => {
    const user = userEvent.setup()
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() },
      { url: 'https://example.com/image2.png', timestamp: Date.now() }
    ]

    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={0}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    await user.click(screen.getByTestId('next-button'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('has proper alt text for generated image', () => {
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() }
    ]

    render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const img = screen.getByTestId('generated-image')
    expect(img.getAttribute('alt')).toBe('Generated design image')
  })

  it('applies correct styling to image container', () => {
    const images = [
      { url: 'https://example.com/image1.png', timestamp: Date.now() }
    ]

    const { container } = render(
      <GeneratedImageDisplay
        images={images}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    const imageContainer = container.querySelector('img')?.parentElement
    expect(imageContainer?.className).toContain('rounded')
  })

  it('shows loading spinner icon', () => {
    const { container } = render(
      <GeneratedImageDisplay
        images={[]}
        currentIndex={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        isLoading={true}
      />
    )

    // Check for SVG spinner
    const spinner = container.querySelector('svg')
    expect(spinner).toBeTruthy()
  })
})

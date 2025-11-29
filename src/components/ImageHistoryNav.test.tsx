/** @vitest-environment jsdom */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageHistoryNav } from './ImageHistoryNav'

describe('ImageHistoryNav', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders navigation with history indicator', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={2}
        totalImages={7}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    expect(screen.getByTestId('image-counter')).toBeTruthy()
    expect(screen.getByTestId('image-counter').textContent).toBe('3 of 7')
  })

  it('disables previous button when at first image', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={0}
        totalImages={5}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    const prevButton = screen.getByTestId('previous-button')
    expect(prevButton.hasAttribute('disabled')).toBe(true)
  })

  it('disables next button when at last image', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={4}
        totalImages={5}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    const nextButton = screen.getByTestId('next-button')
    expect(nextButton.hasAttribute('disabled')).toBe(true)
  })

  it('enables both buttons when in middle of history', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={2}
        totalImages={5}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    const prevButton = screen.getByTestId('previous-button')
    const nextButton = screen.getByTestId('next-button')

    expect(prevButton.hasAttribute('disabled')).toBe(false)
    expect(nextButton.hasAttribute('disabled')).toBe(false)
  })

  it('calls onPrevious when previous button clicked', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={2}
        totalImages={5}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    await user.click(screen.getByTestId('previous-button'))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when next button clicked', async () => {
    const user = userEvent.setup()
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={2}
        totalImages={5}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    await user.click(screen.getByTestId('next-button'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('hides navigation when there are no images', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    const { container } = render(
      <ImageHistoryNav
        currentIndex={0}
        totalImages={0}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    expect(container.textContent).toBe('')
  })

  it('shows navigation for single image', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={0}
        totalImages={1}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    expect(screen.getByTestId('image-counter').textContent).toBe('1 of 1')
    expect(screen.getByTestId('previous-button').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('next-button').hasAttribute('disabled')).toBe(true)
  })

  it('applies correct styling classes', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(
      <ImageHistoryNav
        currentIndex={0}
        totalImages={3}
        onPrevious={onPrev}
        onNext={onNext}
      />
    )

    const prevButton = screen.getByTestId('previous-button')
    expect(prevButton.className).toContain('bg-gray-700')
  })
})

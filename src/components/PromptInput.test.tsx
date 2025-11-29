/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptInput } from './PromptInput'

describe('PromptInput', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea and submit button', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    expect(screen.getByPlaceholderText(/describe your design/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /generate/i })).toBeTruthy()
  })

  it('displays current value in textarea', () => {
    render(
      <PromptInput
        value="A gear with 20 teeth"
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('A gear with 20 teeth')
  })

  it('calls onChange when text is typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <PromptInput
        value=""
        onChange={onChange}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i)
    await user.type(textarea, 'Test')

    expect(onChange).toHaveBeenCalled()
  })

  it('calls onSubmit when submit button clicked', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput
        value="Test prompt"
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(mockOnSubmit).toHaveBeenCalledOnce()
  })

  it('calls onSubmit when Ctrl+Enter is pressed', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput
        value="Test prompt"
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i)
    await user.click(textarea)
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(mockOnSubmit).toHaveBeenCalledOnce()
  })

  it('calls onSubmit when Meta+Enter is pressed (Mac)', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput
        value="Test prompt"
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i)
    await user.click(textarea)
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(mockOnSubmit).toHaveBeenCalledOnce()
  })

  it('disables textarea and button when disabled prop is true', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={true}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i)
    const button = screen.getByRole('button', { name: /generating/i })

    expect(textarea.hasAttribute('disabled')).toBe(true)
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('shows "Generating..." text when disabled', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={true}
      />
    )

    expect(screen.getByText(/generating/i)).toBeTruthy()
  })

  it('shows conversation toggle checkbox', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
        continueConversation={false}
        onConversationToggle={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/continue conversation/i)).toBeTruthy()
  })

  it('calls onConversationToggle when checkbox is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
        continueConversation={false}
        onConversationToggle={onToggle}
      />
    )

    await user.click(screen.getByLabelText(/continue conversation/i))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('checkbox reflects continueConversation state', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
        continueConversation={true}
        onConversationToggle={vi.fn()}
      />
    )

    const checkbox = screen.getByLabelText(/continue conversation/i) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('does not submit when value is empty', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('does not submit when value is only whitespace', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput
        value="   "
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('applies correct styling classes', () => {
    render(
      <PromptInput
        value=""
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i)
    expect(textarea.className).toContain('bg-gray-700')
    expect(textarea.className).toContain('rounded')
  })

  it('supports multiline input', () => {
    render(
      <PromptInput
        value="Line 1\nLine 2"
        onChange={vi.fn()}
        onSubmit={mockOnSubmit}
        disabled={false}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your design/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('Line 1\nLine 2')
  })
})

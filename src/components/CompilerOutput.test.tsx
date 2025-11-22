/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CompilerOutput } from './CompilerOutput'

describe('CompilerOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when output is null', () => {
    const { container } = render(<CompilerOutput output={null} />)
    expect(container.firstChild).toBe(null)
  })

  it('renders when output is provided', () => {
    render(<CompilerOutput output="Test output message" />)
    expect(screen.getByText('Compiler Output')).toBeTruthy()
  })

  it('is expanded by default in development mode', () => {
    render(<CompilerOutput output="Test output message" />)

    // In dev mode, output should be visible immediately
    const outputContainer = screen.getByTestId('compiler-output')
    expect(outputContainer).toBeTruthy()
    expect(outputContainer.textContent).toContain('Test output message')
  })

  it('toggles visibility when clicked', () => {
    render(<CompilerOutput output="Test output message" />)

    const toggleButton = screen.getByRole('button', { name: /compiler output/i })
    const initialExpanded = toggleButton.getAttribute('aria-expanded')

    fireEvent.click(toggleButton)

    const newExpanded = toggleButton.getAttribute('aria-expanded')
    expect(newExpanded).not.toBe(initialExpanded)
  })

  it('highlights ECHO lines with distinct styling', () => {
    const output = 'ECHO: "some value"'
    render(<CompilerOutput output={output} />)

    const outputContainer = screen.getByTestId('compiler-output')
    const echoLine = outputContainer.querySelector('.text-cyan-400')
    expect(echoLine).toBeTruthy()
    expect(echoLine?.textContent).toContain('ECHO:')
  })

  it('highlights WARNING lines with warning styling', () => {
    const output = 'WARNING: something might be wrong'
    render(<CompilerOutput output={output} />)

    const outputContainer = screen.getByTestId('compiler-output')
    const warningLine = outputContainer.querySelector('.text-yellow-400')
    expect(warningLine).toBeTruthy()
    expect(warningLine?.textContent).toContain('WARNING:')
  })

  it('highlights ERROR lines with error styling', () => {
    const output = 'ERROR: compilation failed'
    render(<CompilerOutput output={output} />)

    const outputContainer = screen.getByTestId('compiler-output')
    const errorLine = outputContainer.querySelector('.text-red-400')
    expect(errorLine).toBeTruthy()
    expect(errorLine?.textContent).toContain('ERROR:')
  })

})

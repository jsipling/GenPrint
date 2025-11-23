/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// Mock the components and hooks to isolate App logic
vi.mock('./components/Viewer', () => ({
  Viewer: ({ stlBlob, isCompiling }: { stlBlob: Blob | null; isCompiling: boolean }) => (
    <div data-testid="viewer" data-compiling={isCompiling} data-has-blob={!!stlBlob}>
      Viewer Mock
    </div>
  )
}))

vi.mock('./components/Sidebar', () => ({
  Sidebar: ({
    generators,
    selectedGenerator,
    onGeneratorChange,
    params,
    onParamChange,
    onDownload,
    canDownload
  }: {
    generators: unknown[]
    selectedGenerator: { id: string; name: string }
    onGeneratorChange: (id: string) => void
    params: Record<string, unknown>
    onParamChange: (name: string, value: unknown) => void
    onDownload: () => void
    canDownload: boolean
  }) => (
    <div data-testid="sidebar">
      <span data-testid="selected-generator">{selectedGenerator.name}</span>
      <span data-testid="generator-count">{generators.length}</span>
      <span data-testid="can-download">{canDownload.toString()}</span>
      <button data-testid="change-generator" onClick={() => onGeneratorChange('custom-sign')}>
        Change Generator
      </button>
      <button data-testid="change-param" onClick={() => onParamChange('outer_diameter', 50)}>
        Change Param
      </button>
      <button data-testid="download" onClick={onDownload}>
        Download
      </button>
      <pre data-testid="params">{JSON.stringify(params)}</pre>
    </div>
  )
}))

vi.mock('./components/CompilerOutput', () => ({
  CompilerOutput: ({ output }: { output: string | null }) => (
    output ? <div data-testid="compiler-output">{output}</div> : null
  )
}))

// Mock useOpenSCAD hook
const mockCompile = vi.fn()
vi.mock('./hooks/useOpenSCAD', () => ({
  useOpenSCAD: () => ({
    status: 'ready',
    error: null,
    compilerOutput: null,
    stlBlob: new Blob(['test'], { type: 'model/stl' }),
    compile: mockCompile
  })
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompile.mockResolvedValue(new Blob(['test']))
    // Reset URL state between tests to prevent pollution
    window.history.replaceState({}, '', window.location.pathname)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with default generator selected', async () => {
    const App = (await import('./App')).default
    render(<App />)

    const selectedGen = screen.getByTestId('selected-generator')
    expect(selectedGen.textContent).toBe('Spacer')

    const genCount = screen.getByTestId('generator-count')
    expect(genCount.textContent).toBe('10')
  })

  it('initializes with default parameters for selected generator', async () => {
    const App = (await import('./App')).default
    render(<App />)

    const paramsEl = screen.getByTestId('params')
    const params = JSON.parse(paramsEl.textContent || '{}')
    expect(params.outer_diameter).toBe(20)
    expect(params.inner_hole).toBe(5)
    expect(params.height).toBe(10)
  })

  it('switches generator and resets parameters', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Initially shows spacer
    expect(screen.getByTestId('selected-generator').textContent).toBe('Spacer')

    // Click to change generator
    fireEvent.click(screen.getByTestId('change-generator'))

    // Now shows sign generator
    await waitFor(() => {
      expect(screen.getByTestId('selected-generator').textContent).toBe('Sign')
    })

    // Params should be reset to sign's defaults
    const paramsEl = screen.getByTestId('params')
    const params = JSON.parse(paramsEl.textContent || '{}')
    expect(params.text).toBe('HELLO')
    expect(params.text_size).toBe(12)
  })

  it('updates parameters when changed', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Get initial params
    let paramsEl = screen.getByTestId('params')
    let params = JSON.parse(paramsEl.textContent || '{}')
    expect(params.outer_diameter).toBe(20)

    // Click to change param
    fireEvent.click(screen.getByTestId('change-param'))

    // Params should be updated
    await waitFor(() => {
      paramsEl = screen.getByTestId('params')
      params = JSON.parse(paramsEl.textContent || '{}')
      expect(params.outer_diameter).toBe(50)
    })
  })

  it('shows correct download availability', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Should be able to download when blob exists and status is ready
    const canDownload = screen.getByTestId('can-download')
    expect(canDownload.textContent).toBe('true')
  })
})

describe('App - getDefaultParams', () => {
  it('correctly generates default params from generator parameters', async () => {
    const { generators } = await import('./generators')
    const spacer = generators[0]!

    // Manually test the logic that would be in getDefaultParams
    const defaults = spacer.parameters.reduce((acc, param) => {
      acc[param.name] = param.default
      return acc
    }, {} as Record<string, unknown>)

    expect(defaults).toEqual({
      outer_diameter: 20,
      inner_hole: 5,
      height: 10
    })
  })
})

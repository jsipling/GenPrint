/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { generators } from './generators'

// Get the first generator (sorted alphabetically) for App default selection tests
const firstGenerator = generators[0]
if (!firstGenerator) throw new Error('No generators available for testing')

// Mock the components and hooks to isolate App logic
vi.mock('./components/Viewer', () => ({
  Viewer: ({ meshData, isCompiling }: { meshData: unknown; isCompiling: boolean }) => (
    <div data-testid="viewer" data-compiling={isCompiling} data-has-mesh={!!meshData}>
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

// Mock useManifold hook
const mockBuild = vi.fn()
vi.mock('./hooks/useManifold', () => ({
  useManifold: () => ({
    status: 'ready',
    error: null,
    meshData: { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array() },
    build: mockBuild
  })
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuild.mockResolvedValue(undefined)
    // Reset URL state between tests to prevent pollution
    window.history.replaceState({}, '', window.location.pathname)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with first generator selected (alphabetically sorted)', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // First generator alphabetically is selected
    const selectedGen = screen.getByTestId('selected-generator')
    expect(selectedGen.textContent).toBe(firstGenerator.name)

    const genCount = screen.getByTestId('generator-count')
    expect(Number(genCount.textContent)).toBe(generators.length)
  })

  it('initializes with default parameters for first generator', async () => {
    const App = (await import('./App')).default
    render(<App />)

    const paramsEl = screen.getByTestId('params')
    const params = JSON.parse(paramsEl.textContent || '{}')

    // Verify all default params from first generator are present
    for (const param of firstGenerator.parameters) {
      expect(params[param.name]).toBe(param.default)
    }
  })

  it('handles switching to non-existent generator gracefully', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Initially shows first generator
    expect(screen.getByTestId('selected-generator').textContent).toBe(firstGenerator.name)

    // Click to change generator (mock tries to change to 'custom-sign' which doesn't exist)
    fireEvent.click(screen.getByTestId('change-generator'))

    // Should still show first generator since custom-sign doesn't exist
    await waitFor(() => {
      expect(screen.getByTestId('selected-generator').textContent).toBe(firstGenerator.name)
    })
  })

  it('updates parameters when changed', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Click to change param (mock changes outer_diameter - adds new param)
    fireEvent.click(screen.getByTestId('change-param'))

    // Params should be updated
    await waitFor(() => {
      const paramsEl = screen.getByTestId('params')
      const params = JSON.parse(paramsEl.textContent || '{}')
      expect(params.outer_diameter).toBe(50)
    })
  })

  it('shows correct download availability', async () => {
    const App = (await import('./App')).default
    render(<App />)

    // Should be able to download when mesh exists and status is ready
    const canDownload = screen.getByTestId('can-download')
    expect(canDownload.textContent).toBe('true')
  })
})

describe('App - getDefaultParams for all generators', () => {
  // Dynamically test all generators
  for (const generator of generators) {
    describe(`${generator.name} (${generator.id})`, () => {
      it('has valid parameter definitions', () => {
        expect(generator.parameters.length).toBeGreaterThan(0)

        for (const param of generator.parameters) {
          expect(param.name).toBeTruthy()
          expect(param.label).toBeTruthy()
          expect(param.default).toBeDefined()
        }
      })

      it('correctly generates default params from parameters', () => {
        const defaults = generator.parameters.reduce((acc, param) => {
          acc[param.name] = param.default
          return acc
        }, {} as Record<string, unknown>)

        // Each param's default should be in the defaults object
        for (const param of generator.parameters) {
          expect(defaults[param.name]).toBe(param.default)
        }
      })

      it('has number parameters with valid ranges', () => {
        const numberParams = generator.parameters.filter(p => p.type === 'number')

        for (const param of numberParams) {
          if (param.type === 'number') {
            expect(param.min).toBeLessThanOrEqual(param.default)
            expect(param.max).toBeGreaterThanOrEqual(param.default)
            expect(param.min).toBeLessThan(param.max)
          }
        }
      })

      it('has required metadata', () => {
        expect(generator.id).toBeTruthy()
        expect(generator.name).toBeTruthy()
        expect(generator.description).toBeTruthy()
        expect(generator.builderCode).toBeTruthy()
      })
    })
  }
})

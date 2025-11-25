/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Suppress React Three Fiber JSX element warnings in jsdom
// These are expected since r3f uses lowercase custom elements that jsdom doesn't recognize
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : ''
    // Suppress r3f element warnings and React DOM prop warnings
    if (
      message.includes('is using incorrect casing') ||
      message.includes('is unrecognized in this browser') ||
      message.includes('React does not recognize the')
    ) {
      return
    }
    originalConsoleError.apply(console, args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
})


// Mock @react-three/fiber Canvas since WebGL isn't available in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-mock">{children}</div>
  ),
  useThree: () => ({
    camera: {
      position: { set: vi.fn(), length: () => 100, copy: vi.fn() },
      up: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      fov: 50
    }
  }),
  useFrame: vi.fn()
}))

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div data-testid="line" />
}))

// Mock three
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual as object,
    BufferGeometry: class MockBufferGeometry {
      boundingBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 }, getSize: vi.fn() }
      setAttribute = vi.fn()
      setIndex = vi.fn()
      computeBoundingBox = vi.fn()
      computeVertexNormals = vi.fn()
      dispose = vi.fn()
    },
    BufferAttribute: class MockBufferAttribute {
      constructor(public array: Float32Array | Uint32Array, public itemSize: number) {}
    },
    Vector3: class MockVector3 {
      x = 0; y = 0; z = 0
      set = vi.fn()
      getSize = vi.fn()
    }
  }
})

// Mock three-stdlib STLLoader
vi.mock('three-stdlib', () => ({
  STLLoader: class MockSTLLoader {
    parse = vi.fn(() => ({
      computeVertexNormals: vi.fn(),
      computeBoundingBox: vi.fn(),
      boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 }, getSize: vi.fn() },
      dispose: vi.fn()
    }))
  },
  OrbitControls: vi.fn()
}))

describe('Viewer component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('displays waiting message when no geometry and not compiling', async () => {
    const { Viewer } = await import('./Viewer')
    render(<Viewer isCompiling={false} />)

    expect(screen.getByText('Waiting for model...')).toBeTruthy()
  })

  it('does not show waiting message when compiling', async () => {
    const { Viewer } = await import('./Viewer')
    render(<Viewer isCompiling={true} />)

    expect(screen.queryByText('Waiting for model...')).toBeNull()
  })

  it('renders Canvas with proper structure', async () => {
    const { Viewer } = await import('./Viewer')
    render(<Viewer isCompiling={false} />)

    expect(screen.getByTestId('canvas-mock')).toBeTruthy()
  })

  it('has accessible loading states with proper ARIA attributes', async () => {
    const { Viewer } = await import('./Viewer')
    render(<Viewer isCompiling={false} />)

    const statusEl = screen.getByRole('status')
    expect(statusEl.getAttribute('aria-live')).toBe('polite')
  })

  it('renders with meshData without error', async () => {
    const { Viewer } = await import('./Viewer')
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2])
    }

    // Should not throw when rendering with meshData
    expect(() => {
      render(<Viewer meshData={meshData} isCompiling={false} />)
    }).not.toThrow()
  })

  it('passes generatorId to maintain camera state', async () => {
    const { Viewer } = await import('./Viewer')

    // First render with one generator
    const { rerender } = render(<Viewer isCompiling={false} generatorId="gen1" />)

    // Re-render with different generator - should not throw
    expect(() => {
      rerender(<Viewer isCompiling={false} generatorId="gen2" />)
    }).not.toThrow()
  })

  it('handles undefined generatorId gracefully', async () => {
    const { Viewer } = await import('./Viewer')

    // Should not throw when generatorId is undefined
    expect(() => {
      render(<Viewer isCompiling={false} generatorId={undefined} />)
    }).not.toThrow()
  })

  it('error boundary receives key prop to reset on data change', async () => {
    const { Viewer } = await import('./Viewer')

    // Render without meshData first (no error)
    const { container } = render(<Viewer isCompiling={false} />)

    // Error boundary wrapper should have the key attribute
    const errorBoundary = container.querySelector('[data-error-boundary-key]')
    expect(errorBoundary).not.toBeNull()
    const key1 = errorBoundary?.getAttribute('data-error-boundary-key')
    expect(key1).toBe('0') // Initial key is 0

    // The key is incremented after successful mesh loads, which we can't easily
    // test with mocks. Instead verify the attribute exists and has expected initial value.
  })
})

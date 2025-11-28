/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { NamedPart } from '../generators'

// Suppress React Three Fiber JSX element warnings in jsdom
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : ''
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

// Mock @react-three/fiber
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
      fov: 50,
      near: 0.1,
      far: 1000
    },
    controls: {
      target: { copy: vi.fn() },
      update: vi.fn()
    }
  }),
  useFrame: vi.fn()
}))

// Mock three
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual as object,
    BufferGeometry: class MockBufferGeometry {
      boundingBox = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 },
        getSize: vi.fn((v) => { v.x = 10; v.y = 10; v.z = 10 })
      }
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
      set = vi.fn().mockReturnThis()
      copy = vi.fn().mockReturnThis()
    },
    Box3: class MockBox3 {
      min = { x: 0, y: 0, z: 0 }
      max = { x: 10, y: 10, z: 10 }
      makeEmpty = vi.fn().mockReturnThis()
      expandByPoint = vi.fn().mockReturnThis()
      getSize = vi.fn((v) => { v.x = 10; v.y = 10; v.z = 10; return v })
    },
    Group: class MockGroup {
      position = { set: vi.fn() }
    }
  }
})

// Helper to create test mesh data
function createTestMeshData() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  }
}

// Helper to create a test NamedPart
function createTestPart(name: string, offset: [number, number, number] = [0, 0, 0]): NamedPart {
  return {
    name,
    meshData: createTestMeshData(),
    boundingBox: {
      min: [offset[0], offset[1], offset[2]],
      max: [offset[0] + 10, offset[1] + 10, offset[2] + 10]
    }
  }
}

describe('MultiPartModel component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders without crashing with parts', async () => {
    const { MultiPartModel } = await import('./MultiPartModel')
    const parts = [
      createTestPart('part-1'),
      createTestPart('part-2', [10, 0, 0]),
      createTestPart('part-3', [20, 0, 0])
    ]
    const onPartHover = vi.fn()

    // In jsdom, R3F elements like <group> and <mesh> are rendered as custom elements
    // but don't have full Three.js functionality - we just test that it renders
    expect(() => {
      render(<MultiPartModel parts={parts} onPartHover={onPartHover} />)
    }).not.toThrow()
  })

  it('handles empty parts array gracefully', async () => {
    const { MultiPartModel } = await import('./MultiPartModel')
    const onPartHover = vi.fn()

    // Should not throw when rendering with empty parts
    expect(() => {
      render(<MultiPartModel parts={[]} onPartHover={onPartHover} />)
    }).not.toThrow()
  })

  it('accepts generatorId prop for camera management', async () => {
    const { MultiPartModel } = await import('./MultiPartModel')
    const parts = [createTestPart('test-part')]
    const onPartHover = vi.fn()

    // Should not throw when generatorId is provided
    expect(() => {
      render(
        <MultiPartModel
          parts={parts}
          onPartHover={onPartHover}
          generatorId="test-generator"
        />
      )
    }).not.toThrow()
  })

  it('re-renders correctly when parts change', async () => {
    const { MultiPartModel } = await import('./MultiPartModel')
    const onPartHover = vi.fn()

    const { rerender, container } = render(
      <MultiPartModel
        parts={[createTestPart('part-1')]}
        onPartHover={onPartHover}
      />
    )

    // Change parts - should update without throwing
    expect(() => {
      rerender(
        <MultiPartModel
          parts={[createTestPart('part-1'), createTestPart('part-2', [10, 0, 0])]}
          onPartHover={onPartHover}
        />
      )
    }).not.toThrow()

    expect(container).toBeTruthy()
  })
})

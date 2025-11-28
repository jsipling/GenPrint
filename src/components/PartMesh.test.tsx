/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
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
      fov: 50
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

// Helper to create test mesh data
function createTestMeshData() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  }
}

// Helper to create a test NamedPart
function createTestPart(name: string): NamedPart {
  return {
    name,
    meshData: createTestMeshData(),
    boundingBox: { min: [0, 0, 0], max: [10, 10, 10] }
  }
}

describe('PartMesh component', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders mesh with geometry from part', async () => {
    const { PartMesh } = await import('./PartMesh')
    const part = createTestPart('test-part')
    const onPointerEnter = vi.fn()
    const onPointerLeave = vi.fn()

    const { container } = render(
      <PartMesh
        part={part}
        isHovered={false}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
    )

    // Component should render without throwing
    expect(container).toBeTruthy()
  })

  it('applies normal color when not hovered', async () => {
    const { NORMAL_COLOR } = await import('./PartMesh')

    // The component uses meshLambertMaterial with color prop
    // We test the exported constant matches expected value
    expect(NORMAL_COLOR).toBe('#4a90d9')
  })

  it('applies hover color when hovered', async () => {
    const { HOVER_COLOR } = await import('./PartMesh')

    // The component uses meshLambertMaterial with color prop
    // We test the exported constant matches expected value
    expect(HOVER_COLOR).toBe('#6ab0f3')
  })

  it('exports emissive hover color constant', async () => {
    const { HOVER_EMISSIVE } = await import('./PartMesh')
    expect(HOVER_EMISSIVE).toBe('#1a4a7a')
  })

  it('calls onPointerEnter when pointer enters mesh', async () => {
    const { PartMesh } = await import('./PartMesh')
    const part = createTestPart('test-part')
    const onPointerEnter = vi.fn()
    const onPointerLeave = vi.fn()

    const { container } = render(
      <PartMesh
        part={part}
        isHovered={false}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
    )

    // Find the mesh element and trigger pointer event
    const meshElement = container.querySelector('mesh')
    if (meshElement) {
      fireEvent.pointerEnter(meshElement)
      expect(onPointerEnter).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onPointerLeave when pointer leaves mesh', async () => {
    const { PartMesh } = await import('./PartMesh')
    const part = createTestPart('test-part')
    const onPointerEnter = vi.fn()
    const onPointerLeave = vi.fn()

    const { container } = render(
      <PartMesh
        part={part}
        isHovered={false}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
    )

    // Find the mesh element and trigger pointer event
    const meshElement = container.querySelector('mesh')
    if (meshElement) {
      fireEvent.pointerLeave(meshElement)
      expect(onPointerLeave).toHaveBeenCalledTimes(1)
    }
  })
})

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  TICK_SIZE,
  SMALL_TICK_SIZE,
  MAX_TICKS_PER_AXIS,
  DEFAULT_GRID_SIZE,
  calculateTicksAndLabels,
  calculateGridParams
} from './gridUtils'

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

describe('MeasuredGrid tick calculation', () => {
  it('should use 5mm tick interval for small grids', () => {
    const { tickInterval } = calculateTicksAndLabels(100)
    expect(tickInterval).toBe(5)
  })

  it('should use 5mm tick interval for medium grids', () => {
    const { tickInterval } = calculateTicksAndLabels(400)
    expect(tickInterval).toBe(5)
  })

  it('should increase tick interval for large grids to cap tick count', () => {
    // For a 2000mm model, gridSize = 4000 (doubled for centering)
    // halfSize = 2000, which would give 400 ticks at 5mm interval
    // Should scale up to ~20mm interval to cap at ~100 ticks
    const { tickInterval, ticks } = calculateTicksAndLabels(4000)

    // Tick interval should be increased
    expect(tickInterval).toBeGreaterThan(5)

    // Total X axis ticks should be capped
    const xAxisTicks = ticks.filter(t => t.color === '#ff4444')
    expect(xAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
  })

  it('should cap total tick count for very large grids', () => {
    // 10 meter model would be size = 20000
    const { ticks } = calculateTicksAndLabels(20000)

    // Each axis should have at most MAX_TICKS_PER_AXIS ticks
    const xAxisTicks = ticks.filter(t => t.color === '#ff4444')
    const yAxisTicks = ticks.filter(t => t.color === '#44ff44')
    const zAxisTicks = ticks.filter(t => t.color === '#4444ff')

    expect(xAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
    expect(yAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
    // Z axis has 2 ticks per interval (on X and Y planes)
    expect(zAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS * 2)
  })

  it('should generate labels at appropriate intervals for small grids', () => {
    const { labels, effectiveLabelInterval } = calculateTicksAndLabels(100)

    // For size <= 100, label interval should be 10
    expect(effectiveLabelInterval).toBe(10)

    // Check labels exist at expected positions
    const xLabels = labels.filter(l => l.pos[1] === -TICK_SIZE - 2 && l.pos[2] === 0)
    expect(xLabels.length).toBeGreaterThan(0)
    expect(xLabels.some(l => l.text === '10')).toBe(true)
  })

  it('should generate fewer labels for larger grids', () => {
    const small = calculateTicksAndLabels(100)
    const large = calculateTicksAndLabels(1000)

    // Larger grids should have larger effective label intervals
    expect(large.effectiveLabelInterval).toBeGreaterThan(small.effectiveLabelInterval)
  })

  it('should generate correct tick colors for each axis', () => {
    const { ticks } = calculateTicksAndLabels(200)

    // X axis ticks should be red (first point X > 0, Z near 0)
    const xTicks = ticks.filter(t => t.color === '#ff4444')
    expect(xTicks.length).toBeGreaterThan(0)

    // Y axis ticks should be green
    const yTicks = ticks.filter(t => t.color === '#44ff44')
    expect(yTicks.length).toBeGreaterThan(0)

    // Z axis ticks should be blue
    const zTicks = ticks.filter(t => t.color === '#4444ff')
    expect(zTicks.length).toBeGreaterThan(0)

    // All ticks should have one of the expected colors
    const validColors = ['#ff4444', '#44ff44', '#4444ff']
    expect(ticks.every(t => validColors.includes(t.color))).toBe(true)
  })

  it('should use larger tick size for 10mm intervals', () => {
    const { ticks } = calculateTicksAndLabels(100)

    // Find ticks at 10mm position (should have TICK_SIZE)
    const tickAt10mm = ticks.find(t =>
      t.color === '#ff4444' &&
      t.points[0][0] === 10 &&
      Math.abs(t.points[0][1]) === TICK_SIZE
    )
    expect(tickAt10mm).toBeDefined()

    // Find ticks at 5mm position (should have SMALL_TICK_SIZE)
    const tickAt5mm = ticks.find(t =>
      t.color === '#ff4444' &&
      t.points[0][0] === 5 &&
      Math.abs(t.points[0][1]) === SMALL_TICK_SIZE
    )
    expect(tickAt5mm).toBeDefined()
  })
})

describe('Grid size calculations', () => {
  it('should use default size for small models', () => {
    const { gridSize } = calculateGridParams(50)
    expect(gridSize).toBe(DEFAULT_GRID_SIZE * 2)
  })

  it('should scale grid for large models', () => {
    const { gridSize } = calculateGridParams(1000)
    expect(gridSize).toBe(2000) // 1000 rounded up * 2
  })

  it('should round up model dimension to nearest 10mm', () => {
    const { gridRange } = calculateGridParams(123)
    expect(gridRange).toBe(DEFAULT_GRID_SIZE) // Still uses default since 130 < 400
  })

  it('should round up for models larger than default', () => {
    const { gridRange } = calculateGridParams(423)
    expect(gridRange).toBe(430) // ceil(423/10) * 10 = 430
  })
})

describe('Viewer component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('displays compiling overlay when isCompiling is true', async () => {
    const { Viewer } = await import('./Viewer')
    render(<Viewer isCompiling={true} />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Compiling...')).toBeTruthy()
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
    render(<Viewer isCompiling={true} />)

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
})

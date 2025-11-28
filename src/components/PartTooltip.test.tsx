/** @vitest-environment jsdom */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PartTooltip, formatPartDimensions } from './PartTooltip'
import type { NamedPart } from '../generators'

describe('PartTooltip', () => {
  // Helper to create test mesh data
  const createMeshData = () => ({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  })

  // Helper to create a test NamedPart
  const createTestPart = (name: string, overrides?: Partial<NamedPart>): NamedPart => ({
    name,
    meshData: createMeshData(),
    boundingBox: {
      min: [0, 0, 0] as [number, number, number],
      max: [15, 20, 30] as [number, number, number]
    },
    ...overrides
  })

  afterEach(() => {
    cleanup()
  })

  it('renders part name in bold', () => {
    const part = createTestPart('Cylinder Block')
    render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    const nameElement = screen.getByText('Cylinder Block')
    expect(nameElement).toBeTruthy()
    expect(nameElement.tagName.toLowerCase()).toBe('div')
    expect(nameElement.classList.contains('font-bold')).toBe(true)
  })

  it('renders custom dimensions when available', () => {
    const part = createTestPart('Engine Block', {
      dimensions: [
        { label: 'Bore', param: 'bore', format: '\u229850mm' },
        { label: 'Stroke', param: 'stroke' }
      ],
      params: { bore: 50, stroke: 45 }
    })
    render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    // Check custom dimensions are displayed
    expect(screen.getByText('Bore:')).toBeTruthy()
    expect(screen.getByText('\u229850mm')).toBeTruthy()
    expect(screen.getByText('Stroke:')).toBeTruthy()
    expect(screen.getByText('45mm')).toBeTruthy()
  })

  it('falls back to bounding box dimensions when no custom dimensions', () => {
    const part = createTestPart('Simple Part')
    render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    // Should show bounding box dimensions (width x depth x height)
    expect(screen.getByText('15 \u00d7 20 \u00d7 30 mm')).toBeTruthy()
  })

  it('is hidden when part is null', () => {
    const { container } = render(<PartTooltip part={null} position={{ x: 100, y: 100 }} />)

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('is hidden when position is null', () => {
    const part = createTestPart('Test Part')
    const { container } = render(<PartTooltip part={part} position={null} />)

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('positions tooltip offset from cursor', () => {
    const part = createTestPart('Test Part')
    const { container } = render(<PartTooltip part={part} position={{ x: 150, y: 200 }} />)

    const tooltip = container.firstChild as HTMLElement
    expect(tooltip).toBeTruthy()

    // Check position styles - should be offset by 10px from cursor
    expect(tooltip.style.left).toBe('160px')
    expect(tooltip.style.top).toBe('210px')
  })

  it('has pointer-events: none to prevent interference', () => {
    const part = createTestPart('Test Part')
    const { container } = render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    const tooltip = container.firstChild as HTMLElement
    expect(tooltip.style.pointerEvents).toBe('none')
  })

  it('applies correct styling classes', () => {
    const part = createTestPart('Test Part')
    const { container } = render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    const tooltip = container.firstChild as HTMLElement
    expect(tooltip.classList.contains('bg-gray-900/90')).toBe(true)
    expect(tooltip.classList.contains('backdrop-blur-sm')).toBe(true)
    expect(tooltip.classList.contains('rounded-lg')).toBe(true)
    expect(tooltip.classList.contains('border')).toBe(true)
    expect(tooltip.classList.contains('border-gray-700')).toBe(true)
  })

  it('formats decimal dimensions to 1 decimal place', () => {
    const part = createTestPart('Decimal Part', {
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [15.678, 20.123, 30.5] as [number, number, number]
      }
    })
    render(<PartTooltip part={part} position={{ x: 100, y: 100 }} />)

    // Should show rounded dimensions
    expect(screen.getByText('15.7 \u00d7 20.1 \u00d7 30.5 mm')).toBeTruthy()
  })
})

describe('formatPartDimensions', () => {
  // Helper to create test mesh data
  const createMeshData = () => ({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  })

  it('returns formatted custom dimensions when available', () => {
    const part: NamedPart = {
      name: 'Test Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [10, 10, 10] as [number, number, number]
      },
      dimensions: [
        { label: 'Bore', param: 'bore', format: '\u2298{value}mm' },
        { label: 'Stroke', param: 'stroke' }
      ],
      params: { bore: 50, stroke: 45 }
    }

    const result = formatPartDimensions(part)

    expect(result).toEqual([
      { label: 'Bore', value: '\u229850mm' },
      { label: 'Stroke', value: '45mm' }
    ])
  })

  it('returns bounding box dimensions when no custom dimensions', () => {
    const part: NamedPart = {
      name: 'Simple Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [15, 20, 30] as [number, number, number]
      }
    }

    const result = formatPartDimensions(part)

    expect(result).toEqual([
      { label: null, value: '15 \u00d7 20 \u00d7 30 mm' }
    ])
  })

  it('returns bounding box when dimensions array is empty', () => {
    const part: NamedPart = {
      name: 'Empty Dims Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [10, 15, 20] as [number, number, number]
      },
      dimensions: []
    }

    const result = formatPartDimensions(part)

    expect(result).toEqual([
      { label: null, value: '10 \u00d7 15 \u00d7 20 mm' }
    ])
  })

  it('skips dimensions with missing param values', () => {
    const part: NamedPart = {
      name: 'Test Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [10, 10, 10] as [number, number, number]
      },
      dimensions: [
        { label: 'Bore', param: 'bore' },
        { label: 'Stroke', param: 'stroke' }
      ],
      params: { bore: 50 } // stroke is missing
    }

    const result = formatPartDimensions(part)

    expect(result).toEqual([
      { label: 'Bore', value: '50mm' }
    ])
  })

  it('handles nested param paths', () => {
    const part: NamedPart = {
      name: 'Test Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [10, 10, 10] as [number, number, number]
      },
      dimensions: [
        { label: 'Diameter', param: 'bore.diameter' }
      ],
      params: { 'bore.diameter': 50 } // Flat key - won't match nested path
    }

    // With flat key, getNestedParam won't find it, so should fall back to bounding box
    const result = formatPartDimensions(part)

    expect(result).toEqual([
      { label: null, value: '10 \u00d7 10 \u00d7 10 mm' }
    ])
  })

  it('formats whole numbers without decimal', () => {
    const part: NamedPart = {
      name: 'Test Part',
      meshData: createMeshData(),
      boundingBox: {
        min: [0, 0, 0] as [number, number, number],
        max: [10, 15, 20] as [number, number, number]
      }
    }

    const result = formatPartDimensions(part)

    // Should not have decimal points for whole numbers
    expect(result[0]!.value).toBe('10 \u00d7 15 \u00d7 20 mm')
  })
})

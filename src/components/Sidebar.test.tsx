/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import type { Generator } from '../generators'

const mockGenerator: Generator = {
  id: 'test-generator',
  type: 'manifold',
  builderId: 'test',
  name: 'Test Generator',
  description: 'A test generator',
  parameters: [
    { type: 'number', name: 'size', label: 'Size', min: 1, max: 100, default: 50, unit: 'mm' }
  ]
}

const defaultProps = {
  generators: [mockGenerator],
  selectedGenerator: mockGenerator,
  onGeneratorChange: vi.fn(),
  params: { size: 50 },
  onParamChange: vi.fn(),
  onDownload: vi.fn(),
  onReset: vi.fn(),
  canDownload: true
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the app title', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('GenPrint')).toBeTruthy()
  })

  it('shows the selected generator name', () => {
    render(<Sidebar {...defaultProps} />)
    // Use getAllByText since name appears in both h2 and select option
    const elements = screen.getAllByText('Test Generator')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('renders parameter inputs', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByLabelText('Size')).toBeTruthy()
  })

  it('disables download button when canDownload is false', () => {
    render(<Sidebar {...defaultProps} canDownload={false} />)
    const button = screen.getByRole('button', { name: /download/i })
    expect(button).toHaveProperty('disabled', true)
  })

  it('uses dynamicMax to constrain slider range', () => {
    const generatorWithDynamicMax: Generator = {
      id: 'dynamic-test',
      type: 'manifold',
      builderId: 'dynamic_test',
      name: 'Dynamic Test',
      description: 'Test dynamic max',
      parameters: [
        { type: 'number', name: 'module', label: 'Module', min: 0.5, max: 10, default: 2 },
        {
          type: 'number',
          name: 'teeth',
          label: 'Teeth',
          min: 8,
          max: 100,
          default: 20,
          dynamicMax: (params) => Math.floor(Number(params['module']) * 15)
        }
      ]
    }

    // With module=2, dynamicMax should be 30
    render(<Sidebar
      {...defaultProps}
      selectedGenerator={generatorWithDynamicMax}
      generators={[generatorWithDynamicMax]}
      params={{ module: 2, teeth: 20 }}
    />)

    const teethSlider = screen.getByLabelText('Teeth') as HTMLInputElement
    expect(teethSlider.max).toBe('30')
  })
})

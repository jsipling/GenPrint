/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useImageToModel } from './useImageToModel'
import type { ImageToGeometryService, GeometryAnalysis } from '../services/imageToGeometryTypes'
import type { Generator, ParameterValues } from '../generators/types'

describe('useImageToModel', () => {
  let mockService: ImageToGeometryService
  let mockOnGeneratorCreated: Mock<(generator: Generator, params: ParameterValues) => void>

  const mockAnalysis: GeometryAnalysis = {
    description: 'A simple box model',
    builderCode: 'return M.Manifold.cube([10, 10, 10], true);',
    suggestedName: 'Test Model',
    parameters: [
      { type: 'number', name: 'size', label: 'Size', min: 1, max: 100, default: 10 }
    ],
    defaultParams: { size: 10 }
  }

  beforeEach(() => {
    mockService = {
      analyzeImage: vi.fn(),
      isAnalyzing: vi.fn(() => false),
      cancelAnalysis: vi.fn()
    }
    mockOnGeneratorCreated = vi.fn()
  })

  it('initializes with correct default state', () => {
    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    expect(result.current.isApplying).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets isApplying true during analysis', async () => {
    let resolveAnalysis: ((value: { success: boolean; analysis: GeometryAnalysis }) => void) | null = null
    const mockAnalyze = vi.fn().mockImplementation(
      () => new Promise(resolve => {
        resolveAnalysis = resolve
      })
    )
    mockService.analyzeImage = mockAnalyze

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    act(() => {
      void result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    await waitFor(() => {
      expect(result.current.isApplying).toBe(true)
    })

    act(() => {
      resolveAnalysis?.({ success: true, analysis: mockAnalysis })
    })

    await waitFor(() => {
      expect(result.current.isApplying).toBe(false)
    })
  })

  it('calls onGeneratorCreated on successful analysis', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      success: true,
      analysis: mockAnalysis
    })
    mockService.analyzeImage = mockAnalyze

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    expect(mockOnGeneratorCreated).toHaveBeenCalledTimes(1)

    const [generator, params] = mockOnGeneratorCreated.mock.calls[0] as [Generator, ParameterValues]

    // Verify generator structure
    expect(generator.id).toMatch(/^ai-generated-\d+$/)
    expect(generator.name).toBe('Test Model')
    expect(generator.description).toBe('AI-generated from design image')
    expect(generator.parameters).toEqual(mockAnalysis.parameters)
    expect(generator.builderCode).toBe(mockAnalysis.builderCode)

    // Verify params
    expect(params).toEqual(mockAnalysis.defaultParams)
  })

  it('sets error on failed analysis', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      success: false,
      error: 'Failed to analyze image'
    })
    mockService.analyzeImage = mockAnalyze

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    expect(result.current.error).toBe('Failed to analyze image')
    expect(mockOnGeneratorCreated).not.toHaveBeenCalled()
  })

  it('clears error when starting new analysis', async () => {
    const mockAnalyze = vi.fn()
    mockService.analyzeImage = mockAnalyze

    // First call fails
    mockAnalyze.mockResolvedValueOnce({
      success: false,
      error: 'First error'
    })

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    expect(result.current.error).toBe('First error')

    // Second call succeeds - error should be cleared when starting
    mockAnalyze.mockResolvedValueOnce({
      success: true,
      analysis: mockAnalysis
    })

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test2', 'create a sphere')
    })

    expect(result.current.error).toBeNull()
  })

  it('sets isApplying false after completion (success)', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      success: true,
      analysis: mockAnalysis
    })
    mockService.analyzeImage = mockAnalyze

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    expect(result.current.isApplying).toBe(false)
  })

  it('sets isApplying false after failure', async () => {
    const mockAnalyze = vi.fn().mockRejectedValue(new Error('Network error'))
    mockService.analyzeImage = mockAnalyze

    const { result } = renderHook(() =>
      useImageToModel(mockService, mockOnGeneratorCreated)
    )

    await act(async () => {
      await result.current.applyToModel('data:image/png;base64,test', 'create a box')
    })

    expect(result.current.isApplying).toBe(false)
    expect(result.current.error).toBe('Network error')
  })
})

import { useState, useCallback } from 'react'
import type { ImageToGeometryService } from '../services/imageToGeometryTypes'
import type { Generator, ParameterValues } from '../generators/types'
import type { SketchContext } from '../types/sketchContext'

/** Context about the current model for modification mode */
export interface CurrentModelContext {
  builderCode: string
  params: ParameterValues
  name: string
}

export function useImageToModel(
  imageToGeometryService: ImageToGeometryService,
  onGeneratorCreated: (generator: Generator, params: ParameterValues) => void
) {
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyToModel = useCallback(async (
    imageUrl: string,
    prompt: string,
    currentModel?: CurrentModelContext,
    sketchContext?: SketchContext
  ) => {
    setIsApplying(true)
    setError(null)

    try {
      const response = await imageToGeometryService.analyzeImage({
        imageDataUrl: imageUrl,
        prompt,
        sketchContext,
        currentBuilderCode: currentModel?.builderCode,
        currentParams: currentModel?.params,
        currentModelName: currentModel?.name
      })

      if (response.success && response.analysis) {
        const generator: Generator = {
          id: `ai-generated-${Date.now()}`,
          name: response.analysis.suggestedName,
          description: 'AI-generated from design image',
          parameters: response.analysis.parameters,
          builderCode: response.analysis.builderCode
        }

        onGeneratorCreated(generator, response.analysis.defaultParams)
      } else {
        setError(response.error ?? 'Failed to analyze image')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image')
    } finally {
      setIsApplying(false)
    }
  }, [imageToGeometryService, onGeneratorCreated])

  return {
    isApplying,
    error,
    applyToModel
  }
}

import type { SketchModel, GeometryModel, SketchModelOption, GeometryModelOption } from '../services/types'
import { SKETCH_MODELS, GEOMETRY_MODELS } from '../services/types'
import { hasApiKey } from '../services/aiService'

interface ModelSelectorProps {
  sketchModel: SketchModel
  geometryModel: GeometryModel
  onSketchModelChange: (model: SketchModel) => void
  onGeometryModelChange: (model: GeometryModel) => void
  showGeometrySelector: boolean
}

export function ModelSelector({
  sketchModel,
  geometryModel,
  onSketchModelChange,
  onGeometryModelChange,
  showGeometrySelector
}: ModelSelectorProps) {
  const hasOpenAi = hasApiKey('openai')
  const hasGoogle = hasApiKey('google')

  // Filter sketch models based on available API keys
  const availableSketchModels = SKETCH_MODELS.filter((model: SketchModelOption) => {
    if (model.provider === 'openai') return hasOpenAi
    if (model.provider === 'google') return hasGoogle
    return false
  })

  // Filter geometry models based on available API keys
  const availableGeometryModels = GEOMETRY_MODELS.filter((model: GeometryModelOption) => {
    if (model.provider === 'openai') return hasOpenAi
    if (model.provider === 'google') return hasGoogle
    return false
  })

  return (
    <div className="space-y-3">
      {/* Sketch Model Selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Sketch Model</label>
        <select
          value={sketchModel}
          onChange={(e) => onSketchModelChange(e.target.value as SketchModel)}
          className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          disabled={availableSketchModels.length === 0}
        >
          {availableSketchModels.map((model: SketchModelOption) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
          {availableSketchModels.length === 0 && (
            <option value="">No API keys configured</option>
          )}
        </select>
      </div>

      {/* Geometry Model Selector */}
      {showGeometrySelector && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">3D Model AI</label>
          <select
            value={geometryModel}
            onChange={(e) => onGeometryModelChange(e.target.value as GeometryModel)}
            className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={availableGeometryModels.length === 0}
          >
            {availableGeometryModels.map((model: GeometryModelOption) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
            {availableGeometryModels.length === 0 && (
              <option value="">No API keys configured</option>
            )}
          </select>
        </div>
      )}
    </div>
  )
}

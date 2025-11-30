import { useState } from 'react'
import { MultiViewSketchCanvas } from './MultiViewSketchCanvas'
import { GeneratedImageDisplay } from './GeneratedImageDisplay'
import { PromptInput } from './PromptInput'
import { ModelSelector } from './ModelSelector'
import { useDesignPanel, type GeneratedImage } from '../hooks/useDesignPanel'
import type { ImageGenerationService, SketchModel, GeometryModel } from '../services/types'
import type { MultiViewSketchData } from '../types/sketch'
import type { SketchContext } from '../types/sketchContext'

interface DesignPanelProps {
  aiService: ImageGenerationService
  onApplyToModel?: (imageUrl: string, prompt: string, sketchContext?: SketchContext) => void
  isApplying?: boolean
  sketchModel: SketchModel
  geometryModel: GeometryModel
  onSketchModelChange: (model: SketchModel) => void
  onGeometryModelChange: (model: GeometryModel) => void
}

export function DesignPanel({
  aiService,
  onApplyToModel,
  isApplying,
  sketchModel,
  geometryModel,
  onSketchModelChange,
  onGeometryModelChange
}: DesignPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [multiViewSketchData, setMultiViewSketchData] = useState<MultiViewSketchData | null>(null)

  const {
    images,
    currentIndex,
    prompt,
    isGenerating,
    error,
    continueConversation,
    setPrompt,
    setConversationMode,
    nextImage,
    previousImage,
    generateImage
  } = useDesignPanel(aiService)

  const handleExport = (data: MultiViewSketchData) => {
    setMultiViewSketchData(data)
  }

  const handleGenerate = () => {
    // Allow generation with just prompt or with multi-view sketch + prompt
    // Pass the multi-view data to the hook, which will handle composite creation
    generateImage(multiViewSketchData)
  }

  const handleApplyToModel = onApplyToModel
    ? (imageUrlOrImage: string | GeneratedImage) => {
        // Handle both string (URL) and full image object
        let imageUrl: string
        let sketchContext: SketchContext | undefined

        if (typeof imageUrlOrImage === 'string') {
          // Backward compatibility: just a URL string
          imageUrl = imageUrlOrImage
        } else {
          // Full image object with potential sketch context
          imageUrl = imageUrlOrImage.url
          sketchContext = imageUrlOrImage.sketchContext
        }

        // Use the current prompt field value (what user typed for "Apply to 3D Model")
        // Fall back to the prompt used to generate the image if the field is empty
        const currentImage = images[currentIndex]
        const promptToUse = prompt.trim() || currentImage?.prompt || ''
        if (promptToUse) {
          onApplyToModel(imageUrl, promptToUse, sketchContext)
        }
      }
    : undefined

  return (
    <aside className="w-80 bg-gray-800 text-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-900 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Design Assistant</h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand design panel' : 'Collapse design panel'}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Collapsible Content */}
      <div
        data-testid="design-panel-content"
        className={isCollapsed ? 'hidden' : 'flex-1 flex flex-col overflow-y-auto'}
      >
        {/* Model Selection Section */}
        <section className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium mb-3 text-gray-300">AI Models</h3>
          <ModelSelector
            sketchModel={sketchModel}
            geometryModel={geometryModel}
            onSketchModelChange={onSketchModelChange}
            onGeometryModelChange={onGeometryModelChange}
            showGeometrySelector={!!onApplyToModel}
          />
        </section>

        {/* Multi-View Sketch Canvas Section */}
        <section className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium mb-3 text-gray-300">Sketch Your Idea</h3>
          <MultiViewSketchCanvas onExport={handleExport} />
        </section>

        {/* Generated Image Section */}
        <section className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium mb-3 text-gray-300">Generated Images</h3>
          <GeneratedImageDisplay
            images={images}
            currentIndex={currentIndex}
            onPrevious={previousImage}
            onNext={nextImage}
            isLoading={isGenerating}
            error={error || undefined}
            onApplyToModel={handleApplyToModel}
            isApplying={isApplying}
          />
        </section>

        {/* Prompt Input Section */}
        <section className="p-4 mt-auto">
          <h3 className="text-sm font-medium mb-3 text-gray-300">Describe Your Design</h3>
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleGenerate}
            disabled={isGenerating}
            continueConversation={continueConversation}
            onConversationToggle={setConversationMode}
          />
        </section>
      </div>
    </aside>
  )
}

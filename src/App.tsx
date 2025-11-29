import { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'

// Lazy load Viewer to code-split Three.js (~1MB) from initial bundle
const Viewer = lazy(() => import('./components/Viewer').then(m => ({ default: m.Viewer })))
import { CompilerOutput } from './components/CompilerOutput'
import { DesignPanel } from './components/DesignPanel'
import { useManifold } from './hooks/useManifold'
import { useImageToModel } from './hooks/useImageToModel'
import { generators, flattenParameters, type ParameterValues } from './generators'
import type { Generator } from './generators/types'
import { meshToStl } from './lib/meshToStl'
import { createAiService, createImageToGeometryAiService } from './services/aiService'
import type { SketchModel, GeometryModel } from './services/types'

// No debounce - render immediately as settings change

// Parse URL params on load
function getUrlState(): { generatorId?: string; params?: ParameterValues } {
  const urlParams = new URLSearchParams(window.location.search)
  const generatorId = urlParams.get('g') || undefined
  const paramsStr = urlParams.get('p')

  if (paramsStr) {
    try {
      const params = JSON.parse(atob(paramsStr))
      return { generatorId, params }
    } catch {
      return { generatorId }
    }
  }
  return { generatorId }
}

// Update URL without reloading
function updateUrl(generatorId: string, params: ParameterValues) {
  const urlParams = new URLSearchParams()
  urlParams.set('g', generatorId)
  urlParams.set('p', btoa(JSON.stringify(params)))
  const newUrl = `${window.location.pathname}?${urlParams.toString()}`
  window.history.replaceState({}, '', newUrl)
}

function getDefaultParams(generator: typeof generators[0]): ParameterValues {
  return flattenParameters(generator.parameters).reduce((acc, param) => {
    acc[param.name] = param.default
    return acc
  }, {} as ParameterValues)
}

export default function App() {
  // Runtime check to ensure generators array is not empty
  const initialGenerator = generators[0]
  if (!initialGenerator) {
    throw new Error('No generators registered. At least one generator is required.')
  }

  // Parse URL once at init (avoid double parsing)
  const initialUrlState = getUrlState()

  // Initialize from URL or defaults
  const [selectedGenerator, setSelectedGenerator] = useState(() => {
    if (initialUrlState.generatorId) {
      const gen = generators.find(g => g.id === initialUrlState.generatorId)
      if (gen) return gen
    }
    return initialGenerator
  })
  const [params, setParams] = useState<ParameterValues>(() => {
    const gen = initialUrlState.generatorId
      ? generators.find(g => g.id === initialUrlState.generatorId) || initialGenerator
      : initialGenerator
    const defaults = getDefaultParams(gen)
    // Merge URL params with defaults (URL params override)
    return initialUrlState.params ? { ...defaults, ...initialUrlState.params } : defaults
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [designPanelOpen, setDesignPanelOpen] = useState(false)

  // AI model selection state
  const [sketchModel, setSketchModel] = useState<SketchModel>('openai-gpt-image-1-mini')
  const [geometryModel, setGeometryModel] = useState<GeometryModel>('gemini-2.5-pro-preview-06-05')

  // Create AI service instances (recreate when model changes)
  const aiService = useMemo(() => createAiService(sketchModel), [sketchModel])
  // Create image-to-geometry service (returns null if Google API key not configured)
  const imageToGeometryService = useMemo(() => createImageToGeometryAiService(geometryModel), [geometryModel])

  // Update URL when state changes
  useEffect(() => {
    updateUrl(selectedGenerator.id, params)
  }, [selectedGenerator.id, params])

  const handleGeneratorChange = (generatorId: string) => {
    const gen = generators.find(g => g.id === generatorId)
    if (gen) {
      setSelectedGenerator(gen)
      const newParams = getDefaultParams(gen)
      setParams(newParams)
      // Update ref immediately so doCompile uses the new generator
      generatorRef.current = gen
      if (hasCompiledOnceRef.current) {
        doCompile(newParams)
      }
    }
  }

  // Manifold hook for geometry generation
  const {
    status,
    error,
    meshData,
    parts,
    boundingBox,
    build: manifoldBuild
  } = useManifold()

  const hasCompiledOnceRef = useRef(false)
  const isCompilingRef = useRef(false)
  const pendingParamsRef = useRef<ParameterValues | null>(null)

  // Use ref to always have latest build function and generator without triggering effects
  const manifoldBuildRef = useRef(manifoldBuild)
  manifoldBuildRef.current = manifoldBuild
  const generatorRef = useRef(selectedGenerator)
  generatorRef.current = selectedGenerator

  // Track if we need a final-quality compile after draft preview
  const pendingFinalCompileRef = useRef<ParameterValues | null>(null)

  const doCompile = useCallback((currentParams: ParameterValues, isFinalPass = false) => {
    if (isCompilingRef.current) {
      // Queue the latest params to compile after current finishes
      pendingParamsRef.current = currentParams
      pendingFinalCompileRef.current = null // Cancel any pending final compile
      return
    }

    const generator = generatorRef.current

    // Use Manifold geometry generation
    isCompilingRef.current = true
    pendingParamsRef.current = null

    // Progressive: draft uses fewer segments, final uses full quality
    const circularSegments = isFinalPass ? 64 : 24

    manifoldBuildRef.current(generator.builderCode, currentParams, {
      silent: isFinalPass,
      circularSegments
    }).finally(() => {
      isCompilingRef.current = false

      if (pendingParamsRef.current) {
        const pending = pendingParamsRef.current
        pendingParamsRef.current = null
        pendingFinalCompileRef.current = null
        doCompile(pending)
        return
      }

      // Queue final quality compile after draft preview
      if (!isFinalPass) {
        const paramsKey = JSON.stringify(currentParams)
        pendingFinalCompileRef.current = currentParams
        setTimeout(() => {
          // Compare by value to handle reconstructed parameter objects
          if (JSON.stringify(pendingFinalCompileRef.current) === paramsKey) {
            pendingFinalCompileRef.current = null
            doCompile(currentParams, true)
          }
        }, 50)
      }
    })
  }, [])

  // Immediate compile - called on every parameter change
  const scheduleCompile = useCallback((newParams: ParameterValues) => {
    if (!hasCompiledOnceRef.current) return
    doCompile(newParams)
  }, [doCompile])

  // Initial compile when WASM is ready
  useEffect(() => {
    if (status === 'ready' && !hasCompiledOnceRef.current) {
      hasCompiledOnceRef.current = true
      doCompile(params)
    }
  // Intentionally omit `params` and `doCompile` from deps to prevent
  // re-triggering initial compile on every param change - only run once when status becomes 'ready'
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update params and compile immediately
  const handleParamChange = useCallback((name: string, value: number | string | boolean) => {
    setParams((prev) => {
      const newParams = { ...prev, [name]: value }
      scheduleCompile(newParams)
      return newParams
    })
  }, [scheduleCompile])

  // Reset parameters to defaults
  const handleReset = useCallback(() => {
    const defaultParams = getDefaultParams(selectedGenerator)
    setParams(defaultParams)
    if (hasCompiledOnceRef.current) {
      doCompile(defaultParams)
    }
  }, [selectedGenerator, doCompile])

  // Handler for when AI creates a new generator from an image
  const handleAiGeneratorCreated = useCallback((generator: Generator, defaultParams: ParameterValues) => {
    setSelectedGenerator(generator)
    setParams(defaultParams)
    generatorRef.current = generator
    if (hasCompiledOnceRef.current) {
      doCompile(defaultParams)
    }
  }, [doCompile])

  // Use the image-to-model hook
  // Note: We pass a dummy service when null - the applyToModel function won't be used in that case
  const dummyService = useMemo(() => ({
    analyzeImage: async () => ({ success: false, error: 'Service not available' }),
    isAnalyzing: () => false,
    cancelAnalysis: () => {}
  }), [])

  const { isApplying, applyToModel } = useImageToModel(
    imageToGeometryService ?? dummyService,
    handleAiGeneratorCreated
  )

  // Wrapper to pass current generator context to applyToModel
  const handleApplyToModel = useCallback((imageUrl: string, prompt: string) => {
    applyToModel(imageUrl, prompt, {
      builderCode: selectedGenerator.builderCode,
      params,
      name: selectedGenerator.name
    })
  }, [applyToModel, selectedGenerator.builderCode, selectedGenerator.name, params])

  const downloadBlob = (blob: Blob, filename: string) => {
    let url: string | null = null
    try {
      url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  }

  const handleDownload = () => {
    // Convert meshData or parts to STL
    if (parts && parts.length > 0) {
      // Combine all parts into a single mesh for STL export
      let totalPositions = 0
      let totalIndices = 0
      for (const part of parts) {
        totalPositions += part.meshData.positions.length
        totalIndices += part.meshData.indices.length
      }

      const combinedPositions = new Float32Array(totalPositions)
      const combinedNormals = new Float32Array(totalPositions)
      const combinedIndices = new Uint32Array(totalIndices)

      let posOffset = 0
      let idxOffset = 0
      let vertexOffset = 0

      for (const part of parts) {
        const { positions, normals, indices } = part.meshData
        combinedPositions.set(positions, posOffset)
        combinedNormals.set(normals, posOffset)

        // Offset indices by current vertex count
        for (let i = 0; i < indices.length; i++) {
          combinedIndices[idxOffset + i] = (indices[i] ?? 0) + vertexOffset
        }

        posOffset += positions.length
        idxOffset += indices.length
        vertexOffset += positions.length / 3
      }

      const stl = meshToStl({
        positions: combinedPositions,
        normals: combinedNormals,
        indices: combinedIndices
      })
      downloadBlob(stl, `${selectedGenerator.id}.stl`)
    } else if (meshData) {
      const stl = meshToStl(meshData)
      downloadBlob(stl, `${selectedGenerator.id}.stl`)
    }
  }

  return (
    <div className="flex h-screen relative">
      {/* Mobile menu button - left (Sidebar) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-gray-800 rounded-lg shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile menu button - right (DesignPanel) */}
      <button
        onClick={() => setDesignPanelOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-40 p-2 bg-gray-800 rounded-lg shadow-lg"
        aria-label="Open design panel"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {(sidebarOpen || designPanelOpen) && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => {
            setSidebarOpen(false)
            setDesignPanelOpen(false)
          }}
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          generators={generators}
          selectedGenerator={selectedGenerator}
          onGeneratorChange={handleGeneratorChange}
          params={params}
          onParamChange={handleParamChange}
          onDownload={handleDownload}
          onReset={handleReset}
          canDownload={(meshData !== null || (parts !== null && parts.length > 0)) && status === 'ready'}
        />
      </div>

      {/* Main content - Viewer */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <Suspense fallback={
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="text-gray-500">Loading 3D viewer...</div>
            </div>
          }>
            <Viewer
              meshData={meshData}
              parts={parts}
              isCompiling={status === 'building'}
              generatorId={selectedGenerator.id}
              boundingBox={boundingBox}
              displayDimensions={selectedGenerator.displayDimensions}
              params={params}
            />
          </Suspense>
        </div>
        <CompilerOutput
          output={null}
          status={status === 'building' ? 'compiling' : status}
          error={error}
        />
      </main>

      {/* DesignPanel - hidden on mobile unless open, always visible on desktop */}
      <div className={`
        ${designPanelOpen ? 'block' : 'hidden'} lg:block
        fixed lg:relative inset-y-0 right-0 z-50
        transform transition-transform duration-200 ease-in-out
        ${designPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <DesignPanel
          aiService={aiService}
          onApplyToModel={imageToGeometryService ? handleApplyToModel : undefined}
          isApplying={isApplying}
          sketchModel={sketchModel}
          geometryModel={geometryModel}
          onSketchModelChange={setSketchModel}
          onGeometryModelChange={setGeometryModel}
        />
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { Viewer } from './components/Viewer'
import { Sidebar } from './components/Sidebar'
import { CompilerOutput } from './components/CompilerOutput'
import { DownloadDialog } from './components/DownloadDialog'
import { useOpenSCAD } from './hooks/useOpenSCAD'
import { generators, flattenParameters, type ParameterValues, type GeneratorPart, type QualityLevel } from './generators'

const DEBOUNCE_MS = 1000

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

  // Initialize from URL or defaults
  const [selectedGenerator, setSelectedGenerator] = useState(() => {
    const urlState = getUrlState()
    if (urlState.generatorId) {
      const gen = generators.find(g => g.id === urlState.generatorId)
      if (gen) return gen
    }
    return initialGenerator
  })
  const [params, setParams] = useState<ParameterValues>(() => {
    const urlState = getUrlState()
    const gen = urlState.generatorId
      ? generators.find(g => g.id === urlState.generatorId) || initialGenerator
      : initialGenerator
    const defaults = getDefaultParams(gen)
    // Merge URL params with defaults (URL params override)
    return urlState.params ? { ...defaults, ...urlState.params } : defaults
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quality, setQuality] = useState<QualityLevel>('normal')

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

  const { status, error, compilerOutput, stlBlob, compile } = useOpenSCAD()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompiledOnceRef = useRef(false)
  const isCompilingRef = useRef(false)
  const pendingParamsRef = useRef<ParameterValues | null>(null)
  const isDraggingRef = useRef(false)

  // Use ref to always have latest compile function and generator without triggering effects
  const compileRef = useRef(compile)
  compileRef.current = compile
  const generatorRef = useRef(selectedGenerator)
  generatorRef.current = selectedGenerator

  // Use ref to always have latest quality without triggering effects
  const qualityRef = useRef(quality)
  qualityRef.current = quality

  // Track if we need a final-quality compile after draft preview
  const pendingFinalCompileRef = useRef<ParameterValues | null>(null)

  const doCompile = useCallback((currentParams: ParameterValues, isFinalPass = false) => {
    if (isCompilingRef.current) {
      // Queue the latest params to compile after current finishes
      pendingParamsRef.current = currentParams
      pendingFinalCompileRef.current = null // Cancel any pending final compile
      return
    }

    const targetQuality = qualityRef.current
    // Progressive rendering: compile draft first for quick preview, then final quality
    // Skip if already draft quality or if this is the final pass
    const useProgressiveRendering = !isFinalPass && targetQuality !== 'draft'
    const compileQuality = useProgressiveRendering ? 'draft' : targetQuality

    isCompilingRef.current = true
    pendingParamsRef.current = null

    // Pass quality via special _quality param
    const paramsWithQuality = { ...currentParams, _quality: compileQuality }
    const scadCode = generatorRef.current.scadTemplate(paramsWithQuality)

    // Final pass compiles silently in background
    compileRef.current(scadCode, { silent: isFinalPass }).finally(() => {
      isCompilingRef.current = false

      // If params changed while compiling, start over with new params
      if (pendingParamsRef.current) {
        const pending = pendingParamsRef.current
        pendingParamsRef.current = null
        pendingFinalCompileRef.current = null
        doCompile(pending)
        return
      }

      // If this was a draft preview, queue the final quality compile
      if (useProgressiveRendering) {
        pendingFinalCompileRef.current = currentParams
        // Small delay to let the preview render
        setTimeout(() => {
          if (pendingFinalCompileRef.current === currentParams) {
            pendingFinalCompileRef.current = null
            doCompile(currentParams, true) // Final pass at selected quality
          }
        }, 50)
      }
    })
  }, [])

  // Debounced compile - called explicitly, not via effect
  const scheduleCompile = useCallback((newParams: ParameterValues) => {
    if (!hasCompiledOnceRef.current) return
    if (isDraggingRef.current) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      doCompile(newParams)
    }, DEBOUNCE_MS)
  }, [doCompile])

  // Initial compile when WASM is ready
  useEffect(() => {
    if (status === 'ready' && !hasCompiledOnceRef.current) {
      hasCompiledOnceRef.current = true
      doCompile(params)
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // For non-slider inputs: update params and schedule debounced compile
  const handleParamChange = useCallback((name: string, value: number | string | boolean) => {
    setParams((prev) => {
      const newParams = { ...prev, [name]: value }
      scheduleCompile(newParams)
      return newParams
    })
  }, [scheduleCompile])

  // Slider drag start: just set flag (onChange will update UI but not compile)
  const handleSliderDragStart = useCallback(() => {
    isDraggingRef.current = true
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  // Slider drag end: clear flag
  const handleSliderDragEnd = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // Slider release: compile immediately with final value
  const handleParamCommit = useCallback((name: string, value: number | string | boolean) => {
    setParams((prev) => {
      const newParams = { ...prev, [name]: value }
      doCompile(newParams)
      return newParams
    })
  }, [doCompile])

  // Reset parameters to defaults
  const handleReset = useCallback(() => {
    const defaultParams = getDefaultParams(selectedGenerator)
    setParams(defaultParams)
    if (hasCompiledOnceRef.current) {
      doCompile(defaultParams)
    }
  }, [selectedGenerator, doCompile])

  // Quality change triggers immediate recompile
  const handleQualityChange = useCallback((newQuality: QualityLevel) => {
    setQuality(newQuality)
    qualityRef.current = newQuality
    if (hasCompiledOnceRef.current) {
      doCompile(params)
    }
  }, [doCompile, params])

  const [showDownloadDialog, setShowDownloadDialog] = useState(false)

  // Check if model has downloadable parts (parts defined and relevant feature enabled)
  const getDownloadableParts = useCallback((): GeneratorPart[] => {
    if (!selectedGenerator.parts) return []
    // For box, only show parts if lid is included
    if (selectedGenerator.id === 'box' && !params['include_lid']) return []
    return selectedGenerator.parts
  }, [selectedGenerator, params])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadParts = async (partsToDownload: GeneratorPart[]) => {
    for (const part of partsToDownload) {
      const scadCode = part.scadTemplate(params)
      const blob = await compile(scadCode)
      if (blob) {
        downloadBlob(blob, `${selectedGenerator.id}-${part.id}.stl`)
      }
    }
    // Recompile combined model to restore viewer
    doCompile(params)
  }

  const handleDownload = () => {
    if (!stlBlob) return

    const parts = getDownloadableParts()
    if (parts.length === 0) {
      // No separate parts, download combined
      downloadBlob(stlBlob, `${selectedGenerator.id}.stl`)
    } else if (parts.length === 1) {
      // Single part, download directly without dialog
      downloadParts(parts)
    } else {
      // Multiple parts, show dialog
      setShowDownloadDialog(true)
    }
  }

  const handleDownloadSelected = (selectedParts: GeneratorPart[]) => {
    setShowDownloadDialog(false)
    downloadParts(selectedParts)
  }

  const downloadableParts = getDownloadableParts()

  return (
    <div className="flex h-screen relative">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-gray-800 rounded-lg shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          generators={generators}
          selectedGenerator={selectedGenerator}
          onGeneratorChange={handleGeneratorChange}
          params={params}
          onParamChange={handleParamChange}
          onParamCommit={handleParamCommit}
          onSliderDragStart={handleSliderDragStart}
          onSliderDragEnd={handleSliderDragEnd}
          onDownload={handleDownload}
          onReset={handleReset}
          canDownload={stlBlob !== null && status === 'ready'}
          quality={quality}
          onQualityChange={handleQualityChange}
        />
      </div>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <Viewer
            stlBlob={stlBlob}
            isCompiling={status === 'compiling'}
          />
        </div>
        <CompilerOutput output={compilerOutput} status={status} error={error} />
      </main>

      <DownloadDialog
        isOpen={showDownloadDialog}
        generatorName={selectedGenerator.name}
        parts={downloadableParts}
        onDownload={handleDownloadSelected}
        onClose={() => setShowDownloadDialog(false)}
      />
    </div>
  )
}

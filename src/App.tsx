import { useState, useEffect, useRef, useCallback } from 'react'
import { Viewer } from './components/Viewer'
import { Sidebar } from './components/Sidebar'
import { CompilerOutput } from './components/CompilerOutput'
import { useOpenSCAD } from './hooks/useOpenSCAD'
import { generators, flattenParameters, type ParameterValues } from './generators'

const DEBOUNCE_MS = 1000

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

  const [selectedGenerator, setSelectedGenerator] = useState(initialGenerator)
  const [params, setParams] = useState<ParameterValues>(() =>
    getDefaultParams(selectedGenerator)
  )

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

  const doCompile = useCallback((currentParams: ParameterValues) => {
    if (isCompilingRef.current) {
      // Queue the latest params to compile after current finishes
      pendingParamsRef.current = currentParams
      return
    }

    isCompilingRef.current = true
    pendingParamsRef.current = null
    const scadCode = generatorRef.current.scadTemplate(currentParams)
    compileRef.current(scadCode).finally(() => {
      isCompilingRef.current = false
      // If params changed while compiling, compile again with latest
      if (pendingParamsRef.current) {
        const pending = pendingParamsRef.current
        pendingParamsRef.current = null
        doCompile(pending)
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

  const handleDownload = () => {
    if (!stlBlob) return

    const url = URL.createObjectURL(stlBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedGenerator.id}.stl`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        generators={generators}
        selectedGenerator={selectedGenerator}
        onGeneratorChange={handleGeneratorChange}
        params={params}
        onParamChange={handleParamChange}
        onParamCommit={handleParamCommit}
        onSliderDragStart={handleSliderDragStart}
        onSliderDragEnd={handleSliderDragEnd}
        status={status}
        error={error}
        onDownload={handleDownload}
        canDownload={stlBlob !== null && status === 'ready'}
      />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <Viewer
            stlBlob={stlBlob}
            isCompiling={status === 'compiling'}
          />
        </div>
        <CompilerOutput output={compilerOutput} />
      </main>
    </div>
  )
}

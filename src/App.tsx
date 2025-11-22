import { useState, useEffect, useRef, useCallback } from 'react'
import { Viewer } from './components/Viewer'
import { Sidebar } from './components/Sidebar'
import { CompilerOutput } from './components/CompilerOutput'
import { useOpenSCAD } from './hooks/useOpenSCAD'
import { generators, flattenParameters, type ParameterValues } from './generators'

const DEBOUNCE_MS = 300

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
      setParams(getDefaultParams(gen))
    }
  }

  const { status, error, compilerOutput, stlBlob, compile } = useOpenSCAD()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompiledOnceRef = useRef(false)
  const isCompilingRef = useRef(false)
  const pendingParamsRef = useRef<ParameterValues | null>(null)

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

  // Initial compile when WASM is ready
  // Note: params and doCompile intentionally omitted from deps - we want to compile with
  // whatever params exist when status becomes 'ready', not re-trigger on every param change.
  // Subsequent param changes are handled by the debounced effect below.
  useEffect(() => {
    if (status === 'ready' && !hasCompiledOnceRef.current) {
      hasCompiledOnceRef.current = true
      doCompile(params)
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced compile on param change (only after initial compile)
  useEffect(() => {
    if (!hasCompiledOnceRef.current) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      doCompile(params)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [params, doCompile])

  const handleParamChange = (name: string, value: number | string | boolean) => {
    setParams((prev) => ({ ...prev, [name]: value }))
  }

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

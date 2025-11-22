import { useState, useEffect, useRef, useCallback } from 'react'
import { Viewer } from './components/Viewer'
import { Sidebar } from './components/Sidebar'
import { useOpenSCAD } from './hooks/useOpenSCAD'
import { generators, type ParameterValues } from './generators'

const DEBOUNCE_MS = 300

function getDefaultParams(generator: typeof generators[0]): ParameterValues {
  return generator.parameters.reduce((acc, param) => {
    acc[param.name] = param.default
    return acc
  }, {} as ParameterValues)
}

export default function App() {
  const [selectedGenerator] = useState(generators[0]!)
  const [params, setParams] = useState<ParameterValues>(() =>
    getDefaultParams(selectedGenerator)
  )

  const { status, error, stlBlob, compile } = useOpenSCAD()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompiledOnceRef = useRef(false)
  const isCompilingRef = useRef(false)

  // Use ref to always have latest compile function without triggering effects
  const compileRef = useRef(compile)
  compileRef.current = compile

  const doCompile = useCallback((currentParams: ParameterValues) => {
    if (isCompilingRef.current) return

    isCompilingRef.current = true
    const scadCode = selectedGenerator.scadTemplate(currentParams)
    compileRef.current(scadCode).finally(() => {
      isCompilingRef.current = false
    })
  }, [selectedGenerator])

  // Initial compile when WASM is ready
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

  const handleParamChange = (name: string, value: number) => {
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
        generator={selectedGenerator}
        params={params}
        onParamChange={handleParamChange}
        status={status}
        error={error}
        onDownload={handleDownload}
        canDownload={stlBlob !== null && status === 'ready'}
      />
      <main className="flex-1">
        <Viewer
          stlBlob={stlBlob}
          isCompiling={status === 'compiling'}
        />
      </main>
    </div>
  )
}

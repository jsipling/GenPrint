import { useState, useCallback, useRef, useEffect } from 'react'

export type CompileStatus = 'idle' | 'loading' | 'ready' | 'compiling' | 'error'

export interface UseOpenSCADReturn {
  status: CompileStatus
  error: string | null
  compilerOutput: string | null
  stlBlob: Blob | null
  compile: (scadCode: string) => Promise<Blob | null>
}

interface CompileResponse {
  type: 'compile-result'
  id: number
  success: boolean
  stlData?: Uint8Array
  output: string
  error?: string
}

interface ReadyMessage {
  type: 'ready'
}

type WorkerResponse = CompileResponse | ReadyMessage

// Shared worker instance
let worker: Worker | null = null
let workerReady = false
let workerReadyPromise: Promise<void> | null = null
let pendingCompiles = new Map<number, {
  resolve: (data: Uint8Array | null) => void
  reject: (error: Error) => void
  onOutput: (output: string) => void
  onError: (error: string) => void
}>()

function getWorker(): Promise<Worker> {
  if (worker && workerReady) {
    return Promise.resolve(worker)
  }

  if (workerReadyPromise) {
    return workerReadyPromise.then(() => worker!)
  }

  workerReadyPromise = new Promise((resolve, reject) => {
    // Vite handles worker imports with ?worker suffix
    worker = new Worker(
      new URL('../workers/openscad.worker.ts', import.meta.url),
      { type: 'module' }
    )

    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const { data } = event

      if (data.type === 'ready') {
        workerReady = true
        resolve()
        return
      }

      if (data.type === 'compile-result') {
        const pending = pendingCompiles.get(data.id)
        if (pending) {
          pendingCompiles.delete(data.id)

          if (data.output) {
            pending.onOutput(data.output)
          }

          if (data.success && data.stlData) {
            pending.resolve(data.stlData)
          } else {
            pending.onError(data.error || 'Compilation failed')
            pending.resolve(null)
          }
        }
      }
    }

    worker.onmessage = handleMessage

    worker.onerror = (err) => {
      console.error('[useOpenSCAD] Worker error:', err)
      reject(new Error('Worker failed to initialize'))
    }
  })

  return workerReadyPromise.then(() => worker!)
}

let compileIdCounter = 0

export function useOpenSCAD(): UseOpenSCADReturn {
  const [status, setStatus] = useState<CompileStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [compilerOutput, setCompilerOutput] = useState<string | null>(null)
  const [stlBlob, setStlBlob] = useState<Blob | null>(null)
  const currentCompileIdRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true

    setStatus('loading')
    getWorker()
      .then(() => {
        if (mounted) {
          setStatus('ready')
          if (import.meta.env.DEV) console.log('OpenSCAD worker ready')
        }
      })
      .catch((err) => {
        if (mounted) {
          if (import.meta.env.DEV) console.error('Failed to initialize worker:', err)
          setError(err instanceof Error ? err.message : 'Failed to load OpenSCAD')
          setStatus('error')
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const compile = useCallback(async (scadCode: string): Promise<Blob | null> => {
    const compileId = ++compileIdCounter
    currentCompileIdRef.current = compileId

    setStatus('compiling')
    setError(null)
    setCompilerOutput(null)

    try {
      const w = await getWorker()

      // Check if superseded while waiting for worker
      if (currentCompileIdRef.current !== compileId) {
        if (import.meta.env.DEV) console.log('Compile superseded, skipping')
        return null
      }

      if (import.meta.env.DEV) console.log('Sending compile request to worker...')

      const stlData = await new Promise<Uint8Array | null>((resolve, reject) => {
        pendingCompiles.set(compileId, {
          resolve,
          reject,
          onOutput: (output) => {
            if (currentCompileIdRef.current === compileId) {
              setCompilerOutput(output)
            }
          },
          onError: (err) => {
            if (currentCompileIdRef.current === compileId) {
              setError(err)
            }
          }
        })

        w.postMessage({
          type: 'compile',
          id: compileId,
          code: scadCode
        })
      })

      // Check if superseded during compilation
      if (currentCompileIdRef.current !== compileId) {
        if (import.meta.env.DEV) console.log('Compile superseded after completion, skipping')
        return null
      }

      if (!stlData) {
        setStatus('error')
        return null
      }

      if (import.meta.env.DEV) console.log('STL generated, size:', stlData.length)

      const blob = new Blob([stlData], { type: 'application/sla' })
      setStlBlob(blob)
      setStatus('ready')
      return blob

    } catch (err) {
      if (currentCompileIdRef.current === compileId) {
        if (import.meta.env.DEV) console.error('Compilation error:', err)
        setError(err instanceof Error ? err.message : 'Compilation failed')
        setStatus('error')
      }
      return null
    }
  }, [])

  return { status, error, compilerOutput, stlBlob, compile }
}

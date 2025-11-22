import { useState, useCallback, useRef, useEffect } from 'react'

export type CompileStatus = 'idle' | 'loading' | 'ready' | 'compiling' | 'error'

/**
 * Simple hash function for cache keys (djb2 algorithm).
 * Fast and sufficient for cache keying purposes.
 */
function hashCode(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

interface CacheEntry {
  stlData: Uint8Array
  output: string
  timestamp: number
}

const MAX_CACHE_SIZE = 20
const stlCache = new Map<string, CacheEntry>()

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

interface PendingCompile {
  resolve: (data: Uint8Array | null) => void
  reject: (error: Error) => void
  onOutput: (output: string) => void
  onError: (error: string) => void
}

/**
 * Singleton manager for the OpenSCAD Web Worker.
 *
 * Uses singleton pattern because:
 * 1. WASM loading is expensive - we want to load it once
 * 2. Worker instances should be reused across components
 * 3. Multiple workers would waste memory
 *
 * For testing, call OpenSCADWorkerManager.reset() between tests.
 */
class OpenSCADWorkerManager {
  private static instance: OpenSCADWorkerManager | null = null

  private worker: Worker | null = null
  private workerReady = false
  private workerReadyPromise: Promise<void> | null = null
  private pendingCompiles = new Map<number, PendingCompile>()
  private compileIdCounter = 0

  private constructor() {}

  static getInstance(): OpenSCADWorkerManager {
    if (!OpenSCADWorkerManager.instance) {
      OpenSCADWorkerManager.instance = new OpenSCADWorkerManager()
    }
    return OpenSCADWorkerManager.instance
  }

  /**
   * Reset the singleton for testing purposes.
   * Terminates any existing worker and clears all state.
   */
  static reset(): void {
    if (OpenSCADWorkerManager.instance) {
      OpenSCADWorkerManager.instance.terminate()
      OpenSCADWorkerManager.instance = null
    }
    stlCache.clear()
  }

  private terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.workerReady = false
    this.workerReadyPromise = null
    this.pendingCompiles.clear()
    this.compileIdCounter = 0
  }

  getWorker(): Promise<Worker> {
    if (this.worker && this.workerReady) {
      return Promise.resolve(this.worker)
    }

    if (this.workerReadyPromise) {
      return this.workerReadyPromise.then(() => this.worker!)
    }

    this.workerReadyPromise = new Promise((resolve, reject) => {
      // Vite handles worker imports with ?worker suffix
      this.worker = new Worker(
        new URL('../workers/openscad.worker.ts', import.meta.url),
        { type: 'module' }
      )

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { data } = event

        if (data.type === 'ready') {
          this.workerReady = true
          resolve()
          return
        }

        if (data.type === 'compile-result') {
          const pending = this.pendingCompiles.get(data.id)
          if (pending) {
            this.pendingCompiles.delete(data.id)

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

      this.worker.onmessage = handleMessage

      this.worker.onerror = (err) => {
        console.error('[useOpenSCAD] Worker error:', err)
        reject(new Error('Worker failed to initialize'))
      }
    })

    return this.workerReadyPromise.then(() => this.worker!)
  }

  getNextCompileId(): number {
    return ++this.compileIdCounter
  }

  registerCompile(id: number, handlers: PendingCompile): void {
    this.pendingCompiles.set(id, handlers)
  }
}

export function useOpenSCAD(): UseOpenSCADReturn {
  const [status, setStatus] = useState<CompileStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [compilerOutput, setCompilerOutput] = useState<string | null>(null)
  const [stlBlob, setStlBlob] = useState<Blob | null>(null)
  const currentCompileIdRef = useRef<number | null>(null)
  const managerRef = useRef(OpenSCADWorkerManager.getInstance())

  useEffect(() => {
    let mounted = true

    setStatus('loading')
    managerRef.current.getWorker()
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
    const manager = managerRef.current
    const compileId = manager.getNextCompileId()
    currentCompileIdRef.current = compileId

    // Check cache first
    const cacheKey = hashCode(scadCode)
    const cached = stlCache.get(cacheKey)
    if (cached) {
      if (import.meta.env.DEV) console.log('Cache hit, returning cached STL')
      // Update timestamp for LRU
      cached.timestamp = Date.now()
      setCompilerOutput(cached.output)
      const blob = new Blob([cached.stlData], { type: 'model/stl' })
      setStlBlob(blob)
      setStatus('ready')
      return blob
    }

    setStatus('compiling')
    setError(null)
    setCompilerOutput(null)

    try {
      const w = await manager.getWorker()

      // Check if superseded while waiting for worker
      if (currentCompileIdRef.current !== compileId) {
        if (import.meta.env.DEV) console.log('Compile superseded, skipping')
        return null
      }

      if (import.meta.env.DEV) console.log('Cache miss, compiling...')

      let capturedOutput = ''
      const stlData = await new Promise<Uint8Array | null>((resolve, reject) => {
        manager.registerCompile(compileId, {
          resolve,
          reject,
          onOutput: (output) => {
            capturedOutput = output
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

      // Store in cache with LRU eviction
      if (stlCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entry
        let oldestKey: string | null = null
        let oldestTime = Infinity
        for (const [key, entry] of stlCache) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp
            oldestKey = key
          }
        }
        if (oldestKey) stlCache.delete(oldestKey)
      }
      stlCache.set(cacheKey, {
        stlData: stlData.slice(), // Copy to avoid transfer issues
        output: capturedOutput,
        timestamp: Date.now()
      })

      const blob = new Blob([stlData], { type: 'model/stl' })
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

// Export for testing purposes
export { OpenSCADWorkerManager }

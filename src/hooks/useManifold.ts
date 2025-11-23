import { useState, useCallback, useRef, useEffect } from 'react'
import type { MeshData, ParameterValues } from '../generators'

export type ManifoldStatus = 'idle' | 'loading' | 'ready' | 'building' | 'error'

/**
 * Simple hash function for cache keys (djb2 algorithm).
 */
function hashCode(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

interface CacheEntry {
  meshData: MeshData
  timestamp: number
}

const MAX_CACHE_SIZE = 20
const meshCache = new Map<string, CacheEntry>()

export interface BuildOptions {
  /** If true, don't show building status - runs silently in background */
  silent?: boolean
  /** Circle segment quality (higher = smoother, slower). Default 48. */
  circularSegments?: number
}

export interface UseManifoldReturn {
  status: ManifoldStatus
  error: string | null
  meshData: MeshData | null
  timing: number | null
  build: (generatorId: string, params: ParameterValues, options?: BuildOptions) => Promise<MeshData | null>
}

interface BuildRequest {
  type: 'build'
  id: number
  generatorId: string
  params: ParameterValues
  circularSegments: number
}

interface BuildResponse {
  type: 'build-result'
  id: number
  success: boolean
  meshData?: MeshData
  error?: string
  timing?: number
}

interface ReadyMessage {
  type: 'ready'
}

type WorkerResponse = BuildResponse | ReadyMessage

interface PendingBuild {
  resolve: (data: MeshData | null) => void
  reject: (error: Error) => void
  onTiming: (timing: number) => void
  onError: (error: string) => void
}

/**
 * Singleton manager for the Manifold Web Worker.
 */
class ManifoldWorkerManager {
  private static instance: ManifoldWorkerManager | null = null

  private worker: Worker | null = null
  private workerReady = false
  private workerReadyPromise: Promise<void> | null = null
  private pendingBuilds = new Map<number, PendingBuild>()
  private buildIdCounter = 0

  private constructor() {}

  static getInstance(): ManifoldWorkerManager {
    if (!ManifoldWorkerManager.instance) {
      ManifoldWorkerManager.instance = new ManifoldWorkerManager()
    }
    return ManifoldWorkerManager.instance
  }

  /**
   * Reset the singleton for testing purposes.
   */
  static reset(): void {
    if (ManifoldWorkerManager.instance) {
      ManifoldWorkerManager.instance.terminate()
      ManifoldWorkerManager.instance = null
    }
    meshCache.clear()
  }

  private terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.workerReady = false
    this.workerReadyPromise = null
    this.pendingBuilds.clear()
    this.buildIdCounter = 0
  }

  getWorker(): Promise<Worker> {
    if (this.worker && this.workerReady) {
      return Promise.resolve(this.worker)
    }

    if (this.workerReadyPromise) {
      return this.workerReadyPromise.then(() => this.worker!)
    }

    this.workerReadyPromise = new Promise((resolve, reject) => {
      this.worker = new Worker(
        new URL('../workers/manifold.worker.ts', import.meta.url),
        { type: 'module' }
      )

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { data } = event

        if (data.type === 'ready') {
          this.workerReady = true
          resolve()
          return
        }

        if (data.type === 'build-result') {
          const pending = this.pendingBuilds.get(data.id)
          if (pending) {
            this.pendingBuilds.delete(data.id)

            if (data.timing !== undefined) {
              pending.onTiming(data.timing)
            }

            if (data.success && data.meshData) {
              pending.resolve(data.meshData)
            } else {
              pending.onError(data.error || 'Build failed')
              pending.resolve(null)
            }
          }
        }
      }

      this.worker.onmessage = handleMessage

      this.worker.onerror = (err) => {
        console.error('[useManifold] Worker error:', err)
        reject(new Error('Worker failed to initialize'))
      }
    })

    return this.workerReadyPromise.then(() => this.worker!)
  }

  getNextBuildId(): number {
    return ++this.buildIdCounter
  }

  registerBuild(id: number, handlers: PendingBuild): void {
    this.pendingBuilds.set(id, handlers)
  }
}

export function useManifold(): UseManifoldReturn {
  const [status, setStatus] = useState<ManifoldStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [meshData, setMeshData] = useState<MeshData | null>(null)
  const [timing, setTiming] = useState<number | null>(null)
  const currentBuildIdRef = useRef<number | null>(null)
  const managerRef = useRef(ManifoldWorkerManager.getInstance())

  useEffect(() => {
    let mounted = true

    setStatus('loading')
    managerRef.current.getWorker()
      .then(() => {
        if (mounted) {
          setStatus('ready')
          if (import.meta.env.DEV) console.log('Manifold worker ready')
        }
      })
      .catch((err) => {
        if (mounted) {
          if (import.meta.env.DEV) console.error('Failed to initialize manifold worker:', err)
          setError(err instanceof Error ? err.message : 'Failed to load Manifold')
          setStatus('error')
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const build = useCallback(async (
    generatorId: string,
    params: ParameterValues,
    options?: BuildOptions
  ): Promise<MeshData | null> => {
    const silent = options?.silent ?? false
    const circularSegments = options?.circularSegments ?? 48
    const manager = managerRef.current
    const buildId = manager.getNextBuildId()
    currentBuildIdRef.current = buildId

    // Check cache first
    const cacheKey = hashCode(JSON.stringify({ generatorId, params, circularSegments }))
    const cached = meshCache.get(cacheKey)
    if (cached) {
      if (import.meta.env.DEV) console.log('Manifold cache hit')
      cached.timestamp = Date.now()
      setMeshData(cached.meshData)
      if (!silent) setStatus('ready')
      return cached.meshData
    }

    if (!silent) {
      setStatus('building')
      setError(null)
    }

    try {
      const w = await manager.getWorker()

      // Check if superseded while waiting
      if (currentBuildIdRef.current !== buildId) {
        if (import.meta.env.DEV) console.log('Build superseded, skipping')
        return null
      }

      if (import.meta.env.DEV) console.log('Manifold cache miss, building...')

      const result = await new Promise<MeshData | null>((resolve, reject) => {
        manager.registerBuild(buildId, {
          resolve,
          reject,
          onTiming: (t) => {
            if (currentBuildIdRef.current === buildId) {
              setTiming(t)
            }
          },
          onError: (err) => {
            if (currentBuildIdRef.current === buildId) {
              setError(err)
            }
          }
        })

        const request: BuildRequest = {
          type: 'build',
          id: buildId,
          generatorId,
          params,
          circularSegments
        }
        w.postMessage(request)
      })

      // Check if superseded during build
      if (currentBuildIdRef.current !== buildId) {
        if (import.meta.env.DEV) console.log('Build superseded after completion')
        return null
      }

      if (!result) {
        if (!silent) setStatus('error')
        return null
      }

      if (import.meta.env.DEV) {
        console.log('Manifold build complete, vertices:', result.positions.length / 3)
      }

      // Store in cache with LRU eviction
      if (meshCache.size >= MAX_CACHE_SIZE) {
        let oldestKey: string | null = null
        let oldestTime = Infinity
        for (const [key, entry] of meshCache) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp
            oldestKey = key
          }
        }
        if (oldestKey) meshCache.delete(oldestKey)
      }
      meshCache.set(cacheKey, { meshData: result, timestamp: Date.now() })

      setMeshData(result)
      if (!silent) setStatus('ready')
      return result

    } catch (err) {
      if (currentBuildIdRef.current === buildId) {
        if (import.meta.env.DEV) console.error('Build error:', err)
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Build failed')
          setStatus('error')
        }
      }
      return null
    }
  }, [])

  return { status, error, meshData, timing, build }
}

// Export for testing
export { ManifoldWorkerManager }

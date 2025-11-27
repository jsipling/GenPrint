import { useState, useCallback, useRef, useEffect } from 'react'
import type { MeshData, ParameterValues, BoundingBox } from '../generators'
import type { BuildRequest, WorkerResponse } from '../workers/types'

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
  boundingBox: BoundingBox
}

export const MAX_CACHE_SIZE = 20
const meshCache = new Map<string, CacheEntry>()

/**
 * Get the mesh cache for testing purposes.
 */
export function getMeshCache(): Map<string, CacheEntry> {
  return meshCache
}

export interface BuildOptions {
  /** If true, don't show building status - runs silently in background */
  silent?: boolean
  /** Circle segment quality (higher = smoother, slower). Default 48. */
  circularSegments?: number
  /** Timeout in ms. Default 30000 (30s). Set to 0 for no timeout. */
  timeout?: number
}

export const DEFAULT_BUILD_TIMEOUT = 30000

export interface UseManifoldReturn {
  status: ManifoldStatus
  error: string | null
  meshData: MeshData | null
  boundingBox: BoundingBox | null
  timing: number | null
  build: (builderCode: string, params: ParameterValues, options?: BuildOptions) => Promise<{ meshData: MeshData; boundingBox: BoundingBox } | null>
}

interface BuildResult {
  meshData: MeshData
  boundingBox: BoundingBox
}

interface PendingBuild {
  resolve: (data: BuildResult | null) => void
  reject: (error: Error) => void
  onTiming: (timing: number) => void
  onError: (error: string) => void
  timeoutId?: ReturnType<typeof setTimeout>
}

interface RegisterBuildOptions {
  timeout?: number
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

        if (data.type === 'init-error') {
          reject(new Error(data.error))
          return
        }

        if (data.type === 'build-result') {
          const pending = this.pendingBuilds.get(data.id)
          if (pending) {
            // Clear timeout before resolving/rejecting
            if (pending.timeoutId) {
              clearTimeout(pending.timeoutId)
            }
            this.pendingBuilds.delete(data.id)

            if (data.timing !== undefined) {
              pending.onTiming(data.timing)
            }

            if (data.success && data.meshData && data.boundingBox) {
              pending.resolve({ meshData: data.meshData, boundingBox: data.boundingBox })
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

        // Reject all pending builds (clear timeouts first)
        for (const pending of this.pendingBuilds.values()) {
          if (pending.timeoutId) clearTimeout(pending.timeoutId)
          pending.reject(new Error('Worker crashed'))
        }
        this.pendingBuilds.clear()

        // Reset worker state to allow recovery
        this.worker = null
        this.workerReady = false
        this.workerReadyPromise = null

        reject(new Error('Worker failed to initialize'))
      }
    })

    return this.workerReadyPromise.then(() => this.worker!)
  }

  getNextBuildId(): number {
    return ++this.buildIdCounter
  }

  registerBuild(id: number, handlers: Omit<PendingBuild, 'timeoutId'>, options?: RegisterBuildOptions): void {
    const timeout = options?.timeout
    const pendingBuild: PendingBuild = { ...handlers }

    // Set up timeout if specified and not 0
    if (timeout !== undefined && timeout > 0) {
      pendingBuild.timeoutId = setTimeout(() => {
        this.unregisterBuild(id)
        handlers.reject(new Error('Build timed out'))
      }, timeout)
    }

    this.pendingBuilds.set(id, pendingBuild)
  }

  unregisterBuild(id: number): void {
    const pending = this.pendingBuilds.get(id)
    if (pending?.timeoutId) {
      clearTimeout(pending.timeoutId)
    }
    this.pendingBuilds.delete(id)
  }

  /**
   * Check if a build is pending (for testing purposes).
   */
  hasPendingBuild(id: number): boolean {
    return this.pendingBuilds.has(id)
  }
}

export function useManifold(): UseManifoldReturn {
  const [status, setStatus] = useState<ManifoldStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [meshData, setMeshData] = useState<MeshData | null>(null)
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null)
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
    builderCode: string,
    params: ParameterValues,
    options?: BuildOptions
  ): Promise<BuildResult | null> => {
    const silent = options?.silent ?? false
    const circularSegments = options?.circularSegments ?? 48
    const manager = managerRef.current
    const buildId = manager.getNextBuildId()
    currentBuildIdRef.current = buildId

    // Check cache first (hash the builderCode for cache key)
    const cacheKey = hashCode(`${builderCode}:${circularSegments}:${JSON.stringify(params)}`)
    const cached = meshCache.get(cacheKey)
    if (cached) {
      if (import.meta.env.DEV) console.log('Manifold cache hit')
      // Move to end of Map (most recently used)
      meshCache.delete(cacheKey)
      meshCache.set(cacheKey, cached)
      setMeshData(cached.meshData)
      setBoundingBox(cached.boundingBox)
      if (!silent) setStatus('ready')
      return { meshData: cached.meshData, boundingBox: cached.boundingBox }
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
        manager.unregisterBuild(buildId)
        return null
      }

      if (import.meta.env.DEV) console.log('Manifold cache miss, building...')

      const result = await new Promise<BuildResult | null>((resolve, reject) => {
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
        }, { timeout: options?.timeout ?? DEFAULT_BUILD_TIMEOUT })

        const request: BuildRequest = {
          type: 'build',
          id: buildId,
          builderCode,
          params,
          circularSegments
        }
        w.postMessage(request)
      })

      // Check if superseded during build
      if (currentBuildIdRef.current !== buildId) {
        if (import.meta.env.DEV) console.log('Build superseded after completion')
        manager.unregisterBuild(buildId)
        return null
      }

      if (!result) {
        if (!silent) setStatus('error')
        return null
      }

      if (import.meta.env.DEV) {
        console.log('Manifold build complete, vertices:', result.meshData.positions.length / 3)
      }

      // LRU eviction: Map maintains insertion order, first key is oldest
      if (meshCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = meshCache.keys().next().value
        if (oldestKey) meshCache.delete(oldestKey)
      }
      meshCache.set(cacheKey, { meshData: result.meshData, boundingBox: result.boundingBox })

      setMeshData(result.meshData)
      setBoundingBox(result.boundingBox)
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

  return { status, error, meshData, boundingBox, timing, build }
}

// Export for testing
export { ManifoldWorkerManager }

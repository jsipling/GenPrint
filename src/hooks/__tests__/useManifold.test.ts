import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManifoldWorkerManager, DEFAULT_BUILD_TIMEOUT, getMeshCache, MAX_CACHE_SIZE } from '../useManifold'

/**
 * Mock Worker class for testing worker crash recovery
 */
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((error: ErrorEvent) => void) | null = null

  postMessage = vi.fn()
  terminate = vi.fn()

  // Test helper to simulate worker crash
  simulateCrash() {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { message: 'Worker crashed' }))
    }
  }

  // Test helper to simulate worker ready
  simulateReady() {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: { type: 'ready' } }))
    }
  }
}

// Store instances for test access
let mockWorkerInstances: MockWorker[] = []

describe('ManifoldWorkerManager', () => {
  beforeEach(() => {
    // Reset the singleton before each test
    ManifoldWorkerManager.reset()
    mockWorkerInstances = []

    // Mock the Worker constructor as a class
    vi.stubGlobal('Worker', class {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((error: ErrorEvent) => void) | null = null
      postMessage = vi.fn()
      terminate = vi.fn()

      constructor() {
        // Store reference so tests can access it
        const instance = this as unknown as MockWorker
        // Add helper methods
        ;(instance as MockWorker).simulateCrash = function() {
          if (this.onerror) {
            // Create a plain object that mimics ErrorEvent since ErrorEvent is not available in jsdom
            this.onerror({ message: 'Worker crashed', type: 'error' } as unknown as ErrorEvent)
          }
        }
        ;(instance as MockWorker).simulateReady = function() {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: { type: 'ready' } }))
          }
        }
        mockWorkerInstances.push(instance as MockWorker)
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    ManifoldWorkerManager.reset()
  })

  describe('worker crash recovery', () => {
    it('rejects all pending builds when worker crashes', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Start getting the worker (this creates the worker and sets up handlers)
      const workerPromise = manager.getWorker()

      // Get the mock worker instance that was created
      const mockWorker = mockWorkerInstances[0]!

      // Simulate the worker becoming ready
      mockWorker.simulateReady()
      await workerPromise

      // Register some pending builds
      const build1 = new Promise<unknown>((resolve, reject) => {
        manager.registerBuild(manager.getNextBuildId(), {
          resolve: resolve as (data: unknown) => void,
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        })
      })

      const build2 = new Promise<unknown>((resolve, reject) => {
        manager.registerBuild(manager.getNextBuildId(), {
          resolve: resolve as (data: unknown) => void,
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        })
      })

      // Simulate worker crash
      mockWorker.simulateCrash()

      // Both pending builds should be rejected with 'Worker crashed'
      await expect(build1).rejects.toThrow('Worker crashed')
      await expect(build2).rejects.toThrow('Worker crashed')
    })

    it('resets worker state after crash to allow recovery', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const firstMockWorker = mockWorkerInstances[0]!
      firstMockWorker.simulateReady()
      await workerPromise

      // Simulate worker crash
      firstMockWorker.simulateCrash()

      // Getting the worker again should create a new instance
      const newWorkerPromise = manager.getWorker()

      // Wait for the new worker to be created
      await new Promise(resolve => setTimeout(resolve, 0))

      const secondMockWorker = mockWorkerInstances[1]!
      secondMockWorker.simulateReady()

      // Should resolve with the new worker
      const worker = await newWorkerPromise
      expect(worker).toBe(secondMockWorker)

      // Two Worker instances should have been created (original + recovery)
      expect(mockWorkerInstances.length).toBe(2)
    })
  })

  describe('superseded build cleanup', () => {
    it('cleans up superseded builds from pendingBuilds Map', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const mockWorker = mockWorkerInstances[0]!
      mockWorker.simulateReady()
      await workerPromise

      // Register a build that will be "superseded"
      const buildId1 = manager.getNextBuildId()
      manager.registerBuild(buildId1, {
        resolve: vi.fn(),
        reject: vi.fn(),
        onTiming: vi.fn(),
        onError: vi.fn()
      })

      // Verify build is in pending map
      expect(manager.hasPendingBuild(buildId1)).toBe(true)

      // Simulate supersession by unregistering the build
      // (this is what the build function should do when superseded)
      manager.unregisterBuild(buildId1)

      // Verify build was cleaned up
      expect(manager.hasPendingBuild(buildId1)).toBe(false)
    })

    it('clears timeout when superseded build is cleaned up', async () => {
      vi.useFakeTimers()

      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const mockWorker = mockWorkerInstances[0]!
      mockWorker.simulateReady()
      await workerPromise

      // Register a build with timeout that will be "superseded"
      const buildId1 = manager.getNextBuildId()
      const rejectFn = vi.fn()
      manager.registerBuild(buildId1, {
        resolve: vi.fn(),
        reject: rejectFn,
        onTiming: vi.fn(),
        onError: vi.fn()
      }, { timeout: 1000 })

      // Verify build is in pending map
      expect(manager.hasPendingBuild(buildId1)).toBe(true)

      // Simulate supersession cleanup
      manager.unregisterBuild(buildId1)

      // Verify build was cleaned up
      expect(manager.hasPendingBuild(buildId1)).toBe(false)

      // Advance time past the original timeout
      await vi.advanceTimersByTimeAsync(2000)

      // Reject should NOT have been called (timeout was cleared)
      expect(rejectFn).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('build timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects build after timeout expires', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const mockWorker = mockWorkerInstances[0]!
      mockWorker.simulateReady()
      await workerPromise

      // Register a build with timeout
      const buildId = manager.getNextBuildId()
      const buildPromise = new Promise<unknown>((resolve, reject) => {
        manager.registerBuild(buildId, {
          resolve: resolve as (data: unknown) => void,
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        }, { timeout: 1000 })
      })

      // Advance time past the timeout
      vi.advanceTimersByTime(1001)

      // Build should be rejected with timeout error
      await expect(buildPromise).rejects.toThrow('Build timed out')
    })

    it('clears timeout when build completes successfully', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const mockWorker = mockWorkerInstances[0]!
      mockWorker.simulateReady()
      await workerPromise

      // Register a build with timeout
      const buildId = manager.getNextBuildId()
      const buildPromise = new Promise<unknown>((resolve, reject) => {
        manager.registerBuild(buildId, {
          resolve,
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        }, { timeout: 1000 })
      })

      // Simulate successful build response before timeout
      mockWorker.onmessage!(new MessageEvent('message', {
        data: {
          type: 'build-result',
          id: buildId,
          success: true,
          meshData: { positions: new Float32Array([]), normals: new Float32Array([]), indices: new Uint32Array([]) }
        }
      }))

      // Build should resolve successfully
      const result = await buildPromise
      expect(result).toBeDefined()

      // Advance time past the timeout - should not throw since timeout was cleared
      await vi.advanceTimersByTimeAsync(2000)
    })

    it('uses default timeout of 30 seconds', () => {
      expect(DEFAULT_BUILD_TIMEOUT).toBe(30000)
    })

    it('does not timeout when timeout is set to 0', async () => {
      const manager = ManifoldWorkerManager.getInstance()

      // Get worker and wait for ready
      const workerPromise = manager.getWorker()
      const mockWorker = mockWorkerInstances[0]!
      mockWorker.simulateReady()
      await workerPromise

      // Register a build with timeout disabled
      const buildId = manager.getNextBuildId()
      let resolved = false
      const buildPromise = new Promise<unknown>((resolve, reject) => {
        manager.registerBuild(buildId, {
          resolve: (data) => { resolved = true; resolve(data) },
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        }, { timeout: 0 })
      })

      // Advance time way past any reasonable timeout
      await vi.advanceTimersByTimeAsync(60000)

      // Build should still be pending (not rejected)
      expect(resolved).toBe(false)

      // Complete the build manually
      mockWorker.onmessage!(new MessageEvent('message', {
        data: {
          type: 'build-result',
          id: buildId,
          success: true,
          meshData: { positions: new Float32Array([]), normals: new Float32Array([]), indices: new Uint32Array([]) }
        }
      }))

      const result = await buildPromise
      expect(result).toBeDefined()
    })
  })

  describe('LRU cache using Map insertion order', () => {
    const createMockMeshData = (id: number) => ({
      positions: new Float32Array([id]),
      normals: new Float32Array([id]),
      indices: new Uint32Array([id])
    })

    beforeEach(() => {
      // Ensure cache is cleared before each test
      ManifoldWorkerManager.reset()
    })

    it('moves accessed item to end of Map (most recently used)', () => {
      const cache = getMeshCache()

      // Add items in order: key1, key2, key3
      cache.set('key1', { meshData: createMockMeshData(1) })
      cache.set('key2', { meshData: createMockMeshData(2) })
      cache.set('key3', { meshData: createMockMeshData(3) })

      // Initial order should be: key1, key2, key3
      const initialKeys = Array.from(cache.keys())
      expect(initialKeys).toEqual(['key1', 'key2', 'key3'])

      // Simulate cache hit on key1 - delete and re-add to move to end
      const entry = cache.get('key1')
      cache.delete('key1')
      cache.set('key1', entry!)

      // Order should now be: key2, key3, key1 (key1 moved to end)
      const updatedKeys = Array.from(cache.keys())
      expect(updatedKeys).toEqual(['key2', 'key3', 'key1'])
    })

    it('evicts oldest (first) item when cache is full using O(1) operation', () => {
      const cache = getMeshCache()

      // Fill cache to MAX_CACHE_SIZE
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        cache.set(`key${i}`, { meshData: createMockMeshData(i) })
      }
      expect(cache.size).toBe(MAX_CACHE_SIZE)

      // Verify first key is key0 (the oldest)
      const firstKey = cache.keys().next().value
      expect(firstKey).toBe('key0')

      // Simulate LRU eviction for new entry
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value
        if (oldestKey) cache.delete(oldestKey)
      }
      cache.set('newKey', { meshData: createMockMeshData(999) })

      // Cache should still be at MAX_CACHE_SIZE
      expect(cache.size).toBe(MAX_CACHE_SIZE)

      // key0 should be gone, newKey should exist
      expect(cache.has('key0')).toBe(false)
      expect(cache.has('newKey')).toBe(true)

      // First key should now be key1
      const newFirstKey = cache.keys().next().value
      expect(newFirstKey).toBe('key1')
    })

    it('CacheEntry should not have timestamp property', () => {
      const cache = getMeshCache()

      cache.set('testKey', { meshData: createMockMeshData(1) })
      const entry = cache.get('testKey')

      // Entry should only have meshData, no timestamp
      expect(entry).toBeDefined()
      expect(entry!.meshData).toBeDefined()
      expect('timestamp' in entry!).toBe(false)
    })
  })
})

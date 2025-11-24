import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ManifoldWorkerManager } from '../useManifold'

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
      const mockWorker = mockWorkerInstances[0]

      // Simulate the worker becoming ready
      mockWorker.simulateReady()
      await workerPromise

      // Register some pending builds
      const build1 = new Promise<null>((resolve, reject) => {
        manager.registerBuild(manager.getNextBuildId(), {
          resolve,
          reject,
          onTiming: vi.fn(),
          onError: vi.fn()
        })
      })

      const build2 = new Promise<null>((resolve, reject) => {
        manager.registerBuild(manager.getNextBuildId(), {
          resolve,
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
      const firstMockWorker = mockWorkerInstances[0]
      firstMockWorker.simulateReady()
      await workerPromise

      // Simulate worker crash
      firstMockWorker.simulateCrash()

      // Getting the worker again should create a new instance
      const newWorkerPromise = manager.getWorker()

      // Wait for the new worker to be created
      await new Promise(resolve => setTimeout(resolve, 0))

      const secondMockWorker = mockWorkerInstances[1]
      secondMockWorker.simulateReady()

      // Should resolve with the new worker
      const worker = await newWorkerPromise
      expect(worker).toBe(secondMockWorker)

      // Two Worker instances should have been created (original + recovery)
      expect(mockWorkerInstances.length).toBe(2)
    })
  })
})

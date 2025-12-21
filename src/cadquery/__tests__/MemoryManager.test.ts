import { describe, it, expect, vi } from 'vitest'
import { MemoryManager } from '../MemoryManager'

describe('MemoryManager', () => {
  // Create mock Manifold objects
  const createMockManifold = () => ({
    delete: vi.fn()
  })

  describe('track', () => {
    it('should track a manifold object', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      expect(manager.count).toBe(1)
    })

    it('should track multiple manifold objects', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      const mock3 = createMockManifold()
      manager.track(mock1 as any)
      manager.track(mock2 as any)
      manager.track(mock3 as any)
      expect(manager.count).toBe(3)
    })

    it('should not duplicate tracked objects in the set', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      manager.track(mock as any)
      expect(manager.count).toBe(1)
    })
  })

  describe('isTracked', () => {
    it('should return true for tracked objects', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      expect(manager.isTracked(mock as any)).toBe(true)
    })

    it('should return false for untracked objects', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      manager.track(mock1 as any)
      expect(manager.isTracked(mock2 as any)).toBe(false)
    })

    it('should return false for released objects', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      manager.release(mock as any)
      expect(manager.isTracked(mock as any)).toBe(false)
    })
  })

  describe('release', () => {
    it('should release and delete a tracked object', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      manager.release(mock as any)
      expect(mock.delete).toHaveBeenCalled()
      expect(manager.count).toBe(0)
    })

    it('should not delete an untracked object', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.release(mock as any)
      expect(mock.delete).not.toHaveBeenCalled()
    })

    it('should decrement count after release', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      manager.track(mock1 as any)
      manager.track(mock2 as any)
      expect(manager.count).toBe(2)
      manager.release(mock1 as any)
      expect(manager.count).toBe(1)
    })

    it('should call delete method only once per release', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      manager.release(mock as any)
      manager.release(mock as any)
      expect(mock.delete).toHaveBeenCalledTimes(1)
    })
  })

  describe('releaseAll', () => {
    it('should release all tracked objects', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      manager.track(mock1 as any)
      manager.track(mock2 as any)
      manager.releaseAll()
      expect(mock1.delete).toHaveBeenCalled()
      expect(mock2.delete).toHaveBeenCalled()
      expect(manager.count).toBe(0)
    })

    it('should handle empty manager', () => {
      const manager = new MemoryManager()
      expect(() => manager.releaseAll()).not.toThrow()
      expect(manager.count).toBe(0)
    })

    it('should call delete on all objects exactly once', () => {
      const manager = new MemoryManager()
      const mocks = [createMockManifold(), createMockManifold(), createMockManifold()]
      mocks.forEach(m => manager.track(m as any))
      manager.releaseAll()
      mocks.forEach(m => expect(m.delete).toHaveBeenCalledTimes(1))
    })

    it('should clear the tracked set completely', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      manager.track(mock1 as any)
      manager.track(mock2 as any)
      manager.releaseAll()
      expect(manager.isTracked(mock1 as any)).toBe(false)
      expect(manager.isTracked(mock2 as any)).toBe(false)
      expect(manager.count).toBe(0)
    })
  })

  describe('releaseAllExcept', () => {
    it('should keep specified object and release others', () => {
      const manager = new MemoryManager()
      const keep = createMockManifold()
      const release = createMockManifold()
      manager.track(keep as any)
      manager.track(release as any)
      manager.releaseAllExcept(keep as any)
      expect(keep.delete).not.toHaveBeenCalled()
      expect(release.delete).toHaveBeenCalled()
      expect(manager.count).toBe(1)
    })

    it('should maintain the kept object as tracked', () => {
      const manager = new MemoryManager()
      const keep = createMockManifold()
      const release = createMockManifold()
      manager.track(keep as any)
      manager.track(release as any)
      manager.releaseAllExcept(keep as any)
      expect(manager.isTracked(keep as any)).toBe(true)
    })

    it('should remove all other objects from tracked set', () => {
      const manager = new MemoryManager()
      const keep = createMockManifold()
      const release1 = createMockManifold()
      const release2 = createMockManifold()
      manager.track(keep as any)
      manager.track(release1 as any)
      manager.track(release2 as any)
      manager.releaseAllExcept(keep as any)
      expect(manager.count).toBe(1)
      expect(manager.isTracked(release1 as any)).toBe(false)
      expect(manager.isTracked(release2 as any)).toBe(false)
    })

    it('should handle case where kept object is the only tracked object', () => {
      const manager = new MemoryManager()
      const keep = createMockManifold()
      manager.track(keep as any)
      manager.releaseAllExcept(keep as any)
      expect(keep.delete).not.toHaveBeenCalled()
      expect(manager.count).toBe(1)
      expect(manager.isTracked(keep as any)).toBe(true)
    })

    it('should call delete on all released objects', () => {
      const manager = new MemoryManager()
      const keep = createMockManifold()
      const mocks = [createMockManifold(), createMockManifold(), createMockManifold()]
      manager.track(keep as any)
      mocks.forEach(m => manager.track(m as any))
      manager.releaseAllExcept(keep as any)
      mocks.forEach(m => expect(m.delete).toHaveBeenCalledTimes(1))
    })
  })

  describe('count property', () => {
    it('should return 0 for empty manager', () => {
      const manager = new MemoryManager()
      expect(manager.count).toBe(0)
    })

    it('should accurately reflect the number of tracked objects', () => {
      const manager = new MemoryManager()
      expect(manager.count).toBe(0)
      const mock1 = createMockManifold()
      manager.track(mock1 as any)
      expect(manager.count).toBe(1)
      const mock2 = createMockManifold()
      manager.track(mock2 as any)
      expect(manager.count).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complex lifecycle: track, release some, release all', () => {
      const manager = new MemoryManager()
      const mock1 = createMockManifold()
      const mock2 = createMockManifold()
      const mock3 = createMockManifold()

      manager.track(mock1 as any)
      manager.track(mock2 as any)
      manager.track(mock3 as any)
      expect(manager.count).toBe(3)

      manager.release(mock1 as any)
      expect(manager.count).toBe(2)

      manager.releaseAll()
      expect(manager.count).toBe(0)
      expect(mock1.delete).toHaveBeenCalledTimes(1)
      expect(mock2.delete).toHaveBeenCalledTimes(1)
      expect(mock3.delete).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple release calls gracefully', () => {
      const manager = new MemoryManager()
      const mock = createMockManifold()
      manager.track(mock as any)
      manager.release(mock as any)
      manager.release(mock as any)
      manager.release(mock as any)
      expect(mock.delete).toHaveBeenCalledTimes(1)
    })
  })
})

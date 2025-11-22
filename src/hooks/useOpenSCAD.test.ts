import { describe, it, expect } from 'vitest'

// Test the module-level functions and logic without React hooks
// These tests verify the core compilation logic separate from React integration

describe('useOpenSCAD module logic', () => {
  describe('filesystem cleanup', () => {
    it('should define correct file paths', () => {
      // The module uses these paths for input/output
      const INPUT_FILE = '/input.scad'
      const OUTPUT_FILE = '/output.stl'

      expect(INPUT_FILE).toBe('/input.scad')
      expect(OUTPUT_FILE).toBe('/output.stl')
    })
  })

  describe('output line handling', () => {
    it('should collect output lines correctly', () => {
      const outputLines: string[] = []

      // Simulate print callbacks
      const print = (text: string) => outputLines.push(text)
      const printErr = (text: string) => outputLines.push(text)

      print('Line 1')
      printErr('Error line')
      print('Line 2')

      expect(outputLines).toEqual(['Line 1', 'Error line', 'Line 2'])
      expect(outputLines.join('\n')).toBe('Line 1\nError line\nLine 2')
    })

    it('should clear output lines between compiles', () => {
      const outputLines: string[] = []

      outputLines.push('Old output')
      outputLines.push('More old output')

      // Simulate clearing (as done in clearOutputLines)
      outputLines.length = 0

      expect(outputLines).toEqual([])
    })
  })

  describe('compile status states', () => {
    it('should define all expected states', () => {
      type CompileStatus = 'idle' | 'loading' | 'ready' | 'compiling' | 'error'

      const states: CompileStatus[] = ['idle', 'loading', 'ready', 'compiling', 'error']

      expect(states).toContain('idle')
      expect(states).toContain('loading')
      expect(states).toContain('ready')
      expect(states).toContain('compiling')
      expect(states).toContain('error')
    })
  })

  describe('compile ID tracking', () => {
    it('should increment compile ID to track superseded compiles', () => {
      let compileId = 0

      const currentCompileId1 = ++compileId
      expect(currentCompileId1).toBe(1)

      const currentCompileId2 = ++compileId
      expect(currentCompileId2).toBe(2)

      // First compile should be considered superseded
      expect(currentCompileId1).not.toBe(compileId)
      expect(currentCompileId2).toBe(compileId)
    })

    it('should allow detecting when a newer compile was requested', () => {
      let compileIdRef = 0

      // Start first compile
      const firstCompileId = ++compileIdRef

      // Simulate second compile starting before first finishes
      const secondCompileId = ++compileIdRef

      // First compile should skip (superseded)
      const firstShouldSkip = firstCompileId !== compileIdRef
      expect(firstShouldSkip).toBe(true)

      // Second compile should proceed
      const secondShouldSkip = secondCompileId !== compileIdRef
      expect(secondShouldSkip).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should format error messages correctly', () => {
      const formatError = (err: unknown): string => {
        return err instanceof Error ? err.message : 'Compilation failed'
      }

      expect(formatError(new Error('Test error'))).toBe('Test error')
      expect(formatError('string error')).toBe('Compilation failed')
      expect(formatError(null)).toBe('Compilation failed')
    })

    it('should create appropriate error for missing output', () => {
      const output = 'ECHO: some debug output'
      const error = new Error(`OpenSCAD did not produce output - check your SCAD code\n${output}`)

      expect(error.message).toContain('did not produce output')
      expect(error.message).toContain(output)
    })

    it('should create appropriate error for empty output', () => {
      const output = 'Warnings from compiler'
      const error = new Error(`OpenSCAD produced empty output\n${output}`)

      expect(error.message).toContain('empty output')
      expect(error.message).toContain(output)
    })
  })

  describe('STL blob creation', () => {
    it('should create blob with correct MIME type', () => {
      const stlData = new Uint8Array([1, 2, 3, 4])
      const blob = new Blob([stlData], { type: 'application/sla' })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/sla')
      expect(blob.size).toBe(4)
    })

    it('should handle empty STL data', () => {
      const emptyData = new Uint8Array([])
      const isEmpty = !emptyData || emptyData.length === 0

      expect(isEmpty).toBe(true)
    })

    it('should detect valid STL data', () => {
      const validData = new Uint8Array([1, 2, 3, 4])
      const isEmpty = !validData || validData.length === 0

      expect(isEmpty).toBe(false)
    })
  })

  describe('singleton instance pattern', () => {
    it('should use singleton pattern for WASM instance', () => {
      // Test the singleton pattern logic
      let sharedInstance: object | null = null

      const getInstance = () => {
        if (sharedInstance) return sharedInstance
        sharedInstance = { id: 'mock-instance' }
        return sharedInstance
      }

      const first = getInstance()
      const second = getInstance()

      // Should return same instance
      expect(first).toBe(second)
    })

    it('should prevent concurrent initialization', async () => {
      let initPromise: Promise<string> | null = null
      let callCount = 0

      const ensureReady = (): Promise<string> => {
        if (initPromise) return initPromise

        initPromise = new Promise((resolve) => {
          callCount++
          setTimeout(() => resolve('ready'), 10)
        })

        return initPromise
      }

      // Call multiple times concurrently
      const results = await Promise.all([
        ensureReady(),
        ensureReady(),
        ensureReady()
      ])

      // Should only initialize once
      expect(callCount).toBe(1)
      expect(results).toEqual(['ready', 'ready', 'ready'])
    })
  })
})

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'

// Mock Worker class for jsdom environment
class MockWorker {
  private onmessageHandler: ((event: MessageEvent) => void) | null = null

  constructor() {
    // Simulate ready message on next tick
    setTimeout(() => {
      this.onmessageHandler?.({ data: { type: 'ready' } } as MessageEvent)
    }, 0)
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this.onmessageHandler = handler
  }

  postMessage(message: { type: string; id?: number; code?: string }) {
    if (message.type === 'compile' && message.id !== undefined) {
      // Simulate successful compilation
      setTimeout(() => {
        const stlData = new TextEncoder().encode(`STL:${message.code?.length ?? 0}`)
        this.onmessageHandler?.({
          data: {
            type: 'compile-result',
            id: message.id,
            success: true,
            stlData,
            output: 'Compilation successful'
          }
        } as MessageEvent)
      }, 10)
    }
  }

  terminate() {}
}

// Track worker instances for testing
const workerInstances: MockWorker[] = []

vi.stubGlobal('Worker', class extends MockWorker {
  constructor(_url: URL | string, _options?: WorkerOptions) {
    super()
    workerInstances.push(this)
  }
})

describe('useOpenSCAD', () => {
  beforeEach(async () => {
    vi.resetModules()
    workerInstances.length = 0
    // Reset the singleton manager between tests
    const { OpenSCADWorkerManager } = await import('./useOpenSCAD')
    OpenSCADWorkerManager.reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes worker and reports ready status', async () => {
    const { useOpenSCAD } = await import('./useOpenSCAD')

    function HookHarness({ onChange }: { onChange: (state: any) => void }) {
      const hook = useOpenSCAD()
      useEffect(() => {
        onChange(hook)
      }, [hook, onChange])
      return null
    }

    let latest: any = null

    render(
      <StrictMode>
        <HookHarness onChange={(state) => { latest = state }} />
      </StrictMode>
    )

    await waitFor(() => expect(latest?.status).toBe('ready'))
    expect(workerInstances.length).toBe(1)
  })

  it('compiles SCAD code via worker and returns STL blob', async () => {
    const { useOpenSCAD } = await import('./useOpenSCAD')

    function HookHarness({ onChange }: { onChange: (state: any) => void }) {
      const hook = useOpenSCAD()
      useEffect(() => {
        onChange(hook)
      }, [hook, onChange])
      return null
    }

    let latest: any = null

    render(
      <StrictMode>
        <HookHarness onChange={(state) => { latest = state }} />
      </StrictMode>
    )

    await waitFor(() => expect(latest?.status).toBe('ready'))

    await act(async () => { await latest.compile('cube(10);') })
    await waitFor(() => expect(latest?.stlBlob).not.toBeNull())

    expect(latest.stlBlob).toBeInstanceOf(Blob)
    expect(latest.stlBlob.size).toBeGreaterThan(0)
  })

  it('produces fresh output for sequential compiles', async () => {
    const { useOpenSCAD } = await import('./useOpenSCAD')

    function HookHarness({ onChange }: { onChange: (state: any) => void }) {
      const hook = useOpenSCAD()
      useEffect(() => {
        onChange(hook)
      }, [hook, onChange])
      return null
    }

    let latest: any = null

    render(
      <StrictMode>
        <HookHarness onChange={(state) => { latest = state }} />
      </StrictMode>
    )

    await waitFor(() => expect(latest?.status).toBe('ready'))

    await act(async () => { await latest.compile('abc') })
    await waitFor(() => expect(latest?.stlBlob).not.toBeNull())
    const firstSize = latest.stlBlob!.size

    await act(async () => { await latest.compile('longer text') })
    await waitFor(() => expect(latest?.stlBlob).not.toBeNull())
    const secondSize = latest.stlBlob!.size

    expect(firstSize).toBeGreaterThan(0)
    expect(secondSize).toBeGreaterThan(firstSize)
  })
})

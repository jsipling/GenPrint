import { useState, useCallback, useRef, useEffect } from 'react'
import { createOpenSCAD } from 'openscad-wasm'
import type { OpenSCAD } from 'openscad-wasm'

export type CompileStatus = 'idle' | 'loading' | 'ready' | 'compiling' | 'error'

export interface UseOpenSCADReturn {
  status: CompileStatus
  error: string | null
  compilerOutput: string | null
  stlBlob: Blob | null
  compile: (scadCode: string) => Promise<Blob | null>
}

// Track if the module is ready (loaded at least once)
let moduleReady = false
let initPromise: Promise<void> | null = null

async function ensureModuleReady(): Promise<void> {
  if (moduleReady) return

  if (initPromise) return initPromise

  initPromise = (async () => {
    // Load once to ensure WASM is cached by browser
    const wrapper = await createOpenSCAD()
    wrapper.getInstance() // Just to verify it works
    moduleReady = true
  })()

  return initPromise
}

interface InstanceWithOutput {
  instance: OpenSCAD
  getOutput: () => string
}

async function createFreshInstance(): Promise<InstanceWithOutput> {
  const outputLines: string[] = []
  const wrapper = await createOpenSCAD({
    print: (text: string) => outputLines.push(text),
    printErr: (text: string) => outputLines.push(text)
  })
  return {
    instance: wrapper.getInstance(),
    getOutput: () => outputLines.join('\n')
  }
}

export function useOpenSCAD(): UseOpenSCADReturn {
  const [status, setStatus] = useState<CompileStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [compilerOutput, setCompilerOutput] = useState<string | null>(null)
  const [stlBlob, setStlBlob] = useState<Blob | null>(null)
  const compileIdRef = useRef(0)

  useEffect(() => {
    let mounted = true

    setStatus('loading')
    ensureModuleReady()
      .then(() => {
        if (mounted) {
          setStatus('ready')
          if (import.meta.env.DEV) console.log('OpenSCAD WASM module ready')
        }
      })
      .catch((err) => {
        if (mounted) {
          if (import.meta.env.DEV) console.error('Failed to load OpenSCAD:', err)
          setError(err instanceof Error ? err.message : 'Failed to load OpenSCAD')
          setStatus('error')
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const compile = useCallback(async (scadCode: string): Promise<Blob | null> => {
    if (!moduleReady) {
      setError('OpenSCAD not loaded')
      return null
    }

    // Increment compile ID to track this specific compilation
    const currentCompileId = ++compileIdRef.current

    setStatus('compiling')
    setError(null)
    setCompilerOutput(null)

    let instanceWithOutput: InstanceWithOutput | null = null

    try {
      // Create a fresh instance for each compilation
      if (import.meta.env.DEV) console.log('Creating fresh OpenSCAD instance...')
      instanceWithOutput = await createFreshInstance()
      const { instance, getOutput } = instanceWithOutput

      // Check if a newer compile was requested while we were creating the instance
      if (currentCompileId !== compileIdRef.current) {
        if (import.meta.env.DEV) console.log('Compile superseded, skipping')
        return null
      }

      const inputFile = '/input.scad'
      const outputFile = '/output.stl'

      // Write the SCAD code to virtual filesystem
      instance.FS.writeFile(inputFile, scadCode)
      if (import.meta.env.DEV) console.log('SCAD code written, compiling...')

      // Run OpenSCAD - it throws on exit but still produces output
      try {
        instance.callMain([inputFile, '-o', outputFile])
      } catch {
        // Expected - OpenSCAD throws on exit
      }

      // Capture compiler output
      const output = getOutput()
      if (output) {
        setCompilerOutput(output)
      }

      // Check again if superseded
      if (currentCompileId !== compileIdRef.current) {
        if (import.meta.env.DEV) console.log('Compile superseded after callMain, skipping')
        return null
      }

      // Read the output file as binary (OpenSCAD can emit binary or ASCII STL)
      let stlData: Uint8Array
      try {
        stlData = instance.FS.readFile(outputFile) as Uint8Array
      } catch (readError) {
        if (import.meta.env.DEV) console.error('Failed to read STL output:', readError)
        throw new Error(`OpenSCAD did not produce output - check your SCAD code\n${output}`)
      }

      if (!stlData || stlData.length === 0) {
        throw new Error(`OpenSCAD produced empty output\n${output}`)
      }

      if (import.meta.env.DEV) console.log('STL generated, size:', stlData.length)

      const blob = new Blob([stlData], { type: 'application/sla' })
      setStlBlob(blob)
      setStatus('ready')
      return blob
    } catch (err) {
      // Only set error if this is still the current compile
      if (currentCompileId === compileIdRef.current) {
        if (import.meta.env.DEV) console.error('Compilation error:', err)
        const message = err instanceof Error ? err.message : 'Compilation failed'
        // Include compiler output in error if available
        const output = instanceWithOutput?.getOutput()
        if (output) {
          setCompilerOutput(output)
        }
        setError(message)
        setStatus('error')
      }
      return null
    }
  }, [])

  return { status, error, compilerOutput, stlBlob, compile }
}

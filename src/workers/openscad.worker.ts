import { createOpenSCAD } from 'openscad-wasm'

interface CompileRequest {
  type: 'compile'
  id: number
  code: string
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

type WorkerMessage = CompileRequest

const INPUT_FILE = '/input.scad'
const OUTPUT_FILE = '/output.stl'

// Verify WASM loads on worker startup
createOpenSCAD()
  .then(() => {
    const msg: ReadyMessage = { type: 'ready' }
    postMessage(msg)
  })
  .catch((err) => {
    console.error('[Worker] Failed to load OpenSCAD:', err)
  })

onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { data } = event

  if (data.type === 'compile') {
    const { id, code } = data
    const outputLines: string[] = []

    try {
      // Fresh instance per compile (OpenSCAD WASM limitation)
      const wrapper = await createOpenSCAD({
        print: (text: string) => outputLines.push(text),
        printErr: (text: string) => outputLines.push(text)
      })
      const instance = wrapper.getInstance()

      instance.FS.writeFile(INPUT_FILE, code)

      // Run OpenSCAD - throws on exit but produces output
      // OpenSCAD WASM always throws when callMain completes (expected behavior)
      try {
        instance.callMain([INPUT_FILE, '-o', OUTPUT_FILE])
      } catch (exitError) {
        // OpenSCAD exits with code 0 on success, non-zero on actual errors
        // The exit itself throws, but we check the output file to determine success
        if (import.meta.env?.DEV) {
          console.debug('[Worker] OpenSCAD exit (expected):', exitError)
        }
      }

      const output = outputLines
        .filter(line => !line.includes('Could not initialize localization'))
        .join('\n')

      let stlData: Uint8Array
      try {
        stlData = instance.FS.readFile(OUTPUT_FILE) as Uint8Array
      } catch {
        const response: CompileResponse = {
          type: 'compile-result',
          id,
          success: false,
          output,
          error: `OpenSCAD did not produce output - check your SCAD code\n${output}`
        }
        postMessage(response)
        return
      }

      if (!stlData || stlData.length === 0) {
        const response: CompileResponse = {
          type: 'compile-result',
          id,
          success: false,
          output,
          error: `OpenSCAD produced empty output\n${output}`
        }
        postMessage(response)
        return
      }

      const response: CompileResponse = {
        type: 'compile-result',
        id,
        success: true,
        stlData,
        output
      }
      // Transfer the buffer to avoid copying
      postMessage(response, { transfer: [stlData.buffer as ArrayBuffer] })

    } catch (err) {
      const response: CompileResponse = {
        type: 'compile-result',
        id,
        success: false,
        output: outputLines.join('\n'),
        error: err instanceof Error ? err.message : 'Compilation failed'
      }
      postMessage(response)
    }
  }
}

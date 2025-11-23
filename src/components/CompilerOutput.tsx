import { useState } from 'react'

export type CompileStatus = 'idle' | 'loading' | 'compiling' | 'ready' | 'error'

function getLineStyle(line: string): string {
  const trimmed = line.trim().toUpperCase()
  if (trimmed.startsWith('ERROR:') || trimmed.startsWith('ERROR ')) {
    return 'text-red-400'
  }
  if (trimmed.startsWith('WARNING:') || trimmed.startsWith('WARNING ')) {
    return 'text-yellow-400'
  }
  if (trimmed.startsWith('ECHO:') || trimmed.startsWith('ECHO ')) {
    return 'text-cyan-400'
  }
  return 'text-gray-400'
}

function getStatusText(status: CompileStatus): string {
  switch (status) {
    case 'idle': return 'Idle'
    case 'loading': return 'Loading WASM...'
    case 'compiling': return 'Building...'
    case 'ready': return 'Ready'
    case 'error': return 'Error'
  }
}

function getStatusColor(status: CompileStatus): string {
  switch (status) {
    case 'idle': return 'text-gray-500'
    case 'loading': return 'text-yellow-400'
    case 'compiling': return 'text-blue-400'
    case 'ready': return 'text-green-400'
    case 'error': return 'text-red-400'
  }
}

interface CompilerOutputProps {
  output: string | null
  status: CompileStatus
  error: string | null
}

export function CompilerOutput({ output, status, error }: CompilerOutputProps) {
  // In development mode, show output expanded by default
  const [expanded, setExpanded] = useState(import.meta.env.DEV)

  const lines = output ? output.split('\n') : []
  const statusText = getStatusText(status)

  return (
    <div className="bg-gray-900 border-t border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors"
        aria-expanded={expanded}
        aria-controls="compiler-output"
      >
        <svg
          className="w-4 h-4 transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">Status</span>
        {statusText && (
          <>
            <span className="text-gray-600">-</span>
            <span className={getStatusColor(status)} role="status" aria-live="polite">
              {statusText}
            </span>
          </>
        )}
        {error && (
          <span className="text-red-400 text-xs truncate max-w-xs" role="alert">
            {error}
          </span>
        )}
      </button>
      {expanded && (
        <div
          id="compiler-output"
          data-testid="compiler-output"
          className="px-4 pb-3 max-h-48 overflow-auto font-mono text-xs"
        >
          {lines.map((line, index) => (
            <div key={index} className={getLineStyle(line)}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'

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

interface CompilerOutputProps {
  output: string | null
}

export function CompilerOutput({ output }: CompilerOutputProps) {
  // In development mode, show output expanded by default
  const [expanded, setExpanded] = useState(import.meta.env.DEV)

  if (!output) return null

  const lines = output.split('\n')

  return (
    <div className="bg-gray-900 border-t border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors"
        aria-expanded={expanded}
        aria-controls="compiler-output"
      >
        <span className="transform transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        <span className="font-medium">Compiler Output</span>
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

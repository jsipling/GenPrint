import type { Generator, ParameterValues, NumberParameterDef, StringParameterDef } from '../generators'
import type { CompileStatus } from '../hooks/useOpenSCAD'

interface SidebarProps {
  generators: Generator[]
  selectedGenerator: Generator
  onGeneratorChange: (id: string) => void
  params: ParameterValues
  onParamChange: (name: string, value: number | string) => void
  status: CompileStatus
  error: string | null
  onDownload: () => void
  canDownload: boolean
}

function StatusBadge({ status, error }: { status: CompileStatus; error: string | null }) {
  const badges: Record<CompileStatus, { text: string; className: string }> = {
    idle: { text: 'Idle', className: 'bg-gray-600' },
    loading: { text: 'Loading WASM...', className: 'bg-yellow-600' },
    ready: { text: 'Ready', className: 'bg-green-600' },
    compiling: { text: 'Compiling...', className: 'bg-blue-600' },
    error: { text: 'Error', className: 'bg-red-600' }
  }

  const badge = badges[status]

  return (
    <div className="space-y-1">
      <span className={`inline-block px-2 py-1 text-xs rounded ${badge.className}`}>
        {badge.text}
      </span>
      {error && (
        <p className="text-xs text-red-400 break-words">{error}</p>
      )}
    </div>
  )
}

export function Sidebar({
  generators,
  selectedGenerator,
  onGeneratorChange,
  params,
  onParamChange,
  status,
  error,
  onDownload,
  canDownload
}: SidebarProps) {
  return (
    <aside className="w-72 bg-gray-800 text-white p-4 flex flex-col h-full overflow-y-auto">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-blue-400">GenPrint</h1>
        <p className="text-sm text-gray-400 mt-1">Parametric 3D Model Generator</p>
      </header>

      <div className="mb-4">
        <StatusBadge status={status} error={error} />
      </div>

      <section className="mb-4">
        <label htmlFor="generator-select" className="block text-sm mb-1">Model</label>
        <select
          id="generator-select"
          value={selectedGenerator.id}
          onChange={(e) => onGeneratorChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
        >
          {generators.map((gen) => (
            <option key={gen.id} value={gen.id}>{gen.name}</option>
          ))}
        </select>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-1">{selectedGenerator.name}</h2>
        <p className="text-sm text-gray-400 mb-4">{selectedGenerator.description}</p>

        <div className="space-y-4">
          {selectedGenerator.parameters.map((param) => {
            const value = params[param.name] ?? param.default

            if (param.type === 'string') {
              const stringParam = param as StringParameterDef
              return (
                <div key={param.name}>
                  <label htmlFor={param.name} className="block text-sm mb-1">
                    {param.label}
                  </label>
                  <input
                    type="text"
                    id={param.name}
                    value={String(value)}
                    maxLength={stringParam.maxLength}
                    onChange={(e) => onParamChange(param.name, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                  />
                </div>
              )
            }

            const numParam = param as NumberParameterDef
            const numValue = Number(value)
            return (
              <div key={param.name}>
                <div className="flex justify-between text-sm mb-1">
                  <label htmlFor={param.name}>{param.label}</label>
                  <span className="text-gray-400">
                    {numValue}{numParam.unit ? ` ${numParam.unit}` : ''}
                  </span>
                </div>
                <input
                  type="range"
                  id={param.name}
                  min={numParam.min}
                  max={numParam.max}
                  step={numParam.step ?? 1}
                  value={numValue}
                  onChange={(e) => onParamChange(param.name, parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{numParam.min}</span>
                  <span>{numParam.max}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
        >
          Download STL
        </button>
      </div>
    </aside>
  )
}

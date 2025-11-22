import { useState } from 'react'
import type { Generator, ParameterValues, ParameterDef } from '../generators'
import { isStringParam, isSelectParam, isBooleanParam } from '../generators'
import type { CompileStatus } from '../hooks/useOpenSCAD'

interface SidebarProps {
  generators: Generator[]
  selectedGenerator: Generator
  onGeneratorChange: (id: string) => void
  params: ParameterValues
  onParamChange: (name: string, value: number | string | boolean) => void
  status: CompileStatus
  error: string | null
  compilerOutput: string | null
  onDownload: () => void
  canDownload: boolean
}

function CompilerOutput({ output }: { output: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
        aria-expanded={expanded}
        aria-controls="compiler-output"
      >
        <span className="transform transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        Compiler Output
      </button>
      {expanded && (
        <pre
          id="compiler-output"
          className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-auto max-h-32 whitespace-pre-wrap break-words"
        >
          {output}
        </pre>
      )}
    </div>
  )
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
    <div className="space-y-1" role="status" aria-live="polite">
      <span className={`inline-block px-2 py-1 text-xs rounded ${badge.className}`}>
        {badge.text}
      </span>
      {error && (
        <p className="text-xs text-red-400 break-words" role="alert">{error}</p>
      )}
    </div>
  )
}

interface ParameterInputProps {
  param: ParameterDef
  params: ParameterValues
  onParamChange: (name: string, value: number | string | boolean) => void
  depth?: number
}

function ParameterInput({ param, params, onParamChange, depth = 0 }: ParameterInputProps) {
  const value = params[param.name] ?? param.default

  if (isStringParam(param)) {
    return (
      <div className={depth > 0 ? 'ml-6 pl-3 border-l border-gray-600' : ''}>
        <label htmlFor={param.name} className="block text-sm mb-1">
          {param.label}
        </label>
        <input
          type="text"
          id={param.name}
          value={String(value)}
          maxLength={param.maxLength}
          onChange={(e) => onParamChange(param.name, e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
        />
      </div>
    )
  }

  if (isSelectParam(param)) {
    return (
      <div className={depth > 0 ? 'ml-6 pl-3 border-l border-gray-600' : ''}>
        <label htmlFor={param.name} className="block text-sm mb-1">
          {param.label}
        </label>
        <select
          id={param.name}
          value={String(value)}
          onChange={(e) => onParamChange(param.name, e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
        >
          {param.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    )
  }

  if (isBooleanParam(param)) {
    const checked = Boolean(value)
    const hasChildren = param.children && param.children.length > 0

    // Nested child params get left border styling
    if (depth > 0) {
      return (
        <div className="ml-6 pl-3 border-l border-gray-600">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={param.name}
              checked={checked}
              onChange={(e) => onParamChange(param.name, e.target.checked)}
              className="w-4 h-4 bg-gray-700 rounded border border-gray-600 focus:ring-blue-500 accent-blue-500"
            />
            <label htmlFor={param.name} className="text-sm">
              {param.label}
            </label>
          </div>
          {hasChildren && checked && (
            <div className="mt-3 space-y-3">
              {param.children!.map((child) => (
                <ParameterInput
                  key={child.name}
                  param={child}
                  params={params}
                  onParamChange={onParamChange}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    // Top-level booleans with children get a container to group the feature
    if (hasChildren) {
      return (
        <div className="p-3 bg-gray-700/50 rounded border border-gray-600">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={param.name}
              checked={checked}
              onChange={(e) => onParamChange(param.name, e.target.checked)}
              className="w-4 h-4 bg-gray-700 rounded border border-gray-600 focus:ring-blue-500 accent-blue-500"
            />
            <label htmlFor={param.name} className="text-sm font-medium">
              {param.label}
            </label>
          </div>
          {checked && (
            <div className="mt-3 space-y-3 pl-3 border-l border-gray-500">
              {param.children!.map((child) => (
                <ParameterInput
                  key={child.name}
                  param={child}
                  params={params}
                  onParamChange={onParamChange}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    // Top-level booleans without children render normally
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={param.name}
          checked={checked}
          onChange={(e) => onParamChange(param.name, e.target.checked)}
          className="w-4 h-4 bg-gray-700 rounded border border-gray-600 focus:ring-blue-500 accent-blue-500"
        />
        <label htmlFor={param.name} className="text-sm">
          {param.label}
        </label>
      </div>
    )
  }

  // TypeScript now knows param is NumberParameterDef
  const numValue = Number(value)
  const valueText = `${numValue}${param.unit ? ` ${param.unit}` : ''}`
  return (
    <div className={depth > 0 ? 'ml-6 pl-3 border-l border-gray-600' : ''}>
      <div className="flex justify-between text-sm mb-1">
        <label htmlFor={param.name}>{param.label}</label>
        <span className="text-gray-400" aria-hidden="true">
          {valueText}
        </span>
      </div>
      <input
        type="range"
        id={param.name}
        min={param.min}
        max={param.max}
        step={param.step ?? 1}
        value={numValue}
        onChange={(e) => onParamChange(param.name, parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        aria-valuemin={param.min}
        aria-valuemax={param.max}
        aria-valuenow={numValue}
        aria-valuetext={valueText}
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1" aria-hidden="true">
        <span>{param.min}</span>
        <span>{param.max}</span>
      </div>
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
  compilerOutput,
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
        {compilerOutput && (
          <CompilerOutput output={compilerOutput} />
        )}
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
          {/* Sort parameters: main options first, feature toggles (booleans with children) last */}
          {[...selectedGenerator.parameters]
            .sort((a, b) => {
              const aHasChildren = isBooleanParam(a) && a.children && a.children.length > 0
              const bHasChildren = isBooleanParam(b) && b.children && b.children.length > 0
              if (aHasChildren && !bHasChildren) return 1
              if (!aHasChildren && bHasChildren) return -1
              return 0
            })
            .map((param) => (
              <ParameterInput
                key={param.name}
                param={param}
                params={params}
                onParamChange={onParamChange}
              />
            ))}
        </div>
      </section>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
          aria-label={canDownload ? `Download ${selectedGenerator.name} as STL file` : 'Download not available - model not ready'}
        >
          Download STL
        </button>
      </div>
    </aside>
  )
}

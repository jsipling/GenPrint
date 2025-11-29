import { useEffect, useMemo } from 'react'
import type { Generator, ParameterValues, ParameterDef } from '../generators'
import { isStringParam, isSelectParam, isBooleanParam } from '../generators'

interface SidebarProps {
  generators: Generator[]
  selectedGenerator: Generator
  onGeneratorChange: (id: string) => void
  params: ParameterValues
  onParamChange: (name: string, value: number | string | boolean) => void
  onDownload: () => void
  onReset: () => void
  canDownload: boolean
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
        {param.description && (
          <p className="text-xs text-gray-400 mb-1">{param.description}</p>
        )}
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
        {param.description && (
          <p className="text-xs text-gray-400 mb-1">{param.description}</p>
        )}
        <select
          id={param.name}
          value={String(value)}
          onChange={(e) => onParamChange(param.name, e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
        >
          {param.options.map((option) => {
            // Handle both string options and {value, label} object options
            const optionValue = typeof option === 'object' ? option.value : option
            const optionLabel = typeof option === 'object' ? option.label : option
            return (
              <option key={optionValue} value={optionValue}>{optionLabel}</option>
            )
          })}
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
              className="custom-checkbox"
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
              className="custom-checkbox"
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
          className="custom-checkbox"
        />
        <label htmlFor={param.name} className="text-sm">
          {param.label}
        </label>
      </div>
    )
  }

  // TypeScript now knows param is NumberParameterDef
  // Calculate effective min/max (dynamic or static, clamped to static bounds)
  const dynamicMinValue = param.dynamicMin ? param.dynamicMin(params) : param.min
  const dynamicMaxValue = param.dynamicMax ? param.dynamicMax(params) : param.max
  const effectiveMin = Math.max(dynamicMinValue, param.min)
  const effectiveMax = Math.min(dynamicMaxValue, param.max)

  // Clamp value to effective range
  const rawValue = Number(value)
  const numValue = Math.max(effectiveMin, Math.min(rawValue, effectiveMax))

  // If value was clamped, notify parent via effect (not during render)
  useEffect(() => {
    if (numValue !== rawValue) {
      onParamChange(param.name, numValue)
    }
  }, [numValue, rawValue, param.name, onParamChange])

  const valueText = `${numValue}${param.unit ? ` ${param.unit}` : ''}`
  return (
    <div className={depth > 0 ? 'ml-6 pl-3 border-l border-gray-600' : ''}>
      <div className="flex justify-between text-sm mb-1">
        <label htmlFor={param.name}>{param.label}</label>
        <span className="text-gray-400" aria-hidden="true">
          {valueText}
        </span>
      </div>
      {param.description && (
        <p className="text-xs text-gray-400 mb-1">{param.description}</p>
      )}
      <input
        type="range"
        id={param.name}
        min={effectiveMin}
        max={effectiveMax}
        step={param.step ?? 1}
        value={numValue}
        onChange={(e) => onParamChange(param.name, parseFloat(e.target.value))}
        className="custom-slider"
        aria-valuemin={effectiveMin}
        aria-valuemax={effectiveMax}
        aria-valuenow={numValue}
        aria-valuetext={valueText}
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1" aria-hidden="true">
        <span>{effectiveMin}</span>
        <span>{effectiveMax}</span>
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
  onDownload,
  onReset,
  canDownload
}: SidebarProps) {
  // Memoize sorted generators to avoid re-sorting on every render
  const sortedGenerators = useMemo(
    () => [...generators].sort((a, b) => a.name.localeCompare(b.name)),
    [generators]
  )

  // Memoize sorted parameters to avoid re-sorting on every render
  const sortedParameters = useMemo(
    () => [...selectedGenerator.parameters].sort((a, b) => {
      const aHasChildren = isBooleanParam(a) && a.children && a.children.length > 0
      const bHasChildren = isBooleanParam(b) && b.children && b.children.length > 0
      if (aHasChildren && !bHasChildren) return 1
      if (!aHasChildren && bHasChildren) return -1
      return 0
    }),
    [selectedGenerator.parameters]
  )

  return (
    <aside className="w-72 bg-gray-800 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 bg-gray-900">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-blue-400">GenPrint</h1>
          <p className="text-sm text-gray-400 mt-1">Parametric 3D Model Generator</p>
        </header>

        <section className="mb-4">
          <label htmlFor="generator-select" className="block text-sm mb-1">Model</label>
          <select
            id="generator-select"
            value={selectedGenerator.id}
            onChange={(e) => onGeneratorChange(e.target.value)}
            className="w-full custom-select"
          >
            {sortedGenerators.map((gen) => (
              <option key={gen.id} value={gen.id}>{gen.name}</option>
            ))}
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">{selectedGenerator.name}</h2>
          <p className="text-sm text-gray-400">{selectedGenerator.description}</p>
        </section>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-300">Parameters</h3>
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-4">
          {sortedParameters.map((param) => (
            <ParameterInput
              key={param.name}
              param={param}
              params={params}
              onParamChange={onParamChange}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-900">
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center justify-center gap-2"
          aria-label={canDownload ? `Download ${selectedGenerator.name} as STL file` : 'Download not available - model not ready'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download STL
        </button>
      </div>
    </aside>
  )
}

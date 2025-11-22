import type { Generator, ParameterValues, ParameterDef } from '../generators'
import { isStringParam, isSelectParam, isBooleanParam } from '../generators'

interface SidebarProps {
  generators: Generator[]
  selectedGenerator: Generator
  onGeneratorChange: (id: string) => void
  params: ParameterValues
  onParamChange: (name: string, value: number | string | boolean) => void
  onParamCommit?: (name: string, value: number | string | boolean) => void
  onSliderDragStart?: () => void
  onSliderDragEnd?: () => void
  onDownload: () => void
  canDownload: boolean
}

interface ParameterInputProps {
  param: ParameterDef
  params: ParameterValues
  onParamChange: (name: string, value: number | string | boolean) => void
  onParamCommit?: (name: string, value: number | string | boolean) => void
  onSliderDragStart?: () => void
  onSliderDragEnd?: () => void
  depth?: number
}

function ParameterInput({ param, params, onParamChange, onParamCommit, onSliderDragStart, onSliderDragEnd, depth = 0 }: ParameterInputProps) {
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
                  onParamCommit={onParamCommit}
                  onSliderDragStart={onSliderDragStart}
                  onSliderDragEnd={onSliderDragEnd}
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
                  onParamCommit={onParamCommit}
                  onSliderDragStart={onSliderDragStart}
                  onSliderDragEnd={onSliderDragEnd}
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

  // If value was clamped, notify parent
  if (numValue !== rawValue) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => onParamChange(param.name, numValue), 0)
  }

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
        min={effectiveMin}
        max={effectiveMax}
        step={param.step ?? 1}
        value={numValue}
        onChange={(e) => onParamChange(param.name, parseFloat(e.target.value))}
        onPointerDown={() => onSliderDragStart?.()}
        onPointerUp={(e) => {
          onSliderDragEnd?.()
          onParamCommit?.(param.name, parseFloat((e.target as HTMLInputElement).value))
        }}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            onParamCommit?.(param.name, parseFloat((e.target as HTMLInputElement).value))
          }
        }}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
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
  onParamCommit,
  onSliderDragStart,
  onSliderDragEnd,
  onDownload,
  canDownload
}: SidebarProps) {
  return (
    <aside className="w-72 bg-gray-800 text-white flex flex-col h-full">
      <div className="p-4 pb-0">
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
            className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
          >
            {[...generators].sort((a, b) => a.name.localeCompare(b.name)).map((gen) => (
              <option key={gen.id} value={gen.id}>{gen.name}</option>
            ))}
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">{selectedGenerator.name}</h2>
          <p className="text-sm text-gray-400 mb-4">{selectedGenerator.description}</p>
        </section>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                onParamCommit={onParamCommit}
                onSliderDragStart={onSliderDragStart}
                onSliderDragEnd={onSliderDragEnd}
              />
            ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center justify-center gap-2"
          aria-label={canDownload ? `Download ${selectedGenerator.name} as STL file` : 'Download not available - model not ready'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download STL
        </button>
      </div>
    </aside>
  )
}

import type { NamedPart, ParameterValues } from '../generators'

/**
 * Formats a number for display in the tooltip.
 * Shows 1 decimal place for non-integers, whole number otherwise.
 */
function formatDimension(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

/**
 * Gets a nested parameter value from params using dot notation.
 * e.g., "bore.diameter" gets params.bore.diameter
 */
function getNestedParam(params: ParameterValues, path: string): number | string | boolean | undefined {
  const parts = path.split('.')
  let current: unknown = params
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current as number | string | boolean | undefined
}

export interface FormattedDimension {
  label: string | null
  value: string
}

/**
 * Formats part dimensions for display in tooltip.
 * If part has custom dimensions, formats each one.
 * Otherwise returns bounding box dimensions.
 */
export function formatPartDimensions(part: NamedPart): FormattedDimension[] {
  const { dimensions, params, boundingBox } = part

  // If we have custom dimensions and params, format them
  if (dimensions && dimensions.length > 0 && params) {
    const formatted: FormattedDimension[] = []

    for (const dim of dimensions) {
      const value = getNestedParam(params, dim.param)
      if (value === undefined) continue

      let formattedValue: string
      if (typeof value === 'number') {
        if (dim.format) {
          formattedValue = dim.format.replace('{value}', formatDimension(value))
        } else {
          formattedValue = `${formatDimension(value)}mm`
        }
      } else {
        formattedValue = String(value)
      }

      formatted.push({ label: dim.label, value: formattedValue })
    }

    // If all dimensions were skipped (missing params), fall back to bounding box
    if (formatted.length > 0) {
      return formatted
    }
  }

  // Fall back to bounding box dimensions
  const [minX, minY, minZ] = boundingBox.min
  const [maxX, maxY, maxZ] = boundingBox.max
  const width = maxX - minX
  const depth = maxY - minY
  const height = maxZ - minZ

  return [{
    label: null,
    value: `${formatDimension(width)} \u00d7 ${formatDimension(depth)} \u00d7 ${formatDimension(height)} mm`
  }]
}

export interface PartTooltipProps {
  part: NamedPart | null
  position: { x: number; y: number } | null
}

/**
 * Tooltip overlay that displays part name and dimensions when hovering over a part.
 * Positioned near the cursor with pointer-events disabled to prevent interference.
 */
export function PartTooltip({ part, position }: PartTooltipProps) {
  // Return null if no part or position
  if (!part || !position) {
    return null
  }

  const dimensions = formatPartDimensions(part)

  // Offset from cursor position
  const offsetX = 10
  const offsetY = 10

  return (
    <div
      className="absolute bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 text-white text-sm shadow-lg px-3 py-2 z-50"
      style={{
        left: `${position.x + offsetX}px`,
        top: `${position.y + offsetY}px`,
        pointerEvents: 'none'
      }}
    >
      {/* Part name */}
      <div className="font-bold text-gray-100 mb-1">{part.name}</div>

      {/* Dimensions */}
      <div className="text-gray-300 font-mono text-xs">
        {dimensions.map((dim, index) => (
          <div key={index} className="flex gap-2">
            {dim.label && <span className="text-gray-400">{dim.label}:</span>}
            <span>{dim.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

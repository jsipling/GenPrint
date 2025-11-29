import type { DrawingTool } from '../hooks/useSketchCanvas'

interface SketchToolbarProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  onClear: () => void
  onUndo: () => void
  canUndo: boolean
}

interface ToolButton {
  tool: DrawingTool
  label: string
  icon: string
}

const tools: ToolButton[] = [
  { tool: 'pen', label: 'Pen', icon: '✏️' },
  { tool: 'circle', label: 'Circle', icon: '⭕' },
  { tool: 'rectangle', label: 'Rectangle', icon: '⬜' },
  { tool: 'line', label: 'Line', icon: '📏' },
  { tool: 'eraser', label: 'Eraser', icon: '🧹' }
]

export function SketchToolbar({
  currentTool,
  onToolChange,
  onClear,
  onUndo,
  canUndo
}: SketchToolbarProps) {
  return (
    <div className="flex gap-2 mb-3">
      {/* Drawing tools */}
      <div className="flex gap-1 p-1 bg-gray-700 rounded">
        {tools.map(({ tool, label, icon }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`
              px-3 py-2 rounded transition-colors
              ${currentTool === tool
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
            aria-label={label}
            title={label}
          >
            <span className="text-lg">{icon}</span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="
            px-3 py-2 bg-gray-700 text-white rounded
            hover:bg-gray-600 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          aria-label="Undo"
          title="Undo"
        >
          ↶
        </button>
        <button
          onClick={onClear}
          className="
            px-3 py-2 bg-gray-700 text-white rounded
            hover:bg-gray-600 transition-colors
          "
          aria-label="Clear canvas"
          title="Clear canvas"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

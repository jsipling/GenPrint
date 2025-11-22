import { useState, useEffect, useRef } from 'react'
import type { GeneratorPart } from '../generators'

interface DownloadDialogProps {
  isOpen: boolean
  generatorName: string
  parts: GeneratorPart[]
  onDownload: (selectedParts: GeneratorPart[]) => void
  onClose: () => void
}

export function DownloadDialog({
  isOpen,
  generatorName,
  parts,
  onDownload,
  onClose
}: DownloadDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset to all selected when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(parts.map(p => p.id)))
    }
  }, [isOpen, parts])

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return

    const dialog = dialogRef.current
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    dialog.addEventListener('keydown', handleTabKey)
    return () => dialog.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  if (!isOpen) return null

  const togglePart = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDownload = () => {
    const selectedParts = parts.filter(p => selectedIds.has(p.id))
    if (selectedParts.length > 0) {
      onDownload(selectedParts)
    }
  }

  const allSelected = selectedIds.size === parts.length
  const noneSelected = selectedIds.size === 0

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-dialog-title"
      style={{ animation: 'fadeIn 150ms ease-out' }}
    >
      <div
        ref={dialogRef}
        className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 150ms ease-out' }}
      >
        <h2 id="download-dialog-title" className="text-lg font-semibold text-white mb-4">
          Download {generatorName}
        </h2>

        <p className="text-gray-400 text-sm mb-4">
          Select parts to download:
        </p>

        <div className="space-y-2 mb-4">
          {parts.map((part) => (
            <label
              key={part.id}
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(part.id)}
                onChange={() => togglePart(part.id)}
                className="custom-checkbox"
              />
              <span className="text-white">{part.name}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={noneSelected}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium text-white transition-colors"
          >
            Download{!allSelected && ` (${selectedIds.size})`}
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded font-medium text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

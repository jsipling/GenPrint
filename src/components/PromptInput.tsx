import { KeyboardEvent } from 'react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  continueConversation?: boolean
  onConversationToggle?: (enabled: boolean) => void
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  continueConversation = false,
  onConversationToggle
}: PromptInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="prompt-input">
      <textarea
        data-testid="prompt-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Describe your design idea... (Ctrl/Cmd+Enter to generate)"
        rows={4}
        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between gap-2">
        {onConversationToggle && (
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              data-testid="conversation-checkbox"
              type="checkbox"
              checked={continueConversation}
              onChange={(e) => onConversationToggle(e.target.checked)}
              disabled={disabled}
              className="custom-checkbox"
            />
            <span>Continue conversation</span>
          </label>
        )}

        <button
          data-testid="generate-button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center gap-2"
        >
          {disabled ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Generate
            </>
          )}
        </button>
      </div>
    </div>
  )
}

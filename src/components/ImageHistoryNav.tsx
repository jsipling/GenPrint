interface ImageHistoryNavProps {
  currentIndex: number
  totalImages: number
  onPrevious: () => void
  onNext: () => void
}

export function ImageHistoryNav({
  currentIndex,
  totalImages,
  onPrevious,
  onNext
}: ImageHistoryNavProps) {
  if (totalImages === 0) {
    return null
  }

  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalImages - 1

  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-gray-800 rounded">
      <button
        onClick={onPrevious}
        disabled={isFirst}
        aria-label="Previous image"
        className="p-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <span className="text-sm text-gray-300 min-w-[4rem] text-center">
        {currentIndex + 1} of {totalImages}
      </span>

      <button
        onClick={onNext}
        disabled={isLast}
        aria-label="Next image"
        className="p-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  )
}

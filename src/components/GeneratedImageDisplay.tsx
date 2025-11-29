import { ImageHistoryNav } from './ImageHistoryNav'

interface GeneratedImage {
  url: string
  timestamp: number
}

interface GeneratedImageDisplayProps {
  images: GeneratedImage[]
  currentIndex: number
  onPrevious: () => void
  onNext: () => void
  isLoading?: boolean
  error?: string
}

export function GeneratedImageDisplay({
  images,
  currentIndex,
  onPrevious,
  onNext,
  isLoading = false,
  error
}: GeneratedImageDisplayProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-700 rounded">
        <svg
          className="w-8 h-8 text-blue-500 animate-spin"
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
        <p className="mt-3 text-sm text-gray-400">Generating image...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-700 rounded p-4">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
      </div>
    )
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-700 rounded">
        <svg
          className="w-12 h-12 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-3 text-sm text-gray-400">No images generated yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Sketch and describe your design below
        </p>
      </div>
    )
  }

  const currentImage = images[currentIndex]

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gray-700 rounded overflow-hidden">
        <img
          src={currentImage?.url}
          alt="Generated design image"
          className="w-full h-auto"
        />
      </div>

      <ImageHistoryNav
        currentIndex={currentIndex}
        totalImages={images.length}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  )
}

/**
 * Represents a single sketch view (top, side, or front)
 */
export type SketchView = 'top' | 'side' | 'front'

/**
 * Data for a single view including the data URL and whether it's empty
 */
export interface ViewData {
  view: SketchView
  dataUrl: string
  isEmpty: boolean
}

/**
 * Complete multi-view sketch data with all three orthographic views
 */
export interface MultiViewSketchData {
  top: ViewData
  side: ViewData
  front: ViewData
}

/**
 * Get the display label for a view
 */
export function getViewLabel(view: SketchView): string {
  switch (view) {
    case 'top':
      return 'Top View'
    case 'side':
      return 'Side View'
    case 'front':
      return 'Front View'
  }
}

/**
 * Check if a canvas is empty by examining its pixel data
 */
export function isCanvasEmpty(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return true

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  // Check if all pixels are fully transparent or white
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    // If we find any non-white, non-transparent pixel, canvas is not empty
    if (a !== undefined && r !== undefined && g !== undefined && b !== undefined &&
        a > 0 && (r < 255 || g < 255 || b < 255)) {
      return false
    }
  }

  return true
}

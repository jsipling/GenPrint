import type { MultiViewSketchData } from './sketch'

/**
 * Complete sketch context captured at image generation time.
 * Used when applying to 3D model to give the geometry AI full context.
 */
export interface SketchContext {
  /** Individual view data URLs (top, side, front) */
  multiViewData: MultiViewSketchData | null
  /** Composite image combining non-empty views with labels */
  compositeDataUrl: string | null
}

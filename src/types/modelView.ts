import type { SketchView } from './sketch'

/**
 * Orthographic screenshot of the current model used for analyzing geometry.
 */
export interface ModelViewImage {
  view: SketchView
  dataUrl: string
}

import type { MultiViewSketchData, ViewData } from '../types/sketch'
import { getViewLabel } from '../types/sketch'

const CANVAS_SIZE = 250
const LABEL_HEIGHT = 40
const SPACING = 20
const PADDING = 40

/**
 * Creates a composite image from multiple sketch views.
 * Non-empty views are arranged horizontally with labels above each.
 *
 * @param data - Multi-view sketch data containing top, side, and front views
 * @returns Data URL of the composite image, or empty string if all views are empty
 */
export async function createCompositeImage(data: MultiViewSketchData): Promise<string> {
  // Filter out empty views
  const nonEmptyViews: ViewData[] = []
  const viewOrder: Array<keyof MultiViewSketchData> = ['top', 'side', 'front']

  viewOrder.forEach(key => {
    const viewData = data[key]
    if (!viewData.isEmpty && viewData.dataUrl) {
      nonEmptyViews.push(viewData)
    }
  })

  // Return empty string if all views are empty
  if (nonEmptyViews.length === 0) {
    return ''
  }

  // Calculate composite dimensions
  const compositeWidth = PADDING * 2 + (nonEmptyViews.length * CANVAS_SIZE) + ((nonEmptyViews.length - 1) * SPACING)
  const compositeHeight = PADDING * 2 + LABEL_HEIGHT + CANVAS_SIZE

  // Create composite canvas
  const canvas = document.createElement('canvas')
  canvas.width = compositeWidth
  canvas.height = compositeHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('Failed to get 2D context for composite canvas')
    return ''
  }

  // Fill background with white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, compositeWidth, compositeHeight)

  // Set up text styling for labels
  ctx.fillStyle = '#000000'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Load and draw each view
  try {
    await Promise.all(
      nonEmptyViews.map(async (viewData, index) => {
        // Calculate position for this view
        const x = PADDING + (index * (CANVAS_SIZE + SPACING))
        const labelY = PADDING + LABEL_HEIGHT / 2
        const canvasY = PADDING + LABEL_HEIGHT

        // Draw label
        const label = getViewLabel(viewData.view)
        ctx.fillText(label, x + CANVAS_SIZE / 2, labelY)

        // Load and draw image
        return new Promise<void>((resolve, reject) => {
          const img = new Image()

          img.onload = () => {
            ctx.drawImage(img, x, canvasY, CANVAS_SIZE, CANVAS_SIZE)
            resolve()
          }

          img.onerror = (err) => {
            console.error(`Failed to load image for ${viewData.view} view:`, err)
            reject(err)
          }

          img.src = viewData.dataUrl
        })
      })
    )

    // Export composite as data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error creating composite image:', error)
    return ''
  }
}

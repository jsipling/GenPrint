/**
 * Compression options for sketch images.
 */
export interface CompressionOptions {
  /** Maximum size (width or height) in pixels. Default: 1024 */
  maxSize?: number
  /** JPEG quality (0-1). Default: 0.72 */
  quality?: number
}

const DEFAULT_MAX_SIZE = 1024
const DEFAULT_QUALITY = 0.72

/**
 * Parse a data URL to extract the mime type and base64 data.
 *
 * @param dataUrl - The data URL to parse
 * @returns Object with mimeType and base64 data
 * @throws Error if the data URL format is invalid
 */
export function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid data URL format')
  }
  return {
    mimeType: matches[1] ?? 'image/png',
    data: matches[2] ?? ''
  }
}

/**
 * Load an image from a data URL.
 *
 * @param dataUrl - The image data URL
 * @returns Promise resolving to the loaded HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Calculate new dimensions maintaining aspect ratio.
 *
 * @param width - Original width
 * @param height - Original height
 * @param maxSize - Maximum size for longest side
 * @returns New dimensions { width, height }
 */
function calculateDimensions(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } {
  // If both dimensions are within maxSize, keep original
  if (width <= maxSize && height <= maxSize) {
    return { width, height }
  }

  // Scale down based on the longest side
  const scale = maxSize / Math.max(width, height)
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

/**
 * Compresses a sketch image for efficient AI API transmission.
 *
 * - Resizes to max 1024px (longest side) by default
 * - Converts to JPEG at ~72% quality by default
 * - Ideal for line drawings/sketches (they compress very well as JPEG)
 *
 * @param dataUrl - Input image as data URL
 * @param options - Optional compression settings
 * @returns Promise resolving to compressed image as JPEG data URL
 */
export async function compressSketchImage(
  dataUrl: string,
  options?: CompressionOptions
): Promise<string> {
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE
  const quality = options?.quality ?? DEFAULT_QUALITY

  // Validate the data URL format first
  parseDataUrl(dataUrl)

  // Load the image
  const img = await loadImage(dataUrl)

  // Calculate target dimensions
  const { width, height } = calculateDimensions(img.width, img.height, maxSize)

  // Create canvas at target size
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Fill with white background (for transparent PNGs)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, width, height)

  // Draw the image (scaled if necessary)
  ctx.drawImage(img, 0, 0, width, height)

  // Export as JPEG with specified quality
  return canvas.toDataURL('image/jpeg', quality)
}

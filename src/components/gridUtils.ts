import { GRID_LINE_Z_OFFSET } from './viewerConstants'

// Constants for tick mark sizes
export const TICK_SIZE = 1.5 // Length of 10mm tick marks
export const SMALL_TICK_SIZE = 0.8 // Length of 5mm tick marks
export const MAX_TICKS_PER_AXIS = 100 // Cap tick count to prevent performance issues with large models
export const DEFAULT_GRID_SIZE = 400 // Default measurement range in mm

// Label interval breakpoints - show fewer labels for larger grids to avoid clutter
// Format: [sizeThreshold, labelInterval] - grids larger than threshold use next interval
const LABEL_INTERVAL_LARGE = 100  // For grids > 400mm: label every 100mm
const LABEL_INTERVAL_MEDIUM = 50  // For grids > 200mm: label every 50mm
const LABEL_INTERVAL_SMALL = 20   // For grids > 100mm: label every 20mm
const LABEL_INTERVAL_TINY = 10    // For smaller grids: label every 10mm

const SIZE_THRESHOLD_LARGE = 400  // Grid size above which we use 100mm labels
const SIZE_THRESHOLD_MEDIUM = 200 // Grid size above which we use 50mm labels
const SIZE_THRESHOLD_SMALL = 100  // Grid size above which we use 20mm labels

export interface TickData {
  points: [[number, number, number], [number, number, number]]
  color: string
}

export interface LabelData {
  pos: [number, number, number]
  text: string
}

export interface GridCalculationResult {
  ticks: TickData[]
  labels: LabelData[]
  tickInterval: number
  effectiveLabelInterval: number
}

/**
 * Calculate tick marks and labels for the measured grid
 * @param size - Total grid size (width/height)
 * @returns Tick and label data for rendering
 */
export function calculateTicksAndLabels(size: number): GridCalculationResult {
  const tickList: TickData[] = []
  const labelList: LabelData[] = []

  const halfSize = size / 2

  // Calculate tick interval to cap total ticks per axis
  // For a 2000mm model (size=4000, halfSize=2000), we want ~100 ticks max
  // Default 5mm interval gives 400 ticks for 2000mm, so scale up interval for large models
  const baseTickInterval = 5
  const tickInterval = halfSize > MAX_TICKS_PER_AXIS * baseTickInterval
    ? Math.ceil(halfSize / MAX_TICKS_PER_AXIS / 5) * 5 // Round up to nearest 5mm
    : baseTickInterval

  // Calculate label interval based on size - show fewer labels for larger grids
  const labelInterval = size > SIZE_THRESHOLD_LARGE ? LABEL_INTERVAL_LARGE
    : size > SIZE_THRESHOLD_MEDIUM ? LABEL_INTERVAL_MEDIUM
    : size > SIZE_THRESHOLD_SMALL ? LABEL_INTERVAL_SMALL
    : LABEL_INTERVAL_TINY
  // Scale label interval with tick interval for very large models
  const effectiveLabelInterval = Math.max(labelInterval, tickInterval * 2)

  // X axis ticks and labels (positive only)
  for (let mm = tickInterval; mm <= halfSize; mm += tickInterval) {
    const isCm = mm % 10 === 0
    const tick = isCm ? TICK_SIZE : SMALL_TICK_SIZE

    tickList.push({ points: [[mm, -tick, GRID_LINE_Z_OFFSET], [mm, tick, GRID_LINE_Z_OFFSET]], color: '#ff4444' })

    // Label at intervals
    if (mm % effectiveLabelInterval === 0) {
      labelList.push({ pos: [mm, -TICK_SIZE - 2, 0], text: `${mm}` })
    }
  }

  // Y axis ticks and labels (positive only)
  for (let mm = tickInterval; mm <= halfSize; mm += tickInterval) {
    const isCm = mm % 10 === 0
    const tick = isCm ? TICK_SIZE : SMALL_TICK_SIZE

    tickList.push({ points: [[-tick, mm, GRID_LINE_Z_OFFSET], [tick, mm, GRID_LINE_Z_OFFSET]], color: '#44ff44' })

    if (mm % effectiveLabelInterval === 0) {
      labelList.push({ pos: [-TICK_SIZE - 2, mm, 0], text: `${mm}` })
    }
  }

  // Z axis ticks and labels (vertical, positive only)
  for (let mm = tickInterval; mm <= halfSize; mm += tickInterval) {
    const isCm = mm % 10 === 0
    const tick = isCm ? TICK_SIZE : SMALL_TICK_SIZE

    tickList.push({ points: [[-tick, 0, mm], [tick, 0, mm]], color: '#4444ff' })
    tickList.push({ points: [[0, -tick, mm], [0, tick, mm]], color: '#4444ff' })

    if (mm % effectiveLabelInterval === 0) {
      labelList.push({ pos: [-TICK_SIZE - 2, -TICK_SIZE - 2, mm], text: `${mm}` })
    }
  }

  return { ticks: tickList, labels: labelList, tickInterval, effectiveLabelInterval }
}

/**
 * Calculate grid parameters based on model dimensions
 * @param modelMaxDim - Maximum dimension of the model
 * @returns Grid size and division parameters
 */
export function calculateGridParams(modelMaxDim: number): {
  gridRange: number
  gridSize: number
  gridDivisions: number
} {
  const gridRange = Math.max(DEFAULT_GRID_SIZE, Math.ceil(modelMaxDim / 10) * 10)
  const gridSize = gridRange * 2 // Grid is centered, so double the range
  const gridDivisions = gridSize / 10 // 10mm per division
  return { gridRange, gridSize, gridDivisions }
}

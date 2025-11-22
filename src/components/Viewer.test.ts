import { describe, it, expect } from 'vitest'

// Constants matching those in Viewer.tsx
const TICK_SIZE = 1.5
const SMALL_TICK_SIZE = 0.8
const MAX_TICKS_PER_AXIS = 100

// Extract the tick calculation logic for testing
function calculateTicksAndLabels(size: number) {
  const tickList: { points: [[number, number, number], [number, number, number]]; color: string }[] = []
  const labelList: { pos: [number, number, number]; text: string }[] = []

  const halfSize = size / 2

  // Calculate tick interval to cap total ticks per axis
  const baseTickInterval = 5
  const tickInterval = halfSize > MAX_TICKS_PER_AXIS * baseTickInterval
    ? Math.ceil(halfSize / MAX_TICKS_PER_AXIS / 5) * 5
    : baseTickInterval

  // Calculate label interval based on size
  const labelInterval = size > 200 ? 50 : (size > 100 ? 20 : 10)
  const effectiveLabelInterval = Math.max(labelInterval, tickInterval * 2)

  // X axis ticks and labels (positive only)
  for (let mm = tickInterval; mm <= halfSize; mm += tickInterval) {
    const isCm = mm % 10 === 0
    const tick = isCm ? TICK_SIZE : SMALL_TICK_SIZE

    tickList.push({ points: [[mm, -tick, 0.01], [mm, tick, 0.01]], color: '#ff4444' })

    if (mm % effectiveLabelInterval === 0) {
      labelList.push({ pos: [mm, -TICK_SIZE - 2, 0], text: `${mm}` })
    }
  }

  // Y axis ticks and labels (positive only)
  for (let mm = tickInterval; mm <= halfSize; mm += tickInterval) {
    const isCm = mm % 10 === 0
    const tick = isCm ? TICK_SIZE : SMALL_TICK_SIZE

    tickList.push({ points: [[-tick, mm, 0.01], [tick, mm, 0.01]], color: '#44ff44' })

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

describe('MeasuredGrid tick calculation', () => {
  it('should use 5mm tick interval for small grids', () => {
    const { tickInterval } = calculateTicksAndLabels(100)
    expect(tickInterval).toBe(5)
  })

  it('should use 5mm tick interval for medium grids', () => {
    const { tickInterval } = calculateTicksAndLabels(400)
    expect(tickInterval).toBe(5)
  })

  it('should increase tick interval for large grids to cap tick count', () => {
    // For a 2000mm model, gridSize = 4000 (doubled for centering)
    // halfSize = 2000, which would give 400 ticks at 5mm interval
    // Should scale up to ~20mm interval to cap at ~100 ticks
    const { tickInterval, ticks } = calculateTicksAndLabels(4000)

    // Tick interval should be increased
    expect(tickInterval).toBeGreaterThan(5)

    // Total X axis ticks should be capped
    const xAxisTicks = ticks.filter(t => t.color === '#ff4444')
    expect(xAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
  })

  it('should cap total tick count for very large grids', () => {
    // 10 meter model would be size = 20000
    const { ticks } = calculateTicksAndLabels(20000)

    // Each axis should have at most MAX_TICKS_PER_AXIS ticks
    const xAxisTicks = ticks.filter(t => t.color === '#ff4444')
    const yAxisTicks = ticks.filter(t => t.color === '#44ff44')
    const zAxisTicks = ticks.filter(t => t.color === '#4444ff')

    expect(xAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
    expect(yAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS)
    // Z axis has 2 ticks per interval (on X and Y planes)
    expect(zAxisTicks.length).toBeLessThanOrEqual(MAX_TICKS_PER_AXIS * 2)
  })

  it('should generate labels at appropriate intervals for small grids', () => {
    const { labels, effectiveLabelInterval } = calculateTicksAndLabels(100)

    // For size <= 100, label interval should be 10
    expect(effectiveLabelInterval).toBe(10)

    // Check labels exist at expected positions
    const xLabels = labels.filter(l => l.pos[1] === -TICK_SIZE - 2 && l.pos[2] === 0)
    expect(xLabels.length).toBeGreaterThan(0)
    expect(xLabels.some(l => l.text === '10')).toBe(true)
  })

  it('should generate fewer labels for larger grids', () => {
    const small = calculateTicksAndLabels(100)
    const large = calculateTicksAndLabels(1000)

    // Larger grids should have larger effective label intervals
    expect(large.effectiveLabelInterval).toBeGreaterThan(small.effectiveLabelInterval)
  })

  it('should generate correct tick colors for each axis', () => {
    const { ticks } = calculateTicksAndLabels(200)

    // X axis ticks should be red (first point X > 0, Z near 0)
    const xTicks = ticks.filter(t => t.color === '#ff4444')
    expect(xTicks.length).toBeGreaterThan(0)

    // Y axis ticks should be green
    const yTicks = ticks.filter(t => t.color === '#44ff44')
    expect(yTicks.length).toBeGreaterThan(0)

    // Z axis ticks should be blue
    const zTicks = ticks.filter(t => t.color === '#4444ff')
    expect(zTicks.length).toBeGreaterThan(0)

    // All ticks should have one of the expected colors
    const validColors = ['#ff4444', '#44ff44', '#4444ff']
    expect(ticks.every(t => validColors.includes(t.color))).toBe(true)
  })

  it('should use larger tick size for 10mm intervals', () => {
    const { ticks } = calculateTicksAndLabels(100)

    // Find ticks at 10mm position (should have TICK_SIZE)
    const tickAt10mm = ticks.find(t =>
      t.color === '#ff4444' &&
      t.points[0][0] === 10 &&
      Math.abs(t.points[0][1]) === TICK_SIZE
    )
    expect(tickAt10mm).toBeDefined()

    // Find ticks at 5mm position (should have SMALL_TICK_SIZE)
    const tickAt5mm = ticks.find(t =>
      t.color === '#ff4444' &&
      t.points[0][0] === 5 &&
      Math.abs(t.points[0][1]) === SMALL_TICK_SIZE
    )
    expect(tickAt5mm).toBeDefined()
  })
})

describe('Grid size calculations', () => {
  const DEFAULT_GRID_SIZE = 400

  function calculateGridParams(modelMaxDim: number) {
    const gridRange = Math.max(DEFAULT_GRID_SIZE, Math.ceil(modelMaxDim / 10) * 10)
    const gridSize = gridRange * 2
    const gridDivisions = gridSize / 10
    return { gridRange, gridSize, gridDivisions }
  }

  it('should use default size for small models', () => {
    const { gridSize } = calculateGridParams(50)
    expect(gridSize).toBe(800) // DEFAULT_GRID_SIZE * 2
  })

  it('should scale grid for large models', () => {
    const { gridSize } = calculateGridParams(1000)
    expect(gridSize).toBe(2000) // 1000 rounded up * 2
  })

  it('should round up model dimension to nearest 10mm', () => {
    const { gridRange } = calculateGridParams(123)
    expect(gridRange).toBe(DEFAULT_GRID_SIZE) // Still uses default since 130 < 400
  })

  it('should round up for models larger than default', () => {
    const { gridRange } = calculateGridParams(423)
    expect(gridRange).toBe(430) // ceil(423/10) * 10 = 430
  })
})

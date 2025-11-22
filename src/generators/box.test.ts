import { describe, it, expect } from 'vitest'
import { boxGenerator } from './box'

describe('boxGenerator', () => {
  it('should have correct metadata', () => {
    expect(boxGenerator.id).toBe('parametric-box')
    expect(boxGenerator.name).toBe('Parametric Box')
    expect(boxGenerator.description).toBe('A customizable box with optional lid')
  })

  it('should have correct parameters defined', () => {
    expect(boxGenerator.parameters).toHaveLength(5)

    const width = boxGenerator.parameters.find(p => p.name === 'width')
    expect(width).toBeDefined()
    expect(width?.type).toBe('number')
    expect(width?.default).toBe(50)

    const depth = boxGenerator.parameters.find(p => p.name === 'depth')
    expect(depth).toBeDefined()
    expect(depth?.type).toBe('number')
    expect(depth?.default).toBe(50)

    const height = boxGenerator.parameters.find(p => p.name === 'height')
    expect(height).toBeDefined()
    expect(height?.type).toBe('number')
    expect(height?.default).toBe(30)

    const wallThickness = boxGenerator.parameters.find(p => p.name === 'wall_thickness')
    expect(wallThickness).toBeDefined()
    expect(wallThickness?.type).toBe('number')
    expect(wallThickness?.default).toBe(2)

    const cornerRadius = boxGenerator.parameters.find(p => p.name === 'corner_radius')
    expect(cornerRadius).toBeDefined()
    expect(cornerRadius?.type).toBe('number')
    expect(cornerRadius?.default).toBe(3)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3
    })

    expect(scad).toContain('width = 50')
    expect(scad).toContain('depth = 50')
    expect(scad).toContain('height = 30')
    expect(scad).toContain('wall_thickness = 2')
    expect(scad).toContain('corner_radius = 3')
  })

  it('should generate SCAD code with difference operation for hollow box', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 40,
      height: 25,
      wall_thickness: 3,
      corner_radius: 2
    })

    expect(scad).toContain('difference()')
  })

  it('should use rounded corners module', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 5
    })

    expect(scad).toContain('module rounded_box')
  })

  it('should handle zero corner radius', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 0
    })

    expect(scad).toContain('corner_radius = 0')
  })

  it('should handle edge case minimum values', () => {
    const scad = boxGenerator.scadTemplate({
      width: 20,
      depth: 20,
      height: 10,
      wall_thickness: 1,
      corner_radius: 0
    })

    expect(scad).toContain('width = 20')
    expect(scad).toContain('depth = 20')
    expect(scad).toContain('height = 10')
    expect(scad).toContain('wall_thickness = 1')
  })

  it('should handle edge case maximum values', () => {
    const scad = boxGenerator.scadTemplate({
      width: 200,
      depth: 200,
      height: 100,
      wall_thickness: 5,
      corner_radius: 10
    })

    expect(scad).toContain('width = 200')
    expect(scad).toContain('depth = 200')
    expect(scad).toContain('height = 100')
  })
})

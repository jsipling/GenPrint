import { describe, it, expect } from 'vitest'
import { washerGenerator } from './washer'

describe('washerGenerator', () => {
  it('should have correct metadata', () => {
    expect(washerGenerator.id).toBe('washer')
    expect(washerGenerator.name).toBe('Washer')
    expect(washerGenerator.description).toContain('flat ring')
  })

  it('should have correct parameters defined', () => {
    expect(washerGenerator.parameters).toHaveLength(3)

    const outerD = washerGenerator.parameters.find(p => p.name === 'outer_diameter')
    expect(outerD).toBeDefined()
    expect(outerD?.type).toBe('number')
    expect(outerD?.default).toBe(12)

    const innerD = washerGenerator.parameters.find(p => p.name === 'inner_diameter')
    expect(innerD).toBeDefined()
    expect(innerD?.type).toBe('number')
    expect(innerD?.default).toBe(6)

    const thickness = washerGenerator.parameters.find(p => p.name === 'thickness')
    expect(thickness).toBeDefined()
    expect(thickness?.type).toBe('number')
    expect(thickness?.default).toBe(1.5)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = washerGenerator.scadTemplate({
      outer_diameter: 12,
      inner_diameter: 6,
      thickness: 1.5
    })

    expect(scad).toContain('outer_d = 12')
    expect(scad).toContain('inner_d = 6')
    expect(scad).toContain('thickness = 1.5')
  })

  it('should use difference to create the hole', () => {
    const scad = washerGenerator.scadTemplate({
      outer_diameter: 20,
      inner_diameter: 10,
      thickness: 2
    })

    expect(scad).toContain('difference()')
    expect(scad).toContain('cylinder')
  })

  it('should clamp inner diameter to maintain wall thickness', () => {
    const scad = washerGenerator.scadTemplate({
      outer_diameter: 10,
      inner_diameter: 12, // Invalid: larger than outer
      thickness: 1
    })

    // Should clamp inner to be smaller than outer
    expect(scad).not.toContain('inner_d = 12')
  })

  it('should set $fn for smooth circles', () => {
    const scad = washerGenerator.scadTemplate({
      outer_diameter: 12,
      inner_diameter: 6,
      thickness: 1.5
    })

    expect(scad).toContain('$fn')
  })
})

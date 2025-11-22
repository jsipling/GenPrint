import { describe, it, expect } from 'vitest'
import { spacerGenerator } from './spacer'

describe('spacerGenerator', () => {
  it('should have correct metadata', () => {
    expect(spacerGenerator.id).toBe('cylindrical-spacer')
    expect(spacerGenerator.name).toBe('Cylindrical Spacer')
    expect(spacerGenerator.description).toBe('A simple cylindrical spacer with a center hole')
  })

  it('should have correct parameters defined', () => {
    expect(spacerGenerator.parameters).toHaveLength(3)

    const outerDiam = spacerGenerator.parameters.find(p => p.name === 'outer_diameter')
    expect(outerDiam).toBeDefined()
    expect(outerDiam?.type).toBe('number')
    expect(outerDiam?.default).toBe(20)

    const innerHole = spacerGenerator.parameters.find(p => p.name === 'inner_hole')
    expect(innerHole).toBeDefined()
    expect(innerHole?.type).toBe('number')
    expect(innerHole?.default).toBe(5)

    const height = spacerGenerator.parameters.find(p => p.name === 'height')
    expect(height).toBeDefined()
    expect(height?.type).toBe('number')
    expect(height?.default).toBe(10)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 20,
      inner_hole: 5,
      height: 10
    })

    expect(scad).toContain('outer_diameter = 20')
    expect(scad).toContain('inner_hole = 5')
    expect(scad).toContain('height = 10')
    expect(scad).toContain('$fn = 60')
  })

  it('should generate SCAD code with difference operation', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 30,
      inner_hole: 10,
      height: 15
    })

    expect(scad).toContain('difference()')
    expect(scad).toContain('cylinder(h=height, d=outer_diameter)')
    expect(scad).toContain('cylinder(h=height+2, d=inner_hole)')
  })

  it('should use translate for the inner hole cutout', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 25,
      inner_hole: 8,
      height: 12
    })

    // Inner cylinder is translated down by 1mm for clean boolean subtraction
    expect(scad).toContain('translate([0,0,-1])')
  })

  it('should handle edge case minimum values', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 10,
      inner_hole: 2,
      height: 1
    })

    expect(scad).toContain('outer_diameter = 10')
    expect(scad).toContain('inner_hole = 2')
    expect(scad).toContain('height = 1')
  })

  it('should handle edge case maximum values', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 100,
      inner_hole: 50,
      height: 50
    })

    expect(scad).toContain('outer_diameter = 100')
    expect(scad).toContain('inner_hole = 50')
    expect(scad).toContain('height = 50')
  })

  it('should clamp inner_hole to be less than outer_diameter', () => {
    // Invalid case: inner_hole >= outer_diameter
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 20,
      inner_hole: 25, // Invalid: larger than outer
      height: 10
    })

    // inner_hole should be clamped to outer_diameter - 2mm minimum wall
    expect(scad).toContain('outer_diameter = 20')
    expect(scad).toContain('inner_hole = 18') // Clamped to outer - 2
    expect(scad).toContain('height = 10')
  })

  it('should clamp inner_hole when equal to outer_diameter', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 30,
      inner_hole: 30, // Invalid: equal to outer
      height: 10
    })

    expect(scad).toContain('inner_hole = 28') // Clamped to outer - 2
  })

  it('should allow valid inner_hole that is smaller than outer_diameter', () => {
    const scad = spacerGenerator.scadTemplate({
      outer_diameter: 30,
      inner_hole: 10, // Valid: much smaller than outer
      height: 10
    })

    expect(scad).toContain('inner_hole = 10') // Unchanged
  })
})

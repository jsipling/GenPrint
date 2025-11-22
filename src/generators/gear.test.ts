import { describe, it, expect } from 'vitest'
import { gearGenerator } from './gear'

describe('gearGenerator', () => {
  it('should have correct metadata', () => {
    expect(gearGenerator.id).toBe('spur-gear')
    expect(gearGenerator.name).toBe('Spur Gear')
    expect(gearGenerator.description).toBe('A customizable spur gear with center hole')
  })

  it('should have correct parameters defined', () => {
    expect(gearGenerator.parameters).toHaveLength(5)

    const teeth = gearGenerator.parameters.find(p => p.name === 'teeth')
    expect(teeth).toBeDefined()
    expect(teeth?.type).toBe('number')
    expect(teeth?.default).toBe(20)

    const module_ = gearGenerator.parameters.find(p => p.name === 'module_size')
    expect(module_).toBeDefined()
    expect(module_?.type).toBe('number')
    expect(module_?.default).toBe(2)

    const thickness = gearGenerator.parameters.find(p => p.name === 'thickness')
    expect(thickness).toBeDefined()
    expect(thickness?.type).toBe('number')
    expect(thickness?.default).toBe(5)

    const holeD = gearGenerator.parameters.find(p => p.name === 'hole_diameter')
    expect(holeD).toBeDefined()
    expect(holeD?.type).toBe('number')
    expect(holeD?.default).toBe(5)

    const pressureAngle = gearGenerator.parameters.find(p => p.name === 'pressure_angle')
    expect(pressureAngle).toBeDefined()
    expect(pressureAngle?.type).toBe('number')
    expect(pressureAngle?.default).toBe(20)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module_size: 2,
      thickness: 5,
      hole_diameter: 5,
      pressure_angle: 20
    })

    expect(scad).toContain('teeth = 20')
    expect(scad).toContain('module_size = 2')
    expect(scad).toContain('thickness = 5')
    expect(scad).toContain('hole_diameter = 5')
    expect(scad).toContain('pressure_angle = 20')
  })

  it('should include gear tooth profile generation', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 24,
      module_size: 1.5,
      thickness: 4,
      hole_diameter: 6,
      pressure_angle: 20
    })

    expect(scad).toContain('pitch_radius')
    expect(scad).toContain('addendum')
    expect(scad).toContain('dedendum')
  })

  it('should generate involute tooth profile', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 16,
      module_size: 2,
      thickness: 5,
      hole_diameter: 4,
      pressure_angle: 20
    })

    // Should have involute curve function
    expect(scad).toContain('function involute')
  })

  it('should use linear_extrude for 3D gear', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module_size: 2,
      thickness: 8,
      hole_diameter: 5,
      pressure_angle: 20
    })

    expect(scad).toContain('linear_extrude')
  })

  it('should include center hole', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module_size: 2,
      thickness: 5,
      hole_diameter: 8,
      pressure_angle: 20
    })

    expect(scad).toContain('difference()')
    expect(scad).toContain('cylinder')
  })

  it('should handle different tooth counts', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 12,
      module_size: 2,
      thickness: 5,
      hole_diameter: 5,
      pressure_angle: 20
    })

    expect(scad).toContain('teeth = 12')
  })

  it('should handle different pressure angles', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module_size: 2,
      thickness: 5,
      hole_diameter: 5,
      pressure_angle: 14.5
    })

    expect(scad).toContain('pressure_angle = 14.5')
  })

  it('should handle zero hole diameter', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module_size: 2,
      thickness: 5,
      hole_diameter: 0,
      pressure_angle: 20
    })

    expect(scad).toContain('hole_diameter = 0')
  })
})

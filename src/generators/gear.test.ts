import { describe, it, expect } from 'vitest'
import { gearGenerator } from './gear'

describe('gearGenerator', () => {
  it('should have correct metadata', () => {
    expect(gearGenerator.id).toBe('spur_gear')
    expect(gearGenerator.name).toBe('Spur Gear')
    expect(gearGenerator.description).toBe('A parametric spur gear with optional hub')
  })

  it('should have correct parameters defined', () => {
    expect(gearGenerator.parameters).toHaveLength(9)

    const teeth = gearGenerator.parameters.find(p => p.name === 'teeth')
    expect(teeth).toBeDefined()
    expect(teeth?.type).toBe('number')
    expect(teeth?.default).toBe(20)

    const mod = gearGenerator.parameters.find(p => p.name === 'module')
    expect(mod).toBeDefined()
    expect(mod?.type).toBe('number')
    expect(mod?.default).toBe(2)

    const height = gearGenerator.parameters.find(p => p.name === 'height')
    expect(height).toBeDefined()
    expect(height?.type).toBe('number')
    expect(height?.default).toBe(5)

    const boreDiameter = gearGenerator.parameters.find(p => p.name === 'bore_diameter')
    expect(boreDiameter).toBeDefined()
    expect(boreDiameter?.type).toBe('number')
    expect(boreDiameter?.default).toBe(5)

    const includeHub = gearGenerator.parameters.find(p => p.name === 'include_hub')
    expect(includeHub).toBeDefined()
    expect(includeHub?.type).toBe('boolean')
    expect(includeHub?.default).toBe(true)

    const hubDiameter = gearGenerator.parameters.find(p => p.name === 'hub_diameter')
    expect(hubDiameter).toBeDefined()
    expect(hubDiameter?.type).toBe('number')
    expect(hubDiameter?.default).toBe(15)

    const hubHeight = gearGenerator.parameters.find(p => p.name === 'hub_height')
    expect(hubHeight).toBeDefined()
    expect(hubHeight?.type).toBe('number')
    expect(hubHeight?.default).toBe(5)

    const pressureAngle = gearGenerator.parameters.find(p => p.name === 'pressure_angle')
    expect(pressureAngle).toBeDefined()
    expect(pressureAngle?.type).toBe('number')
    expect(pressureAngle?.default).toBe(20)

    const tolerance = gearGenerator.parameters.find(p => p.name === 'tolerance')
    expect(tolerance).toBeDefined()
    expect(tolerance?.type).toBe('number')
    expect(tolerance?.default).toBe(0)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: true,
      hub_diameter: 15,
      hub_height: 5,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('teeth = 20')
    expect(scad).toContain('m = 2')
    expect(scad).toContain('h = 5')
    expect(scad).toContain('pressure_angle = 20')
  })

  it('should include involute function for tooth profile', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: true,
      hub_diameter: 15,
      hub_height: 5,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('function inv_angle')
    expect(scad).toContain('module one_tooth()')
  })

  it('should include hub when enabled', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: true,
      hub_diameter: 15,
      hub_height: 5,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('include_hub = true')
    expect(scad).toContain('hub_d =')
    expect(scad).toContain('hub_h = 5')
  })

  it('should disable hub when set to false', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 5,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('include_hub = false')
  })

  it('should use linear_extrude for 3D gear', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 8,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('linear_extrude')
  })

  it('should include bore hole', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 8,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('difference()')
    expect(scad).toContain('cylinder')
  })

  it('should handle different tooth counts', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 12,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('teeth = 12')
  })

  it('should handle different pressure angles', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 14.5,
      tolerance: 0
    })

    expect(scad).toContain('pressure_angle = 14.5')
  })

  it('should handle zero bore diameter', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 0,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('bore_d = 0')
  })

  it('should include tolerance parameter', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0.15
    })

    expect(scad).toContain('clearance = 0.15')
  })

  it('should calculate derived dimensions', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    expect(scad).toContain('pitch_r')
    expect(scad).toContain('outer_r')
    expect(scad).toContain('root_r')
    expect(scad).toContain('base_r')
  })

  it('should limit bore diameter to safe value', () => {
    // With 20 teeth and module 2: pitch_d = 40, root_d = 35
    // maxBore = 35 - 4 = 31, so bore of 50 should be limited
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 50,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0
    })

    // Should contain a bore_d value less than 50
    expect(scad).toContain('bore_d = 31')
  })
})

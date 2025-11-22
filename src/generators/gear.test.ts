import { describe, it, expect } from 'vitest'
import { gearGenerator } from './gear'
import { flattenParameters, isBooleanParam } from './types'

describe('gearGenerator', () => {
  it('should have correct metadata', () => {
    expect(gearGenerator.id).toBe('spur_gear')
    expect(gearGenerator.name).toBe('Spur Gear')
    expect(gearGenerator.description).toBe('A parametric spur gear with optional hub')
  })

  it('should have correct parameters defined', () => {
    // Top-level parameters (hub_diameter and hub_height are nested under include_hub)
    expect(gearGenerator.parameters).toHaveLength(8)
    // Flattened total including nested children
    const allParams = flattenParameters(gearGenerator.parameters)
    expect(allParams).toHaveLength(10)

    const teeth = allParams.find(p => p.name === 'teeth')
    expect(teeth).toBeDefined()
    expect(teeth?.type).toBe('number')
    expect(teeth?.default).toBe(20)

    const mod = allParams.find(p => p.name === 'module')
    expect(mod).toBeDefined()
    expect(mod?.type).toBe('number')
    expect(mod?.default).toBe(2)

    const height = allParams.find(p => p.name === 'height')
    expect(height).toBeDefined()
    expect(height?.type).toBe('number')
    expect(height?.default).toBe(5)

    const boreDiameter = allParams.find(p => p.name === 'bore_diameter')
    expect(boreDiameter).toBeDefined()
    expect(boreDiameter?.type).toBe('number')
    expect(boreDiameter?.default).toBe(5)

    const includeHub = allParams.find(p => p.name === 'include_hub')
    expect(includeHub).toBeDefined()
    expect(includeHub?.type).toBe('boolean')
    expect(includeHub?.default).toBe(true)

    const hubDiameter = allParams.find(p => p.name === 'hub_diameter')
    expect(hubDiameter).toBeDefined()
    expect(hubDiameter?.type).toBe('number')
    expect(hubDiameter?.default).toBe(15)

    const hubHeight = allParams.find(p => p.name === 'hub_height')
    expect(hubHeight).toBeDefined()
    expect(hubHeight?.type).toBe('number')
    expect(hubHeight?.default).toBe(5)

    const pressureAngle = allParams.find(p => p.name === 'pressure_angle')
    expect(pressureAngle).toBeDefined()
    expect(pressureAngle?.type).toBe('number')
    expect(pressureAngle?.default).toBe(20)

    const tolerance = allParams.find(p => p.name === 'tolerance')
    expect(tolerance).toBeDefined()
    expect(tolerance?.type).toBe('number')
    expect(tolerance?.default).toBe(0)
  })

  it('should have hub parameters nested under include_hub', () => {
    const includeHub = gearGenerator.parameters.find(p => p.name === 'include_hub')
    expect(includeHub).toBeDefined()
    expect(isBooleanParam(includeHub!)).toBe(true)

    if (isBooleanParam(includeHub!)) {
      expect(includeHub.children).toBeDefined()
      expect(includeHub.children).toHaveLength(2)
      const children = includeHub.children!
      expect(children[0]!.name).toBe('hub_diameter')
      expect(children[1]!.name).toBe('hub_height')
    }
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
      tolerance: 0,
      tip_sharpness: 0
    })

    // Should contain a bore_d value less than 50
    expect(scad).toContain('bore_d = 31')
  })

  it('should have tip_sharpness parameter', () => {
    const allParams = flattenParameters(gearGenerator.parameters)
    const tipSharpness = allParams.find(p => p.name === 'tip_sharpness')
    expect(tipSharpness).toBeDefined()
    expect(tipSharpness?.type).toBe('number')
    expect(tipSharpness?.default).toBe(0)
    if (tipSharpness?.type === 'number') {
      expect(tipSharpness.min).toBe(0)
      expect(tipSharpness.max).toBe(1)
    }
  })

  it('should include tip_sharpness in SCAD output', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0,
      tip_sharpness: 0.5
    })

    expect(scad).toContain('tip_sharpness = 0.5')
  })

  it('should generate pointed tip when tip_sharpness is 1', () => {
    const scad = gearGenerator.scadTemplate({
      teeth: 20,
      module: 2,
      height: 5,
      bore_diameter: 5,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0,
      tip_sharpness: 1
    })

    // Should include tip point logic in polygon
    expect(scad).toContain('tip_point')
  })

  it('should limit teeth count based on module for visible geometry', () => {
    // With module 0.5, max teeth = 0.5 * 50 = 25
    const scad = gearGenerator.scadTemplate({
      teeth: 100,
      module: 0.5,
      height: 5,
      bore_diameter: 0,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0,
      tip_sharpness: 0
    })

    // Should limit to 25 teeth, not 100
    expect(scad).toContain('teeth = 25')
  })

  it('should allow high tooth counts with large modules', () => {
    // With module 2, max teeth = 2 * 50 = 100
    const scad = gearGenerator.scadTemplate({
      teeth: 100,
      module: 2,
      height: 5,
      bore_diameter: 0,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0,
      tip_sharpness: 0
    })

    // Should allow 100 teeth with module 2
    expect(scad).toContain('teeth = 100')
  })

  it('should enforce minimum of 8 teeth', () => {
    // With very small module, maxTeethForModule could be less than 8
    const scad = gearGenerator.scadTemplate({
      teeth: 100,
      module: 0.1, // Would give max 5 teeth, but should floor to 8
      height: 5,
      bore_diameter: 0,
      include_hub: false,
      hub_diameter: 15,
      hub_height: 0,
      pressure_angle: 20,
      tolerance: 0,
      tip_sharpness: 0
    })

    // Should enforce minimum of 8 teeth
    expect(scad).toContain('teeth = 8')
  })
})

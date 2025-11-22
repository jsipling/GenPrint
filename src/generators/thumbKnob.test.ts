import { describe, it, expect } from 'vitest'
import { thumbKnobGenerator } from './thumbKnob'

describe('thumbKnobGenerator', () => {
  it('should have correct metadata', () => {
    expect(thumbKnobGenerator.id).toBe('thumb-knob')
    expect(thumbKnobGenerator.name).toBe('Thumb Knob')
    expect(thumbKnobGenerator.description).toBe('A grip handle for standard hex bolts/nuts (e.g., M3). Turns a screw into a thumb-screw.')
  })

  it('should have correct parameters defined', () => {
    expect(thumbKnobGenerator.parameters).toHaveLength(5)

    const screwSize = thumbKnobGenerator.parameters.find(p => p.name === 'screw_size')
    expect(screwSize).toBeDefined()
    expect(screwSize?.type).toBe('select')
    expect(screwSize?.default).toBe('M3')

    const knobDiameter = thumbKnobGenerator.parameters.find(p => p.name === 'knob_diameter')
    expect(knobDiameter).toBeDefined()
    expect(knobDiameter?.type).toBe('number')
    expect(knobDiameter?.default).toBe(15)

    const height = thumbKnobGenerator.parameters.find(p => p.name === 'height')
    expect(height).toBeDefined()
    expect(height?.type).toBe('number')
    expect(height?.default).toBe(6)

    const style = thumbKnobGenerator.parameters.find(p => p.name === 'style')
    expect(style).toBeDefined()
    expect(style?.type).toBe('select')
    expect(style?.default).toBe('Knurled')

    const tolerance = thumbKnobGenerator.parameters.find(p => p.name === 'tolerance')
    expect(tolerance).toBeDefined()
    expect(tolerance?.type).toBe('number')
    expect(tolerance?.default).toBe(0.15)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M3',
      knob_diameter: 15,
      height: 6,
      style: 'Knurled',
      tolerance: 0.15
    })

    expect(scad).toContain('knob_d = 15')
    expect(scad).toContain('height = 6')
    expect(scad).toContain('style = "Knurled"')
    expect(scad).toContain('tol = 0.15')
  })

  it('should include hex socket geometry', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M4',
      knob_diameter: 20,
      height: 8,
      style: 'Knurled',
      tolerance: 0.2
    })

    expect(scad).toContain('hex_flat')
    expect(scad).toContain('hex_depth')
    expect(scad).toContain('hex_d')
    expect(scad).toContain('$fn=6')
  })

  it('should include knurled shape module', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M3',
      knob_diameter: 15,
      height: 6,
      style: 'Knurled',
      tolerance: 0.15
    })

    expect(scad).toContain('module knurled_shape')
    expect(scad).toContain('knurled_shape(knob_d)')
  })

  it('should include lobed shape module', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M3',
      knob_diameter: 15,
      height: 6,
      style: 'Lobed',
      tolerance: 0.15
    })

    expect(scad).toContain('module lobed_shape')
    expect(scad).toContain('style == "Lobed"')
  })

  it('should handle hexagonal style', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M5',
      knob_diameter: 25,
      height: 10,
      style: 'Hexagonal',
      tolerance: 0.15
    })

    expect(scad).toContain('style == "Hexagonal"')
    expect(scad).toContain('circle(d=knob_d, $fn=6)')
  })

  it('should use correct hex dimensions for M5', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M5',
      knob_diameter: 20,
      height: 8,
      style: 'Knurled',
      tolerance: 0.1
    })

    // M5 has 8mm hex flat width
    expect(scad).toContain('Screw Specs (M5)')
    expect(scad).toContain('screw_hole_d = 5.2')
  })

  it('should use correct hex dimensions for M8', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M8',
      knob_diameter: 30,
      height: 12,
      style: 'Knurled',
      tolerance: 0.15
    })

    // M8 has 13mm hex flat width
    expect(scad).toContain('Screw Specs (M8)')
    expect(scad).toContain('screw_hole_d = 8.2')
  })

  it('should include through hole for screw shaft', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M3',
      knob_diameter: 15,
      height: 6,
      style: 'Knurled',
      tolerance: 0.15
    })

    expect(scad).toContain('Through Hole')
    expect(scad).toContain('screw_hole_d')
  })

  it('should set $fn for smooth curves', () => {
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M3',
      knob_diameter: 15,
      height: 6,
      style: 'Knurled',
      tolerance: 0.15
    })

    expect(scad).toContain('$fn = 60')
  })

  it('should clamp knob diameter to safe minimum for large screws', () => {
    // M8 has 13mm hex flat, so hex_d ≈ 15mm corner-to-corner
    // Minimum knob_d should be hex_d + 9 ≈ 24mm
    const scad = thumbKnobGenerator.scadTemplate({
      screw_size: 'M8',
      knob_diameter: 15, // Too small for M8
      height: 10,
      style: 'Knurled',
      tolerance: 0.15
    })

    // Should be clamped to at least 24mm (not 15mm)
    expect(scad).not.toContain('knob_d = 15')
    expect(scad).toMatch(/knob_d = 2[4-9]|knob_d = [3-9]\d/)
  })
})

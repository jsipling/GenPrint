import { describe, it, expect } from 'vitest'
import { bracketGenerator } from './bracket'

describe('bracketGenerator', () => {
  it('should have correct metadata', () => {
    expect(bracketGenerator.id).toBe('bracket')
    expect(bracketGenerator.name).toBe('Bracket')
    expect(bracketGenerator.description).toContain('L-bracket')
  })

  it('should have correct parameters defined', () => {
    expect(bracketGenerator.parameters).toHaveLength(9)

    const width = bracketGenerator.parameters.find(p => p.name === 'width')
    expect(width).toBeDefined()
    expect(width?.type).toBe('number')
    expect(width?.default).toBe(30)

    const armLength = bracketGenerator.parameters.find(p => p.name === 'arm_length')
    expect(armLength).toBeDefined()
    expect(armLength?.type).toBe('number')
    expect(armLength?.default).toBe(40)

    const thickness = bracketGenerator.parameters.find(p => p.name === 'thickness')
    expect(thickness).toBeDefined()
    expect(thickness?.type).toBe('number')
    expect(thickness?.default).toBe(4)

    const holeD = bracketGenerator.parameters.find(p => p.name === 'hole_diameter')
    expect(holeD).toBeDefined()
    expect(holeD?.type).toBe('number')
    expect(holeD?.default).toBe(5)

    const holeCountArm1 = bracketGenerator.parameters.find(p => p.name === 'hole_count_arm_1')
    expect(holeCountArm1).toBeDefined()
    expect(holeCountArm1?.type).toBe('number')
    expect(holeCountArm1?.default).toBe(1)

    const holeCountArm2 = bracketGenerator.parameters.find(p => p.name === 'hole_count_arm_2')
    expect(holeCountArm2).toBeDefined()
    expect(holeCountArm2?.type).toBe('number')
    expect(holeCountArm2?.default).toBe(1)

    const addRib = bracketGenerator.parameters.find(p => p.name === 'add_rib')
    expect(addRib).toBeDefined()
    expect(addRib?.type).toBe('boolean')
    expect(addRib?.default).toBe(true)

    const ribThickness = bracketGenerator.parameters.find(p => p.name === 'rib_thickness')
    expect(ribThickness).toBeDefined()
    expect(ribThickness?.type).toBe('number')
    expect(ribThickness?.default).toBe(4)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = bracketGenerator.scadTemplate({
      width: 30,
      arm_length: 40,
      thickness: 4,
      hole_diameter: 5,
      fillet_radius: 5,
      hole_count_arm_1: 1,
      hole_count_arm_2: 1,
      add_rib: true,
      rib_thickness: 4
    })

    expect(scad).toContain('width = 30')
    expect(scad).toContain('arm_length = 40')
    expect(scad).toContain('thickness = 4')
    expect(scad).toContain('hole_d = 5')
    expect(scad).toContain('hole_count_arm_1 = 1')
    expect(scad).toContain('hole_count_arm_2 = 1')
    expect(scad).toContain('add_rib = true')
    expect(scad).toContain('rib_thickness = 4')
  })

  it('should create L-shape with two arms', () => {
    const scad = bracketGenerator.scadTemplate({
      width: 30,
      arm_length: 40,
      thickness: 4,
      hole_diameter: 5,
      fillet_radius: 5,
      hole_count_arm_1: 1,
      hole_count_arm_2: 1,
      add_rib: true,
      rib_thickness: 4
    })

    expect(scad).toContain('cube')
    expect(scad).toContain('union()')
  })

  it('should include mounting holes', () => {
    const scad = bracketGenerator.scadTemplate({
      width: 30,
      arm_length: 40,
      thickness: 4,
      hole_diameter: 5,
      fillet_radius: 5,
      hole_count_arm_1: 1,
      hole_count_arm_2: 1,
      add_rib: true,
      rib_thickness: 4
    })

    expect(scad).toContain('cylinder')
    expect(scad).toContain('hole_d')
  })

  it('should set $fn for smooth holes', () => {
    const scad = bracketGenerator.scadTemplate({
      width: 30,
      arm_length: 40,
      thickness: 4,
      hole_diameter: 5,
      fillet_radius: 5,
      hole_count_arm_1: 1,
      hole_count_arm_2: 1,
      add_rib: true,
      rib_thickness: 4
    })

    expect(scad).toContain('$fn')
  })
})

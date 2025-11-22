import { describe, it, expect } from 'vitest'
import { boxGenerator } from './box'

describe('boxGenerator', () => {
  it('should have correct metadata', () => {
    expect(boxGenerator.id).toBe('box')
    expect(boxGenerator.name).toBe('Box')
    expect(boxGenerator.description).toBe('A customizable box with optional lid')
  })

  it('should have correct parameters defined', () => {
    expect(boxGenerator.parameters).toHaveLength(14)

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

    const includeLid = boxGenerator.parameters.find(p => p.name === 'include_lid')
    expect(includeLid).toBeDefined()
    expect(includeLid?.type).toBe('boolean')
    expect(includeLid?.default).toBe(true)

    const lidHeight = boxGenerator.parameters.find(p => p.name === 'lid_height')
    expect(lidHeight).toBeDefined()
    expect(lidHeight?.type).toBe('number')
    expect(lidHeight?.default).toBe(8)

    const lidClearance = boxGenerator.parameters.find(p => p.name === 'lid_clearance')
    expect(lidClearance).toBeDefined()
    expect(lidClearance?.type).toBe('number')
    expect(lidClearance?.default).toBe(0.2)

    const lidLipHeight = boxGenerator.parameters.find(p => p.name === 'lid_lip_height')
    expect(lidLipHeight).toBeDefined()
    expect(lidLipHeight?.type).toBe('number')
    expect(lidLipHeight?.default).toBe(5)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5
    })

    expect(scad).toContain('width = 50')
    expect(scad).toContain('depth = 50')
    expect(scad).toContain('height = 30')
    expect(scad).toContain('wall_thickness = 2')
    expect(scad).toContain('corner_radius = 3')
    expect(scad).toContain('include_lid = true')
    expect(scad).toContain('lid_height = 8')
    expect(scad).toContain('lid_clearance = 0.2')
    expect(scad).toContain('lid_lip_height = 5')
  })

  it('should generate SCAD code with difference operation for hollow box', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 40,
      height: 25,
      wall_thickness: 3,
      corner_radius: 2,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5
    })

    expect(scad).toContain('difference()')
  })

  it('should use rounded corners module', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 5,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5
    })

    expect(scad).toContain('module rounded_box')
  })

  it('should handle zero corner radius', () => {
    const scad = boxGenerator.scadTemplate({
      width: 50,
      depth: 50,
      height: 30,
      wall_thickness: 2,
      corner_radius: 0,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5
    })

    expect(scad).toContain('corner_radius = 0')
  })

  it('should handle edge case minimum values', () => {
    const scad = boxGenerator.scadTemplate({
      width: 20,
      depth: 20,
      height: 10,
      wall_thickness: 1,
      corner_radius: 0,
      include_lid: false,
      lid_height: 4,
      lid_clearance: 0,
      lid_lip_height: 2
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
      corner_radius: 10,
      include_lid: true,
      lid_height: 20,
      lid_clearance: 0.5,
      lid_lip_height: 10
    })

    expect(scad).toContain('width = 200')
    expect(scad).toContain('depth = 200')
    expect(scad).toContain('height = 100')
  })
  it('should include a lid block when enabled', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 40,
      wall_thickness: 2.5,
      corner_radius: 4,
      include_lid: true,
      lid_height: 10,
      lid_clearance: 0.3,
      lid_lip_height: 6
    })

    expect(scad).toContain('include_lid = true')
    expect(scad).toContain('if (include_lid)')
    expect(scad).toContain('lid_lip_height = 6')
  })

  it('should disable lid when include_lid is false', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 40,
      wall_thickness: 2.5,
      corner_radius: 4,
      include_lid: false,
      lid_height: 10,
      lid_clearance: 0.3,
      lid_lip_height: 6
    })

    expect(scad).toContain('include_lid = false')
    expect(scad).toContain('if (include_lid)')
  })

  it('should clamp wall thickness to keep interior printable', () => {
    const scad = boxGenerator.scadTemplate({
      width: 40,
      depth: 30,
      height: 10,
      wall_thickness: 20,
      corner_radius: 2,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5
    })

    expect(scad).toContain('wall_thickness = 9')
  })

  it('should clamp corner radius so it fits within the box', () => {
    const scad = boxGenerator.scadTemplate({
      width: 30,
      depth: 30,
      height: 20,
      wall_thickness: 5,
      corner_radius: 20,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 2,
      dividers_x: 0,
      dividers_y: 0,
      finger_grip: false,
      stackable: false
    })

    expect(scad).toContain('corner_radius = 10')
  })

  // New feature tests

  it('should have bottom thickness parameter', () => {
    const bottomThickness = boxGenerator.parameters.find(p => p.name === 'bottom_thickness')
    expect(bottomThickness).toBeDefined()
    expect(bottomThickness?.type).toBe('number')
    expect(bottomThickness?.default).toBe(2)
  })

  it('should have divider parameters', () => {
    const dividersX = boxGenerator.parameters.find(p => p.name === 'dividers_x')
    expect(dividersX).toBeDefined()
    expect(dividersX?.type).toBe('number')
    expect(dividersX?.default).toBe(0)

    const dividersY = boxGenerator.parameters.find(p => p.name === 'dividers_y')
    expect(dividersY).toBeDefined()
    expect(dividersY?.type).toBe('number')
    expect(dividersY?.default).toBe(0)
  })

  it('should have finger grip parameter', () => {
    const fingerGrip = boxGenerator.parameters.find(p => p.name === 'finger_grip')
    expect(fingerGrip).toBeDefined()
    expect(fingerGrip?.type).toBe('boolean')
    expect(fingerGrip?.default).toBe(false)
  })

  it('should have stackable parameter', () => {
    const stackable = boxGenerator.parameters.find(p => p.name === 'stackable')
    expect(stackable).toBeDefined()
    expect(stackable?.type).toBe('boolean')
    expect(stackable?.default).toBe(false)
  })

  it('should generate dividers when dividers_x > 0', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 2,
      dividers_x: 2,
      dividers_y: 0,
      finger_grip: false,
      stackable: false
    })

    expect(scad).toContain('dividers_x = 2')
    expect(scad).toContain('module dividers()')
  })

  it('should generate dividers when dividers_y > 0', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 2,
      dividers_x: 0,
      dividers_y: 3,
      finger_grip: false,
      stackable: false
    })

    expect(scad).toContain('dividers_y = 3')
    expect(scad).toContain('module dividers()')
  })

  it('should generate finger grip cutout when enabled', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 2,
      dividers_x: 0,
      dividers_y: 0,
      finger_grip: true,
      stackable: false
    })

    expect(scad).toContain('finger_grip = true')
    expect(scad).toContain('module finger_cutout()')
  })

  it('should generate stackable features when enabled', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 2,
      dividers_x: 0,
      dividers_y: 0,
      finger_grip: false,
      stackable: true
    })

    expect(scad).toContain('stackable = true')
    expect(scad).toContain('module stack_lip()')
  })

  it('should use separate bottom thickness in generated code', () => {
    const scad = boxGenerator.scadTemplate({
      width: 60,
      depth: 60,
      height: 30,
      wall_thickness: 2,
      corner_radius: 3,
      include_lid: true,
      lid_height: 8,
      lid_clearance: 0.2,
      lid_lip_height: 5,
      bottom_thickness: 3,
      dividers_x: 0,
      dividers_y: 0,
      finger_grip: false,
      stackable: false
    })

    expect(scad).toContain('bottom_thickness = 3')
  })
})

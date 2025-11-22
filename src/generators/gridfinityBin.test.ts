import { describe, it, expect } from 'vitest'
import { gridfinityBinGenerator } from './gridfinityBin'
import { flattenParameters, isNumberParam, isSelectParam } from './types'

describe('gridfinityBinGenerator', () => {
  it('should have correct metadata', () => {
    expect(gridfinityBinGenerator.id).toBe('gridfinity_bin')
    expect(gridfinityBinGenerator.name).toBe('Gridfinity Extended Bin')
    expect(gridfinityBinGenerator.description).toBe('Modular storage bin based on Gridfinity Extended')
  })

  it('should have correct parameters defined', () => {
    expect(gridfinityBinGenerator.parameters).toHaveLength(13)
    const allParams = flattenParameters(gridfinityBinGenerator.parameters)
    expect(allParams).toHaveLength(13)

    const gridX = allParams.find(p => p.name === 'grid_x')
    expect(gridX).toBeDefined()
    expect(gridX?.type).toBe('number')
    expect(gridX?.default).toBe(2)

    const gridY = allParams.find(p => p.name === 'grid_y')
    expect(gridY).toBeDefined()
    expect(gridY?.type).toBe('number')
    expect(gridY?.default).toBe(2)

    const gridZ = allParams.find(p => p.name === 'grid_z')
    expect(gridZ).toBeDefined()
    expect(gridZ?.type).toBe('number')
    expect(gridZ?.default).toBe(3)

    const lipStyle = allParams.find(p => p.name === 'lip_style')
    expect(lipStyle).toBeDefined()
    expect(lipStyle?.type).toBe('select')
    expect(lipStyle?.default).toBe('normal')

    const enableMagnets = allParams.find(p => p.name === 'enable_magnets')
    expect(enableMagnets).toBeDefined()
    expect(enableMagnets?.type).toBe('boolean')
    expect(enableMagnets?.default).toBe(false)

    const enableScrews = allParams.find(p => p.name === 'enable_screws')
    expect(enableScrews).toBeDefined()
    expect(enableScrews?.type).toBe('boolean')
    expect(enableScrews?.default).toBe(false)
  })

  it('should have correct Gridfinity constants in generated code', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    // Standard Gridfinity dimensions
    expect(scad).toContain('gf_pitch = 42')
    expect(scad).toContain('gf_zpitch = 7')
    expect(scad).toContain('gf_corner_radius = 3.75')
    expect(scad).toContain('gf_base_height = 5')
    expect(scad).toContain('gf_lip_height = 4.4')
    expect(scad).toContain('gf_magnet_d = 6.5')
    expect(scad).toContain('gf_magnet_h = 2.4')
    expect(scad).toContain('gf_screw_d = 3')
    expect(scad).toContain('gf_screw_h = 6')
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('grid_x = 2')
    expect(scad).toContain('grid_y = 2')
    expect(scad).toContain('grid_z = 3')
    expect(scad).toContain('lip_style = "normal"')
    expect(scad).toContain('enable_magnets = false')
    expect(scad).toContain('enable_screws = false')
    expect(scad).toContain('gridfinity_bin()')
  })

  it('should calculate correct bin dimensions', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 3,
      grid_y: 2,
      grid_z: 4,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    // Verify derived dimensions are calculated
    expect(scad).toContain('bin_width = grid_x * gf_pitch - gf_clearance')
    expect(scad).toContain('bin_depth = grid_y * gf_pitch - gf_clearance')
    expect(scad).toContain('bin_height = grid_z * gf_zpitch + gf_base_height')
  })

  it('should include base unit module for proper Gridfinity profile', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 1,
      grid_y: 1,
      grid_z: 2,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('module base_unit()')
    expect(scad).toContain('gf_base_lower_taper')
    expect(scad).toContain('gf_base_riser')
    expect(scad).toContain('gf_base_upper_taper')
  })

  it('should include magnet holes when enabled', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: true,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('enable_magnets = true')
    expect(scad).toContain('module magnet_hole()')
  })

  it('should include screw holes when enabled', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: true,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('enable_screws = true')
    expect(scad).toContain('module screw_hole()')
  })

  it('should support all lip styles', () => {
    const lipStyles = ['normal', 'reduced', 'minimum', 'none']

    for (const style of lipStyles) {
      const scad = gridfinityBinGenerator.scadTemplate({
        grid_x: 2,
        grid_y: 2,
        grid_z: 3,
        lip_style: style,
        enable_magnets: false,
        enable_screws: false,
        dividers_x: 0,
        dividers_y: 0,
        finger_slide: false,
        wall_thickness: 1.2,
        floor_thickness: 0.7
      })

      expect(scad).toContain(`lip_style = "${style}"`)
    }
  })

  it('should have lip_style as a select parameter with correct options', () => {
    const lipStyle = gridfinityBinGenerator.parameters.find(p => p.name === 'lip_style')
    expect(lipStyle).toBeDefined()
    expect(isSelectParam(lipStyle!)).toBe(true)
    if (isSelectParam(lipStyle!)) {
      expect(lipStyle.options).toEqual(['normal', 'reduced', 'minimum', 'none'])
    }
  })

  it('should include dividers when specified', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 3,
      grid_y: 3,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 2,
      dividers_y: 1,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('dividers_x = 2')
    expect(scad).toContain('dividers_y = 1')
    expect(scad).toContain('module dividers()')
  })

  it('should include finger slide when enabled', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: true,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('finger_slide = true')
    expect(scad).toContain('module finger_slide()')
  })

  it('should have dynamicMax for dividers based on grid size', () => {
    const dividersX = gridfinityBinGenerator.parameters.find(p => p.name === 'dividers_x')
    expect(dividersX).toBeDefined()
    expect(isNumberParam(dividersX!)).toBe(true)
    if (isNumberParam(dividersX!)) {
      expect(dividersX.dynamicMax).toBeDefined()
      // For grid_x = 2, max dividers should be 3 (2*2-1)
      const maxForGrid2 = dividersX.dynamicMax!({ grid_x: 2, grid_y: 2 })
      expect(maxForGrid2).toBe(3)
      // For grid_x = 1, max dividers should be 1 (1*2-1)
      const maxForGrid1 = dividersX.dynamicMax!({ grid_x: 1, grid_y: 1 })
      expect(maxForGrid1).toBe(1)
    }

    const dividersY = gridfinityBinGenerator.parameters.find(p => p.name === 'dividers_y')
    expect(dividersY).toBeDefined()
    expect(isNumberParam(dividersY!)).toBe(true)
    if (isNumberParam(dividersY!)) {
      expect(dividersY.dynamicMax).toBeDefined()
      // For grid_y = 3, max dividers should be 5 (3*2-1)
      const maxForGrid3 = dividersY.dynamicMax!({ grid_x: 2, grid_y: 3 })
      expect(maxForGrid3).toBe(5)
    }
  })

  it('should handle minimum grid size (1x1x1)', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 1,
      grid_y: 1,
      grid_z: 1,
      lip_style: 'normal',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('grid_x = 1')
    expect(scad).toContain('grid_y = 1')
    expect(scad).toContain('grid_z = 1')
    expect(scad).toContain('gridfinity_bin()')
  })

  it('should handle maximum grid size (6x6x10)', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 6,
      grid_y: 6,
      grid_z: 10,
      lip_style: 'normal',
      enable_magnets: true,
      enable_screws: true,
      dividers_x: 5,
      dividers_y: 5,
      finger_slide: true,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('grid_x = 6')
    expect(scad).toContain('grid_y = 6')
    expect(scad).toContain('grid_z = 10')
  })

  it('should have wall_thickness parameter with appropriate limits', () => {
    const wallThickness = gridfinityBinGenerator.parameters.find(p => p.name === 'wall_thickness')
    expect(wallThickness).toBeDefined()
    expect(isNumberParam(wallThickness!)).toBe(true)
    if (isNumberParam(wallThickness!)) {
      expect(wallThickness.min).toBe(0.8)
      expect(wallThickness.max).toBe(2.5)
      expect(wallThickness.default).toBe(1.2)
    }
  })

  it('should have floor_thickness parameter with appropriate limits', () => {
    const floorThickness = gridfinityBinGenerator.parameters.find(p => p.name === 'floor_thickness')
    expect(floorThickness).toBeDefined()
    expect(isNumberParam(floorThickness!)).toBe(true)
    if (isNumberParam(floorThickness!)) {
      expect(floorThickness.min).toBe(0.7)
      expect(floorThickness.max).toBe(3)
      expect(floorThickness.default).toBe(0.7)
    }
  })

  it('should use grid units in parameter descriptions', () => {
    const gridX = gridfinityBinGenerator.parameters.find(p => p.name === 'grid_x')
    expect(gridX).toBeDefined()
    expect(isNumberParam(gridX!)).toBe(true)
    if (isNumberParam(gridX!)) {
      expect(gridX.unit).toBe('units')
      expect(gridX.description).toContain('42mm')
    }
  })

  // Label slot tests
  it('should have label_style parameter with correct options', () => {
    const labelStyle = gridfinityBinGenerator.parameters.find(p => p.name === 'label_style')
    expect(labelStyle).toBeDefined()
    expect(isSelectParam(labelStyle!)).toBe(true)
    if (isSelectParam(labelStyle!)) {
      expect(labelStyle.options).toEqual(['none', 'gflabel', 'pred'])
      expect(labelStyle.default).toBe('none')
    }
  })

  it('should have label_position parameter with correct options', () => {
    const labelPosition = gridfinityBinGenerator.parameters.find(p => p.name === 'label_position')
    expect(labelPosition).toBeDefined()
    expect(isSelectParam(labelPosition!)).toBe(true)
    if (isSelectParam(labelPosition!)) {
      expect(labelPosition.options).toEqual(['front', 'back', 'left', 'right', 'all'])
      expect(labelPosition.default).toBe('front')
    }
  })

  it('should include gflabel label slot modules when enabled', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      label_style: 'gflabel',
      label_position: 'front',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('label_style = "gflabel"')
    expect(scad).toContain('label_position = "front"')
    expect(scad).toContain('module label_slot_gflabel()')
    expect(scad).toContain('module label_cutouts()')
    expect(scad).toContain('gf_label_width = 36.4')
  })

  it('should include pred label slot modules when enabled', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      label_style: 'pred',
      label_position: 'back',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('label_style = "pred"')
    expect(scad).toContain('label_position = "back"')
    expect(scad).toContain('module label_slot_pred()')
    expect(scad).toContain('gf_pred_label_width = 36')
  })

  it('should support all label positions', () => {
    const positions = ['front', 'back', 'left', 'right', 'all']

    for (const position of positions) {
      const scad = gridfinityBinGenerator.scadTemplate({
        grid_x: 2,
        grid_y: 2,
        grid_z: 3,
        lip_style: 'normal',
        label_style: 'gflabel',
        label_position: position,
        enable_magnets: false,
        enable_screws: false,
        dividers_x: 0,
        dividers_y: 0,
        finger_slide: false,
        wall_thickness: 1.2,
        floor_thickness: 0.7
      })

      expect(scad).toContain(`label_position = "${position}"`)
    }
  })

  it('should not include label modules when label_style is none', () => {
    const scad = gridfinityBinGenerator.scadTemplate({
      grid_x: 2,
      grid_y: 2,
      grid_z: 3,
      lip_style: 'normal',
      label_style: 'none',
      label_position: 'front',
      enable_magnets: false,
      enable_screws: false,
      dividers_x: 0,
      dividers_y: 0,
      finger_slide: false,
      wall_thickness: 1.2,
      floor_thickness: 0.7
    })

    expect(scad).toContain('label_style = "none"')
    // Module is still defined but won't render anything when style is none
    expect(scad).toContain('if (label_style != "none"')
  })
})

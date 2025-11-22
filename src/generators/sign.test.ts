import { describe, it, expect } from 'vitest'
import { signGenerator } from './sign'

describe('signGenerator', () => {
  it('should have correct metadata', () => {
    expect(signGenerator.id).toBe('custom-sign')
    expect(signGenerator.name).toBe('Custom Sign')
  })

  it('should generate SCAD code using stroke-based text', () => {
    const scad = signGenerator.scadTemplate({
      text: 'TEST',
      text_size: 12,
      text_depth: 2,
      padding: 5,
      base_depth: 3,
      corner_radius: 2
    })

    // Should use stroke-based font modules
    expect(scad).toContain('stroke_char')
    expect(scad).toContain('stroke_text')
    expect(scad).toContain('draw_path')

    // Should NOT use pixel/cube-based font
    expect(scad).not.toContain('pixel_text')
    expect(scad).not.toContain('pixel_size')
  })

  it('should sanitize text input to allowed characters', () => {
    const scad = signGenerator.scadTemplate({
      text: 'Hello World!',
      text_size: 12,
      text_depth: 2,
      padding: 5,
      base_depth: 3,
      corner_radius: 2
    })

    // Text should be uppercased and included
    expect(scad).toContain('HELLO WORLD!')
  })

  it('should include rounded rectangle base', () => {
    const scad = signGenerator.scadTemplate({
      text: 'HI',
      text_size: 10,
      text_depth: 2,
      padding: 5,
      base_depth: 3,
      corner_radius: 2
    })

    expect(scad).toContain('rounded_rect')
  })

  it('should use cylinders and hull for smooth strokes', () => {
    const scad = signGenerator.scadTemplate({
      text: 'A',
      text_size: 10,
      text_depth: 2,
      padding: 5,
      base_depth: 3,
      corner_radius: 2
    })

    expect(scad).toContain('cylinder')
    expect(scad).toContain('hull')
  })
})

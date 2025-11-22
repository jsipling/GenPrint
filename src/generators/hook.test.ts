import { describe, it, expect } from 'vitest'
import { hookGenerator } from './hook'

describe('hookGenerator', () => {
  it('should have correct metadata', () => {
    expect(hookGenerator.id).toBe('hook')
    expect(hookGenerator.name).toBe('Hook')
    expect(hookGenerator.description).toContain('wall')
  })

  it('should have correct parameters defined', () => {
    expect(hookGenerator.parameters).toHaveLength(5)

    const width = hookGenerator.parameters.find(p => p.name === 'width')
    expect(width).toBeDefined()
    expect(width?.type).toBe('number')
    expect(width?.default).toBe(15)

    const hookDepth = hookGenerator.parameters.find(p => p.name === 'hook_depth')
    expect(hookDepth).toBeDefined()
    expect(hookDepth?.type).toBe('number')
    expect(hookDepth?.default).toBe(25)

    const hookHeight = hookGenerator.parameters.find(p => p.name === 'hook_height')
    expect(hookHeight).toBeDefined()
    expect(hookHeight?.type).toBe('number')
    expect(hookHeight?.default).toBe(30)

    const thickness = hookGenerator.parameters.find(p => p.name === 'thickness')
    expect(thickness).toBeDefined()
    expect(thickness?.type).toBe('number')
    expect(thickness?.default).toBe(5)
  })

  it('should generate valid SCAD code with default parameters', () => {
    const scad = hookGenerator.scadTemplate({
      width: 15,
      hook_depth: 25,
      hook_height: 30,
      thickness: 5,
      hole_diameter: 4
    })

    expect(scad).toContain('width = 15')
    expect(scad).toContain('hook_depth = 25')
    expect(scad).toContain('hook_height = 30')
    expect(scad).toContain('thickness = 5')
  })

  it('should create J-shaped hook profile', () => {
    const scad = hookGenerator.scadTemplate({
      width: 15,
      hook_depth: 25,
      hook_height: 30,
      thickness: 5,
      hole_diameter: 4
    })

    expect(scad).toContain('linear_extrude')
    expect(scad).toContain('polygon')
  })

  it('should include mounting hole', () => {
    const scad = hookGenerator.scadTemplate({
      width: 15,
      hook_depth: 25,
      hook_height: 30,
      thickness: 5,
      hole_diameter: 4
    })

    expect(scad).toContain('cylinder')
    expect(scad).toContain('hole_d')
  })

  it('should set $fn for smooth curves', () => {
    const scad = hookGenerator.scadTemplate({
      width: 15,
      hook_depth: 25,
      hook_height: 30,
      thickness: 5,
      hole_diameter: 4
    })

    expect(scad).toContain('$fn')
  })
})

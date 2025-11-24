import { describe, it, expect } from 'vitest'
import { STROKE_FONT, DOTTED_CHARS, getCharWidth, getCharSpacing } from './strokeFont'

describe('strokeFont', () => {
  it('defines all uppercase letters A-Z', () => {
    for (let i = 65; i <= 90; i++) {
      const char = String.fromCharCode(i)
      expect(STROKE_FONT[char]).toBeDefined()
      expect(Array.isArray(STROKE_FONT[char])).toBe(true)
    }
  })

  it('defines all digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(STROKE_FONT[String(i)]).toBeDefined()
    }
  })

  it('defines special characters', () => {
    expect(STROKE_FONT[' ']).toBeDefined()
    expect(STROKE_FONT['!']).toBeDefined()
    expect(STROKE_FONT['.']).toBeDefined()
    expect(STROKE_FONT['-']).toBeDefined()
  })

  it('marks dotted characters correctly', () => {
    expect(DOTTED_CHARS).toContain('!')
    expect(DOTTED_CHARS).toContain('.')
    expect(DOTTED_CHARS).not.toContain('A')
  })

  it('returns consistent char width', () => {
    expect(getCharWidth()).toBe(4)
  })

  it('returns consistent char spacing', () => {
    expect(getCharSpacing()).toBe(0.7)
  })

  it('all paths have valid structure', () => {
    for (const [, paths] of Object.entries(STROKE_FONT)) {
      expect(Array.isArray(paths)).toBe(true)
      for (const path of paths) {
        expect(Array.isArray(path)).toBe(true)
        for (const point of path) {
          expect(Array.isArray(point)).toBe(true)
          expect(point).toHaveLength(2)
          expect(typeof point[0]).toBe('number')
          expect(typeof point[1]).toBe('number')
        }
      }
    }
  })
})

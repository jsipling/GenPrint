import type { Generator } from './types'

export default {
  id: 'custom-sign',
  name: 'Sign',
  description: 'A customizable sign with raised text',
  parameters: [
    {
      type: 'string',
      name: 'text',
      label: 'Text',
      default: 'HELLO',
      maxLength: 20
    },
    {
      type: 'number',
      name: 'text_size',
      label: 'Text Size',
      min: 8, max: 30, default: 12, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'text_depth',
      label: 'Text Depth',
      min: 1.2, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'padding',
      label: 'Padding',
      min: 2, max: 20, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'base_depth',
      label: 'Base Depth',
      min: 1.2, max: 10, default: 3, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0, max: 10, default: 2, step: 1, unit: 'mm'
    }
  ],
  builderCode: `
// Stroke font data (4x6 unit grid)
const STROKE_FONT = {
  'A': [[[0, 0], [2, 6], [4, 0]], [[0.8, 2], [3.2, 2]]],
  'B': [[[0, 0], [0, 6], [3, 6], [4, 5], [3, 3], [0, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  'C': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1]]],
  'D': [[[0, 0], [0, 6], [2, 6], [4, 4], [4, 2], [2, 0], [0, 0]]],
  'E': [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
  'F': [[[4, 6], [0, 6], [0, 0]], [[0, 3], [3, 3]]],
  'G': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2, 3]]],
  'H': [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  'I': [[[1, 0], [3, 0]], [[1, 6], [3, 6]], [[2, 0], [2, 6]]],
  'J': [[[1, 6], [3, 6]], [[2, 6], [2, 1], [1, 0], [0, 1]]],
  'K': [[[0, 0], [0, 6]], [[4, 6], [0, 3], [4, 0]]],
  'L': [[[0, 6], [0, 0], [4, 0]]],
  'M': [[[0, 0], [0, 6], [2, 3], [4, 6], [4, 0]]],
  'N': [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  'O': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  'P': [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]],
  'Q': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.5, 1.5], [4, 0]]],
  'R': [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[2, 3], [4, 0]]],
  'S': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  'T': [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  'U': [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  'V': [[[0, 6], [2, 0], [4, 6]]],
  'W': [[[0, 6], [1, 0], [2, 3], [3, 0], [4, 6]]],
  'X': [[[0, 0], [4, 6]], [[0, 6], [4, 0]]],
  'Y': [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  'Z': [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  '0': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  '1': [[[1, 5], [2, 6], [2, 0]], [[1, 0], [3, 0]]],
  '2': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [0, 0], [4, 0]]],
  '3': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]], [[1.5, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  '4': [[[3, 0], [3, 6], [0, 2], [4, 2]]],
  '5': [[[4, 6], [0, 6], [0, 3.5], [3, 3.5], [4, 2.5], [4, 1], [3, 0], [1, 0], [0, 1]]],
  '6': [[[3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.5], [3, 3.5], [0, 3.5]]],
  '7': [[[0, 6], [4, 6], [1.5, 0]]],
  '8': [[[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  '9': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 3.5], [1, 2.5], [4, 2.5]]],
  ' ': [],
  '!': [[[2, 2.5], [2, 6]]],
  '.': [],
  '-': [[[0.5, 3], [3.5, 3]]]
}
const DOTTED_CHARS = ['!', '.']

const rawText = String(params['text'] || 'HELLO').toUpperCase().replace(/[^A-Z0-9 !.\\-]/g, '').trim()
const text = rawText.length > 0 ? rawText : 'TEXT'
const textSize = Number(params['text_size']) || 12
const textDepth = Number(params['text_depth']) || 2
const padding = Number(params['padding']) || 5
const baseDepth = Number(params['base_depth']) || 3
const cornerRadius = Number(params['corner_radius']) || 2

const charSpacing = textSize * 0.7
const textWidth = text.length * charSpacing
const baseWidth = textWidth + padding * 2
const baseHeight = textSize + padding * 2
const strokeWidth = textSize * 0.15
const scale = textSize / 6

// Helper to create stroke segment (capsule shape)
function createStrokeSegment(p1, p2, sw, h) {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length < 0.001) {
    return cylinder(h, sw / 2).translate(p1[0], p1[1], 0)
  }
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const radius = sw / 2
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 8
    pts.push([radius * Math.cos(a), radius * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 8
    pts.push([length + radius * Math.cos(a), radius * Math.sin(a)])
  }
  return extrude(pts, h).rotate(0, 0, angle).translate(p1[0], p1[1], 0)
}

// Render single character
function renderChar(char, offX, offY) {
  const paths = STROKE_FONT[char]
  if (!paths || paths.length === 0) {
    if (char === '.') {
      return cylinder(textDepth, strokeWidth / 2).translate(2 * scale + offX, 0.5 * scale + offY, 0)
    }
    return null
  }
  const segments = []
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      segments.push(createStrokeSegment(
        [p1[0] * scale + offX, p1[1] * scale + offY],
        [p2[0] * scale + offX, p2[1] * scale + offY],
        strokeWidth, textDepth
      ))
    }
  }
  if (DOTTED_CHARS.includes(char)) {
    segments.push(cylinder(textDepth, strokeWidth / 2).translate(2 * scale + offX, 0.5 * scale + offY, 0))
  }
  return segments.length > 0 ? union(...segments) : null
}

// Create rounded rect base
function roundedRectProfile(w, h, r) {
  if (r <= 0) return [[0, 0], [w, 0], [w, h], [0, h]]
  const pts = []
  const safeR = Math.min(r, w / 2, h / 2)
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (Math.PI / 2) * i / 8
    pts.push([safeR + safeR * Math.cos(a), safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([w - safeR + safeR * Math.cos(a), safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI / 2) * i / 8
    pts.push([w - safeR + safeR * Math.cos(a), h - safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([safeR + safeR * Math.cos(a), h - safeR + safeR * Math.sin(a)])
  }
  return pts
}

let sign = extrude(roundedRectProfile(baseWidth, baseHeight, cornerRadius), baseDepth)

// Render all characters
const charManifolds = []
for (let i = 0; i < text.length; i++) {
  const char = text[i]
  const charManifold = renderChar(char, padding + i * charSpacing, padding)
  if (charManifold) charManifolds.push(charManifold)
}

if (charManifolds.length > 0) {
  const textManifold = union(...charManifolds).translate(0, 0, baseDepth)
  sign = union(sign, textManifold)
}

return sign
`
} satisfies Generator

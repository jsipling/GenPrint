/**
 * Thumb Knob builder for Manifold
 * A grip handle for standard hex bolts/nuts
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'


// Standard Metric Hex Dimensions (ISO 4014 / DIN 931)
const HEX_SPECS: Record<string, [number, number, number]> = {
  'M3': [3.2, 5.5, 3.0],
  'M4': [4.2, 7.0, 4.0],
  'M5': [5.2, 8.0, 5.0],
  'M6': [6.2, 10.0, 6.0],
  'M8': [8.2, 13.0, 8.0]
}

/**
 * Create knurled profile (circle with small indents around perimeter)
 */
function knurledProfile(M: ManifoldToplevel, diameter: number): CrossSection {
  const radius = diameter / 2
  const count = Math.min(Math.round(diameter * 1.5), 24) // Cap segments for performance
  const indentRadius = 1.5 // Minimum for reliable FDM printing

  // Start with circle points
  const segments = Math.max(48, count * 2)
  const points: [number, number][] = []

  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    // Check if we're near a knurl indent position
    const knurlIndex = Math.round((i / segments) * count) % count
    const knurlAngle = (2 * Math.PI * knurlIndex) / count
    const angleDiff = Math.abs(angle - knurlAngle)

    let r = radius
    if (angleDiff < 0.15 || angleDiff > 2 * Math.PI - 0.15) {
      // Create indent
      r = radius - indentRadius * 0.5
    }

    points.push([r * Math.cos(angle), r * Math.sin(angle)])
  }

  return new M.CrossSection([points])
}

/**
 * Create lobed profile (3 overlapping circles)
 */
function lobedProfile(M: ManifoldToplevel, diameter: number): CrossSection {
  const lobeRadius = diameter / 3.6
  const lobeOffset = diameter / 4

  // Create 3 circles and union them
  const points: [number, number][] = []
  const segments = 64

  // Create hull of 3 circles - approximate with a smooth shape
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments

    // Find the outermost point considering all 3 lobes
    let maxR = 0
    for (let lobe = 0; lobe < 3; lobe++) {
      const lobeAngle = (2 * Math.PI * lobe) / 3
      const lx = lobeOffset * Math.cos(lobeAngle)
      const ly = lobeOffset * Math.sin(lobeAngle)

      // Distance from center point on angle to this lobe center
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      // Project lobe center onto ray and calculate distance
      const proj = lx * dx + ly * dy
      const perpDist = Math.sqrt(lx * lx + ly * ly - proj * proj)

      if (perpDist < lobeRadius) {
        const r = proj + Math.sqrt(lobeRadius * lobeRadius - perpDist * perpDist)
        maxR = Math.max(maxR, r)
      }
    }

    if (maxR > 0) {
      points.push([maxR * Math.cos(angle), maxR * Math.sin(angle)])
    }
  }

  return new M.CrossSection([points])
}

/**
 * Create hexagonal profile
 */
function hexagonalProfile(M: ManifoldToplevel, diameter: number): CrossSection {
  const radius = diameter / 2
  const points: [number, number][] = []

  for (let i = 0; i < 6; i++) {
    const angle = (2 * Math.PI * i) / 6 + Math.PI / 6 // Rotated 30 degrees
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }

  return new M.CrossSection([points])
}

export function buildThumbKnob(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const size = String(params['screw_size']) || 'M3'
  const knobD = Number(params['knob_diameter']) || 15
  const height = Number(params['height']) || 6
  const style = String(params['style']) || 'Knurled'
  const tolerance = Number(params['tolerance']) || 0.15

  // Get hex specs
  const specs = HEX_SPECS[size] || HEX_SPECS['M3']!
  const holeD = specs[0] + 0.2 // Clearance
  const hexFlat = specs[1] + tolerance * 2
  const hexDepth = specs[2]

  // Convert flat-to-flat to corner-to-corner
  const hexD = hexFlat / 0.866025

  // Ensure knob is large enough
  const minKnobD = hexD + 9
  const safeKnobD = Math.max(knobD, minKnobD)

  // Create outer knob shape based on style
  let knobProfile: CrossSection
  if (style === 'Lobed') {
    knobProfile = lobedProfile(M, safeKnobD)
  } else if (style === 'Hexagonal') {
    knobProfile = hexagonalProfile(M, safeKnobD)
  } else {
    // Knurled (default)
    knobProfile = knurledProfile(M, safeKnobD)
  }

  let knob = knobProfile.extrude(height)
  knobProfile.delete()

  // Create hex socket (bottom)
  const hexSocket = M.Manifold.cylinder(hexDepth + 0.2, hexD / 2, hexD / 2, 6)
    .translate(0, 0, -0.1)

  let newKnob = knob.subtract(hexSocket)
  knob.delete()
  hexSocket.delete()
  knob = newKnob

  // Create through hole for screw shaft
  const throughHole = M.Manifold.cylinder(height + 1, holeD / 2, holeD / 2, 0)
    .translate(0, 0, hexDepth - 0.1)

  newKnob = knob.subtract(throughHole)
  knob.delete()
  throughHole.delete()
  knob = newKnob

  // Chamfer the top edge using a torus-like shape
  const chamferSize = 1
  const chamferProfile: [number, number][] = []
  const chamferSegments = 16
  for (let i = 0; i <= chamferSegments; i++) {
    const angle = (Math.PI / 2) * (i / chamferSegments)
    chamferProfile.push([
      safeKnobD / 2 - chamferSize + chamferSize * Math.cos(angle),
      chamferSize * Math.sin(angle)
    ])
  }
  chamferProfile.push([safeKnobD / 2, 0])
  chamferProfile.push([safeKnobD / 2 + 1, 0])
  chamferProfile.push([safeKnobD / 2 + 1, chamferSize + 1])
  chamferProfile.push([0, chamferSize + 1])
  chamferProfile.push([0, 0])

  const chamferCross = new M.CrossSection([chamferProfile])
  const chamfer = chamferCross.revolve().translate(0, 0, height - chamferSize)
  chamferCross.delete()

  newKnob = knob.subtract(chamfer)
  knob.delete()
  chamfer.delete()
  knob = newKnob

  return knob
}

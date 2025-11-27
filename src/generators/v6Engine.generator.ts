import type { Generator } from './types'

const v6EngineGenerator: Generator = {
  id: 'v6-engine',
  name: 'V6 Engine',
  description: 'A V6 engine with two banks of 3 cylinders at 90 degrees',
  parameters: [
    {
      type: 'number',
      name: 'cylinder_bore',
      label: 'Cylinder Bore',
      min: 10,
      max: 50,
      default: 20,
      step: 1,
      unit: 'mm',
      description: 'Diameter of each cylinder bore'
    },
    {
      type: 'number',
      name: 'cylinder_stroke',
      label: 'Cylinder Stroke',
      min: 15,
      max: 60,
      default: 30,
      step: 1,
      unit: 'mm',
      description: 'Stroke length (piston travel distance)'
    },
    {
      type: 'number',
      name: 'cylinder_spacing',
      label: 'Cylinder Spacing',
      min: 5,
      max: 30,
      default: 15,
      step: 1,
      unit: 'mm',
      description: 'Distance between cylinder centers along the bank'
    },
    {
      type: 'number',
      name: 'bank_angle',
      label: 'Bank Angle',
      min: 45,
      max: 120,
      default: 90,
      step: 5,
      unit: '°',
      description: 'Angle between the two cylinder banks'
    },
    {
      type: 'number',
      name: 'crankshaft_diameter',
      label: 'Crankshaft Diameter',
      min: 4,
      max: 12,
      default: 8,
      step: 0.5,
      unit: 'mm',
      description: 'Main journal diameter'
    },
    {
      type: 'number',
      name: 'connecting_rod_length',
      label: 'Connecting Rod Length',
      min: 20,
      max: 80,
      default: 50,
      step: 2,
      unit: 'mm',
      description: 'Length of connecting rods'
    },
    {
      type: 'boolean',
      name: 'show_pistons',
      label: 'Show Pistons',
      default: true,
      description: 'Display piston heads in the model'
    },
    {
      type: 'boolean',
      name: 'show_connecting_rods',
      label: 'Show Connecting Rods',
      default: true,
      description: 'Display connecting rods between pistons and crankshaft'
    }
  ],
  builderCode: `
const cylinderBore = Number(params['cylinder_bore']) || 20
const cylinderStroke = Number(params['cylinder_stroke']) || 30
const cylinderSpacing = Number(params['cylinder_spacing']) || 15
const bankAngle = Number(params['bank_angle']) || 90
const crankshaftDiameter = Number(params['crankshaft_diameter']) || 8
const connectingRodLength = Number(params['connecting_rod_length']) || 50
const showPistons = Boolean(params['show_pistons'])
const showConnectingRods = Boolean(params['show_connecting_rods'])

const halfBankAngle = bankAngle / 2
const cylinderRadius = cylinderBore / 2
const crankRadius = crankshaftDiameter / 2
const rodRadius = 1.5

// Build a single cylinder bank with 3 cylinders
function buildCylinderBank() {
  const partsToUnion = []

  // Create three cylinder assemblies positioned along the bank
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * cylinderSpacing

    // Create cylinder (positioned to sit above the connection point)
    const cyl = cylinder(cylinderStroke, cylinderRadius)
      .translate(offset, cylinderStroke / 2, 0)
    partsToUnion.push(cyl)

    // Add piston if requested
    if (showPistons) {
      const pistonRadius = cylinderRadius * 0.9
      const pistonThickness = 5
      const piston = cylinder(pistonThickness, pistonRadius)
        .translate(offset, cylinderStroke + pistonThickness / 2, 0)
      partsToUnion.push(piston)
    }

    // Add connecting rod if requested
    if (showConnectingRods) {
      // Rod connects from piston area down to crankshaft
      // Position it so it overlaps with the crankshaft
      const rod = cylinder(connectingRodLength, rodRadius)
        .rotate(90, 0, 0)
        .translate(offset, connectingRodLength / 2, 0)
      partsToUnion.push(rod)
    }
  }

  // Union all parts together
  if (partsToUnion.length > 0) {
    return union(...partsToUnion)
  }
  return partsToUnion[0]
}

// Build the crankshaft (shared between banks)
function buildCrankshaft() {
  // Main crankshaft running along X axis
  const crankLength = 100
  const shaft = cylinder(crankLength, crankRadius)
    .rotate(0, 0, 90)
  return shaft
}

// Build the complete engine
function buildEngine() {
  // Build crankshaft first (central element)
  const crankshaft = buildCrankshaft()

  // Build first bank (positioned above crankshaft)
  const bank1 = buildCylinderBank()
    .rotate(-halfBankAngle, 0, 0)
    .translate(0, 0, 20)

  // Build second bank (mirrored along X, positioned below crankshaft)
  const bank2 = buildCylinderBank()
    .rotate(halfBankAngle, 0, 0)
    .translate(0, 0, -20)

  // Assemble engine - union all parts
  return union(crankshaft, bank1, bank2)
}

return buildEngine()
  `
}

export default v6EngineGenerator

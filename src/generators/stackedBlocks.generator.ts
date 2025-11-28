import type { Generator } from './types'

const generator: Generator = {
  id: 'stacked-blocks',
  name: 'Stacked Blocks',
  description: 'Example multi-part model with three stacked blocks that can be individually highlighted.',
  parameters: [
    {
      type: 'number',
      name: 'baseSize',
      label: 'Base Size',
      min: 20,
      max: 100,
      default: 50,
      step: 5,
      unit: 'mm',
      description: 'Width and depth of the base block'
    },
    {
      type: 'number',
      name: 'blockHeight',
      label: 'Block Height',
      min: 10,
      max: 50,
      default: 20,
      step: 5,
      unit: 'mm',
      description: 'Height of each block'
    },
    {
      type: 'number',
      name: 'shrinkFactor',
      label: 'Shrink Factor',
      min: 0.5,
      max: 0.9,
      default: 0.7,
      step: 0.05,
      description: 'How much smaller each block is compared to the one below'
    }
  ],
  builderCode: `
    // Multi-part generator example
    var baseSize = Number(params['baseSize']) || 50
    var blockHeight = Number(params['blockHeight']) || 20
    var shrinkFactor = Number(params['shrinkFactor']) || 0.7

    var parts = []
    var currentZ = 0
    var currentSize = baseSize

    // Base block
    var base = M.Manifold.cube([currentSize, currentSize, blockHeight], true)
    var baseTranslated = base.translate(0, 0, currentZ + blockHeight / 2)
    base.delete()
    parts.push({
      name: 'Base Block',
      manifold: baseTranslated,
      dimensions: [
        { label: 'Size', param: 'size', format: '{value}mm' },
        { label: 'Height', param: 'height', format: '{value}mm' }
      ],
      params: { size: currentSize, height: blockHeight }
    })

    currentZ += blockHeight
    currentSize *= shrinkFactor

    // Middle block
    var middle = M.Manifold.cube([currentSize, currentSize, blockHeight], true)
    var middleTranslated = middle.translate(0, 0, currentZ + blockHeight / 2)
    middle.delete()
    parts.push({
      name: 'Middle Block',
      manifold: middleTranslated,
      dimensions: [
        { label: 'Size', param: 'size', format: '{value}mm' },
        { label: 'Height', param: 'height', format: '{value}mm' }
      ],
      params: { size: currentSize, height: blockHeight }
    })

    currentZ += blockHeight
    currentSize *= shrinkFactor

    // Top block
    var top = M.Manifold.cube([currentSize, currentSize, blockHeight], true)
    var topTranslated = top.translate(0, 0, currentZ + blockHeight / 2)
    top.delete()
    parts.push({
      name: 'Top Block',
      manifold: topTranslated,
      dimensions: [
        { label: 'Size', param: 'size', format: '{value}mm' },
        { label: 'Height', param: 'height', format: '{value}mm' }
      ],
      params: { size: currentSize, height: blockHeight }
    })

    return parts
  `
}

export default generator

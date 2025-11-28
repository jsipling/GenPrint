#!/usr/bin/env npx tsx

/**
 * CLI entry point for the printability analyzer.
 *
 * Usage:
 *   npm run analyze:print <generator-id> [--param=value ...]
 *
 * Examples:
 *   npm run analyze:print v8-engine
 *   npm run analyze:print v8-engine -- --bore=50 --wallThickness=1.0
 */

import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Module from 'manifold-3d'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import type { Generator, ParameterDef, ParameterValues } from '../src/generators/types'
import { isBooleanParam, flattenParameters } from '../src/generators/types'
import { safeAnalyze } from '../src/analysis/printabilityAnalyzer'
import { formatOutput } from '../src/analysis/outputFormatter'
import { MIN_WALL_THICKNESS } from '../src/generators/manifold/printingConstants'
import type { AnalysisResult } from '../src/analysis/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const generatorsDir = join(__dirname, '..', 'src', 'generators')

/**
 * Dynamically load all generators from the generators directory.
 */
async function loadGenerators(): Promise<Map<string, Generator>> {
  const generators = new Map<string, Generator>()

  const files = readdirSync(generatorsDir).filter((f) => f.endsWith('.generator.ts'))

  for (const file of files) {
    try {
      const modulePath = join(generatorsDir, file)
      const module = await import(modulePath)
      if (module.default && module.default.id) {
        generators.set(module.default.id, module.default)
      }
    } catch {
      // Skip files that fail to import
    }
  }

  return generators
}

/**
 * Parse command line arguments into parameter values.
 */
function parseArgs(args: string[], paramDefs: ParameterDef[]): ParameterValues {
  const values: ParameterValues = {}
  const flatParams = flattenParameters(paramDefs)

  // Start with default values
  for (const param of flatParams) {
    values[param.name] = param.default
  }

  // Parse CLI arguments (--param=value format)
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      if (key && value !== undefined) {
        const param = flatParams.find((p) => p.name === key)
        if (param) {
          if (isBooleanParam(param)) {
            values[key] = value === 'true' || value === '1'
          } else if (param.type === 'number') {
            values[key] = parseFloat(value)
          } else {
            values[key] = value
          }
        }
      }
    }
  }

  return values
}

/**
 * Build geometry from a generator and parameters.
 */
function buildGeometry(
  M: ManifoldToplevel,
  generator: Generator,
  params: ParameterValues
): Manifold {
  // Set circular segments for quality
  M.setCircularSegments(48)

  // Create the build function from the generator's code
  const buildFn = new Function('M', 'MIN_WALL_THICKNESS', 'params', generator.builderCode)

  // Execute the builder
  const result = buildFn(M, MIN_WALL_THICKNESS, params)

  // Return the manifold (handle both direct return and object with build method)
  if (result && typeof result.build === 'function') {
    return result.build()
  }
  return result as Manifold
}

/**
 * Output an error result as JSON.
 */
function outputError(type: 'INVALID_INPUT' | 'INTERNAL', message: string): void {
  const result: AnalysisResult = {
    status: 'ERROR',
    stats: null,
    issues: null,
    parameterCorrelations: null,
    error: {
      type,
      message,
      recoverable: type === 'INVALID_INPUT',
    },
  }
  console.log(formatOutput(result))
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Get generator ID (first non-flag argument)
  const generatorId = args.find((a) => !a.startsWith('--'))

  if (!generatorId) {
    outputError('INVALID_INPUT', 'Usage: npm run analyze:print <generator-id> [--param=value ...]')
    process.exit(1)
  }

  // Load generators
  const generators = await loadGenerators()
  const generator = generators.get(generatorId)

  if (!generator) {
    const available = Array.from(generators.keys()).join(', ')
    outputError('INVALID_INPUT', `Generator "${generatorId}" not found. Available: ${available}`)
    process.exit(1)
  }

  // Parse parameters
  const params = parseArgs(args, generator.parameters)

  // Initialize Manifold
  let M: ManifoldToplevel
  try {
    M = await Module()
    M.setup()
  } catch (err) {
    outputError('INTERNAL', `Failed to initialize Manifold: ${err}`)
    process.exit(1)
  }

  // Build geometry
  let manifold: Manifold
  try {
    manifold = buildGeometry(M, generator, params)
  } catch (err) {
    outputError(
      'GEOMETRY_CRASH' as 'INTERNAL',
      `Failed to build geometry: ${err instanceof Error ? err.message : String(err)}`
    )
    process.exit(1)
  }

  // Extract number parameters for correlation
  const numberParams: Record<string, number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number') {
      numberParams[key] = value
    }
  }

  // Run analysis
  const result = safeAnalyze(manifold, generator.parameters, numberParams)

  // Output result
  console.log(formatOutput(result))

  // Clean up
  manifold.delete()

  // Exit with appropriate code
  process.exit(result.status === 'PASS' ? 0 : 1)
}

main().catch((err) => {
  outputError('INTERNAL', `Unexpected error: ${err}`)
  process.exit(1)
})

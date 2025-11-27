/**
 * Types for user-created generators
 */
import type { ParameterDef } from './types'

/**
 * User generator definition
 * Stores the code and metadata for a user-created generator
 */
export interface UserGeneratorDef {
  /** Unique identifier */
  id: string

  /** Display name */
  name: string

  /** Description of what the generator creates */
  description: string

  /** Parameter definitions for the UI */
  parameters: ParameterDef[]

  /** The generated TypeScript builder code */
  builderCode: string

  /** When the generator was created */
  createdAt: string // ISO date string for JSON serialization

  /** When the generator was last modified */
  updatedAt: string

  /** Source of the generator */
  source: 'ai' | 'manual'

  /** Optional version for tracking changes */
  version?: number
}

/**
 * Minimal info for generator list display
 */
export interface UserGeneratorSummary {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  source: 'ai' | 'manual'
}

/**
 * Result of validating builder code
 */
export interface CodeValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Result of executing a user generator
 */
export interface UserGeneratorResult {
  success: boolean
  error?: string
  timing?: number
}

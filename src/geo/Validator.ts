/**
 * Validator - Pre-render validation for GeoNode trees
 *
 * Checks for common LLM errors before compilation:
 * 1. Floating parts - Union of non-intersecting shapes (future enhancement)
 * 2. Zero-thickness walls - Dimensions below minimum wall thickness
 * 3. Non-intersecting subtraction - Subtraction tool doesn't overlap target
 *
 * Warnings are non-blocking: geometry is still renderable, but the user is informed.
 */

import type { GeoNode } from './types';

/**
 * Types of validation warnings
 */
export type ValidationWarningType =
  | 'floating_geometry'
  | 'thin_wall'
  | 'non_intersecting_subtraction';

/**
 * A single validation warning
 */
export interface ValidationWarning {
  /** Type of the validation issue */
  type: ValidationWarningType;
  /** Human-readable description of the issue */
  message: string;
  /** Severity level - warnings don't block rendering */
  severity: 'warning' | 'info';
  /** Reference to the problematic node */
  node?: GeoNode;
}

/**
 * Result of validating a GeoNode tree
 */
export interface ValidationResult {
  /** Always true - warnings don't block rendering */
  valid: boolean;
  /** List of validation warnings (may be empty) */
  warnings: ValidationWarning[];
}

/**
 * Options for the Validator
 */
export interface ValidatorOptions {
  /** Minimum wall thickness in mm (default: 0.4mm for FDM printing) */
  minWallThickness?: number;
}

/**
 * Validator for GeoNode trees
 *
 * Performs pre-render checks to catch common LLM geometry errors.
 * Warnings are informational and do not prevent rendering.
 *
 * @example
 * ```typescript
 * const validator = new Validator({ minWallThickness: 0.4 });
 * const result = validator.validate(shape.getNode());
 *
 * if (result.warnings.length > 0) {
 *   console.warn('Validation warnings:', result.warnings);
 * }
 *
 * // Proceed with compilation regardless of warnings
 * const manifold = compiler.compile(shape.getNode());
 * ```
 */
export class Validator {
  private minWall: number;

  constructor(options: ValidatorOptions = {}) {
    this.minWall = options.minWallThickness ?? 0.4;
  }

  /**
   * Validate a GeoNode tree before compilation
   *
   * @param node The root node to validate
   * @returns Validation result with warnings (always valid=true)
   */
  validate(node: GeoNode): ValidationResult {
    const warnings: ValidationWarning[] = [];
    this.validateNode(node, warnings);
    return {
      valid: true, // Always renderable - warnings are informational
      warnings
    };
  }

  /**
   * Recursively validate a node and its children
   */
  private validateNode(node: GeoNode, warnings: ValidationWarning[]): void {
    switch (node.type) {
      case 'primitive':
        this.validatePrimitive(node, warnings);
        break;
      case 'operation':
        // Recursively validate children first
        node.children.forEach(child => this.validateNode(child, warnings));
        // Then check operation-specific issues
        this.validateOperation(node, warnings);
        break;
      case 'transform':
        this.validateNode(node.child, warnings);
        break;
    }
  }

  /**
   * Validate a primitive node for degenerate or problematic dimensions
   */
  private validatePrimitive(
    node: GeoNode & { type: 'primitive' },
    warnings: ValidationWarning[]
  ): void {
    if (node.shape === 'box') {
      this.validateBox(node, warnings);
    } else if (node.shape === 'cylinder') {
      this.validateCylinder(node, warnings);
    }
  }

  /**
   * Validate a box primitive
   */
  private validateBox(
    node: GeoNode & { type: 'primitive'; shape: 'box' },
    warnings: ValidationWarning[]
  ): void {
    const { width, depth, height } = node;

    // Check for zero or negative dimensions
    if (width <= 0 || depth <= 0 || height <= 0) {
      warnings.push({
        type: 'thin_wall',
        message: `Box has invalid dimensions: ${width}x${depth}x${height}`,
        severity: 'warning',
        node
      });
      return; // Don't add additional thin wall warning for invalid dimensions
    }

    // Check for very thin dimensions
    const minDimension = Math.min(width, depth, height);
    if (minDimension < this.minWall) {
      warnings.push({
        type: 'thin_wall',
        message: `Box dimension below minimum wall thickness (${this.minWall}mm): ${minDimension}mm`,
        severity: 'warning',
        node
      });
    }
  }

  /**
   * Validate a cylinder primitive
   */
  private validateCylinder(
    node: GeoNode & { type: 'primitive'; shape: 'cylinder' },
    warnings: ValidationWarning[]
  ): void {
    const { diameter, height } = node;

    // Check for zero or negative dimensions
    if (diameter <= 0 || height <= 0) {
      warnings.push({
        type: 'thin_wall',
        message: `Cylinder has invalid dimensions: diameter=${diameter}, height=${height}`,
        severity: 'warning',
        node
      });
      return; // Don't add additional thin wall warning for invalid dimensions
    }

    // Check for very thin dimensions
    if (diameter < this.minWall) {
      warnings.push({
        type: 'thin_wall',
        message: `Cylinder diameter below minimum wall thickness (${this.minWall}mm): ${diameter}mm`,
        severity: 'warning',
        node
      });
    } else if (height < this.minWall) {
      warnings.push({
        type: 'thin_wall',
        message: `Cylinder height below minimum wall thickness (${this.minWall}mm): ${height}mm`,
        severity: 'warning',
        node
      });
    }
  }

  /**
   * Validate an operation node
   */
  private validateOperation(
    node: GeoNode & { type: 'operation' },
    warnings: ValidationWarning[]
  ): void {
    if (node.op === 'subtract') {
      // Subtraction requires at least 2 children (base and tool)
      if (node.children.length < 2) {
        warnings.push({
          type: 'non_intersecting_subtraction',
          message: 'Subtraction requires at least 2 shapes (base and tool)',
          severity: 'warning',
          node
        });
      }
      // Future: Could add bounding box overlap check here
    }

    // Future enhancements:
    // - For 'union': Check if shapes actually intersect (floating geometry warning)
    // - For 'subtract': Check if tool overlaps base (non_intersecting_subtraction)
    // - For 'intersect': Check if intersection would be empty
  }
}

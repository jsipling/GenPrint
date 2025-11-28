/**
 * Matrix and vector math utilities for geometry transformations
 */

import type { Vector3, Matrix4x4, Anchor, AlignMode } from './types';

/** Identity matrix - no transformation */
export const IDENTITY_MATRIX: Matrix4x4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

// ============================================================================
// Vector Operations
// ============================================================================

/** Calculate the length (magnitude) of a vector */
export function vectorLength(v: Vector3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/** Normalize a vector to unit length */
export function normalizeVector(v: Vector3): Vector3 {
  const len = vectorLength(v);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Calculate the dot product of two vectors */
export function dotProduct(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Calculate the cross product of two vectors */
export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

/** Negate a vector (reverse direction) */
export function negateVector(v: Vector3): Vector3 {
  return [-v[0], -v[1], -v[2]];
}

// ============================================================================
// Matrix Creation
// ============================================================================

/** Create a translation matrix */
export function translationMatrix(x: number, y: number, z: number): Matrix4x4 {
  return [
    1, 0, 0, x,
    0, 1, 0, y,
    0, 0, 1, z,
    0, 0, 0, 1
  ];
}

/**
 * Create a rotation matrix from Euler angles (degrees, XYZ order)
 *
 * Applies rotations in order: X, then Y, then Z
 */
export function rotationMatrix(rx: number, ry: number, rz: number): Matrix4x4 {
  // Convert to radians
  const radX = (rx * Math.PI) / 180;
  const radY = (ry * Math.PI) / 180;
  const radZ = (rz * Math.PI) / 180;

  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);

  // Rotation around X axis
  const rotX: Matrix4x4 = [
    1, 0, 0, 0,
    0, cosX, -sinX, 0,
    0, sinX, cosX, 0,
    0, 0, 0, 1
  ];

  // Rotation around Y axis
  const rotY: Matrix4x4 = [
    cosY, 0, sinY, 0,
    0, 1, 0, 0,
    -sinY, 0, cosY, 0,
    0, 0, 0, 1
  ];

  // Rotation around Z axis
  const rotZ: Matrix4x4 = [
    cosZ, -sinZ, 0, 0,
    sinZ, cosZ, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];

  // Combined: Z * Y * X (applied right to left)
  return multiplyMatrices(multiplyMatrices(rotZ, rotY), rotX);
}

// ============================================================================
// Matrix Operations
// ============================================================================

/** Multiply two 4x4 matrices (a * b) */
export function multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
  const result: number[] = [];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 4 + k]! * b[k * 4 + col]!;
      }
      result.push(sum);
    }
  }

  return result as Matrix4x4;
}

/** Apply a transformation matrix to a point (includes translation) */
export function transformPoint(point: Vector3, matrix: Matrix4x4): Vector3 {
  const x = point[0];
  const y = point[1];
  const z = point[2];

  return [
    matrix[0]! * x + matrix[1]! * y + matrix[2]! * z + matrix[3]!,
    matrix[4]! * x + matrix[5]! * y + matrix[6]! * z + matrix[7]!,
    matrix[8]! * x + matrix[9]! * y + matrix[10]! * z + matrix[11]!
  ];
}

/** Apply a transformation matrix to a direction (ignores translation) */
export function transformDirection(direction: Vector3, matrix: Matrix4x4): Vector3 {
  const x = direction[0];
  const y = direction[1];
  const z = direction[2];

  return [
    matrix[0]! * x + matrix[1]! * y + matrix[2]! * z,
    matrix[4]! * x + matrix[5]! * y + matrix[6]! * z,
    matrix[8]! * x + matrix[9]! * y + matrix[10]! * z
  ];
}

// ============================================================================
// Alignment Functions
// ============================================================================

/**
 * Calculate a rotation matrix that aligns one vector to another
 *
 * Uses Rodrigues' rotation formula
 */
export function alignVectors(from: Vector3, to: Vector3): Matrix4x4 {
  const fromNorm = normalizeVector(from);
  const toNorm = normalizeVector(to);

  const dot = dotProduct(fromNorm, toNorm);

  // Already aligned
  if (dot > 0.9999) {
    return IDENTITY_MATRIX;
  }

  // Opposite directions - rotate 180 degrees around any perpendicular axis
  if (dot < -0.9999) {
    // Find a perpendicular axis
    let perp: Vector3;
    if (Math.abs(fromNorm[0]) < 0.9) {
      perp = crossProduct(fromNorm, [1, 0, 0]);
    } else {
      perp = crossProduct(fromNorm, [0, 1, 0]);
    }
    perp = normalizeVector(perp);

    // 180 degree rotation around perpendicular axis (Rodrigues formula with theta = pi)
    // R = 2 * (n * n^T) - I
    const nx = perp[0];
    const ny = perp[1];
    const nz = perp[2];

    return [
      2 * nx * nx - 1, 2 * nx * ny, 2 * nx * nz, 0,
      2 * ny * nx, 2 * ny * ny - 1, 2 * ny * nz, 0,
      2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1, 0,
      0, 0, 0, 1
    ];
  }

  // General case: use Rodrigues' rotation formula
  const cross = crossProduct(fromNorm, toNorm);
  const s = vectorLength(cross); // sin(angle)
  const c = dot; // cos(angle)

  // Skew-symmetric cross-product matrix K
  const kx = cross[0];
  const ky = cross[1];
  const kz = cross[2];

  // R = I + K + K^2 * (1 - c) / s^2
  // Simplified using: K^2 = v * v^T - I * |v|^2
  const factor = (1 - c) / (s * s);

  return [
    1 + factor * (-ky * ky - kz * kz), -kz + factor * kx * ky, ky + factor * kx * kz, 0,
    kz + factor * ky * kx, 1 + factor * (-kx * kx - kz * kz), -kx + factor * ky * kz, 0,
    -ky + factor * kz * kx, kx + factor * kz * ky, 1 + factor * (-kx * kx - ky * ky), 0,
    0, 0, 0, 1
  ];
}

/**
 * Calculate the complete alignment transformation
 *
 * - 'mate': self anchor direction will oppose target anchor direction
 * - 'flush': self anchor direction will align with target anchor direction
 *
 * The transformation will:
 * 1. Rotate self anchor direction to match target (considering mode)
 * 2. Translate so self anchor position moves to target anchor position
 * 3. Apply optional offset
 */
export function calculateAlignmentTransform(
  selfAnchor: Anchor,
  targetAnchor: Anchor,
  mode: AlignMode,
  offset?: { x?: number; y?: number; z?: number }
): Matrix4x4 {
  // Determine target direction based on mode
  const targetDir = mode === 'mate'
    ? negateVector(targetAnchor.direction)
    : targetAnchor.direction;

  // Step 1: Rotation to align directions
  const rotation = alignVectors(selfAnchor.direction, targetDir);

  // Step 2: Calculate where self anchor position ends up after rotation
  const rotatedSelfPos = transformPoint(selfAnchor.position, rotation);

  // Step 3: Translation to move rotated self position to target position
  const dx = targetAnchor.position[0] - rotatedSelfPos[0] + (offset?.x ?? 0);
  const dy = targetAnchor.position[1] - rotatedSelfPos[1] + (offset?.y ?? 0);
  const dz = targetAnchor.position[2] - rotatedSelfPos[2] + (offset?.z ?? 0);

  const translation = translationMatrix(dx, dy, dz);

  // Combine: first rotate, then translate
  return multiplyMatrices(translation, rotation);
}

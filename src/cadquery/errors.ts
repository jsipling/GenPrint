/**
 * Base error for CadQuery wrapper operations.
 */
export class CadQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadQueryError'
  }
}

/**
 * Thrown when an operation is not supported by the Manifold backend.
 */
export class UnsupportedOperationError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedOperationError'
  }
}

/**
 * Thrown when a selector fails to match or is invalid.
 */
export class SelectorError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'SelectorError'
  }
}

/**
 * Thrown when geometry operations fail.
 */
export class GeometryError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'GeometryError'
  }
}

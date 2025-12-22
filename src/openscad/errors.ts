/**
 * Base error for OpenSCAD operations.
 */
export class OpenSCADError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSCADError'
  }
}

/**
 * Thrown when lexical analysis fails (invalid tokens).
 */
export class OpenSCADLexError extends OpenSCADError {
  line: number
  column: number
  found: string

  constructor(message: string, line: number, column: number, found: string) {
    super(message)
    this.name = 'OpenSCADLexError'
    this.line = line
    this.column = column
    this.found = found
  }
}

/**
 * Thrown when parsing fails (syntax errors).
 */
export class OpenSCADParseError extends OpenSCADError {
  line: number
  column: number
  found: string
  expected: string[]

  constructor(
    message: string,
    line: number,
    column: number,
    found: string,
    expected: string[]
  ) {
    super(message)
    this.name = 'OpenSCADParseError'
    this.line = line
    this.column = column
    this.found = found
    this.expected = expected
  }

  /**
   * Returns a formatted string suitable for AI retry context.
   * Provides structured error information for automated fixing.
   */
  toRetryContext(): string {
    const expectedList = this.expected.join(', ')
    return `Parse Error at line ${this.line}, column ${this.column}:
Found: "${this.found}"
Expected: ${expectedList}
Message: ${this.message}`
  }
}

/**
 * Thrown when transpilation to CadQuery fails.
 */
export class OpenSCADTranspileError extends OpenSCADError {
  node?: unknown

  constructor(message: string, node?: unknown) {
    super(message)
    this.name = 'OpenSCADTranspileError'
    this.node = node
  }
}

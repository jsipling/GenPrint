/**
 * OpenSCAD Lexer
 *
 * Tokenizes OpenSCAD source code into a stream of tokens.
 * Handles keywords, identifiers, numbers, strings, operators, and comments.
 */

import type { Token, TokenType } from './types'
import { OpenSCADLexError } from './errors'

/**
 * Keyword to token type mapping
 */
const KEYWORDS: Record<string, TokenType> = {
  // 3D Primitives
  cube: 'CUBE',
  sphere: 'SPHERE',
  cylinder: 'CYLINDER',
  polyhedron: 'POLYHEDRON',
  // 2D Primitives
  circle: 'CIRCLE',
  square: 'SQUARE',
  polygon: 'POLYGON',
  text: 'TEXT',
  // Transforms
  translate: 'TRANSLATE',
  rotate: 'ROTATE',
  scale: 'SCALE',
  mirror: 'MIRROR',
  resize: 'RESIZE',
  multmatrix: 'MULTMATRIX',
  color: 'COLOR',
  offset: 'OFFSET',
  hull: 'HULL',
  minkowski: 'MINKOWSKI',
  // Boolean operations
  union: 'UNION',
  difference: 'DIFFERENCE',
  intersection: 'INTERSECTION',
  // Extrusions
  linear_extrude: 'LINEAR_EXTRUDE',
  rotate_extrude: 'ROTATE_EXTRUDE',
  // Control flow
  module: 'MODULE',
  function: 'FUNCTION',
  if: 'IF',
  else: 'ELSE',
  for: 'FOR',
  let: 'LET',
  each: 'EACH',
  // Boolean/undefined literals
  true: 'TRUE',
  false: 'FALSE',
  undef: 'UNDEF',
}

/**
 * Single-character tokens (excluding DOT which needs special handling for numbers like .5)
 */
const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
  '(': 'LPAREN',
  ')': 'RPAREN',
  '{': 'LBRACE',
  '}': 'RBRACE',
  '[': 'LBRACKET',
  ']': 'RBRACKET',
  ',': 'COMMA',
  ';': 'SEMICOLON',
  ':': 'COLON',
  '?': 'QUESTION',
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'MULTIPLY',
  '%': 'MODULO',
  '^': 'POWER',
}

/**
 * Lexer class for tokenizing OpenSCAD source code
 */
class Lexer {
  private source: string
  private pos: number = 0
  private line: number = 1
  private column: number = 1
  private tokens: Token[] = []

  constructor(source: string) {
    this.source = source
  }

  /**
   * Main entry point - tokenize the entire source
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken()
    }

    // Add EOF token at current position
    this.tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
    })

    return this.tokens
  }

  /**
   * Check if we've reached the end of the source
   */
  private isAtEnd(): boolean {
    return this.pos >= this.source.length
  }

  /**
   * Peek at the current character without consuming it
   */
  private peek(): string {
    if (this.isAtEnd()) return '\0'
    return this.source[this.pos]!
  }

  /**
   * Peek at the next character without consuming it
   */
  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return '\0'
    return this.source[this.pos + 1]!
  }

  /**
   * Peek ahead by a specified offset without consuming characters
   */
  private peekAhead(offset: number): string {
    if (this.pos + offset >= this.source.length) return '\0'
    return this.source[this.pos + offset]!
  }

  /**
   * Consume and return the current character
   */
  private advance(): string {
    const char = this.source[this.pos]!
    this.pos++
    if (char === '\n') {
      this.line++
      this.column = 1
    } else {
      this.column++
    }
    return char
  }

  /**
   * Check if a character matches and consume it if so
   */
  private match(expected: string): boolean {
    if (this.isAtEnd()) return false
    if (this.source[this.pos] !== expected) return false
    this.advance()
    return true
  }

  /**
   * Add a token to the list
   */
  private addToken(type: TokenType, value: string, line: number, column: number): void {
    this.tokens.push({ type, value, line, column })
  }

  /**
   * Scan a single token
   */
  private scanToken(): void {
    const startLine = this.line
    const startColumn = this.column

    const char = this.advance()

    // Handle whitespace - consume but don't tokenize
    if (this.isWhitespace(char)) {
      return
    }

    // Handle comments
    if (char === '/') {
      if (this.peek() === '/') {
        // Single-line comment
        this.skipSingleLineComment()
        return
      } else if (this.peek() === '*') {
        // Multi-line comment
        this.skipMultiLineComment(startLine, startColumn)
        return
      } else {
        // Division operator
        this.addToken('DIVIDE', '/', startLine, startColumn)
        return
      }
    }

    // Handle single-character tokens
    if (char in SINGLE_CHAR_TOKENS) {
      this.addToken(SINGLE_CHAR_TOKENS[char]!, char, startLine, startColumn)
      return
    }

    // Handle multi-character operators
    if (char === '=') {
      if (this.match('=')) {
        this.addToken('EQUAL', '==', startLine, startColumn)
      } else {
        this.addToken('ASSIGN', '=', startLine, startColumn)
      }
      return
    }

    if (char === '!') {
      if (this.match('=')) {
        this.addToken('NOT_EQUAL', '!=', startLine, startColumn)
      } else {
        this.addToken('NOT', '!', startLine, startColumn)
      }
      return
    }

    if (char === '<') {
      if (this.match('=')) {
        this.addToken('LESS_EQUAL', '<=', startLine, startColumn)
      } else {
        this.addToken('LESS_THAN', '<', startLine, startColumn)
      }
      return
    }

    if (char === '>') {
      if (this.match('=')) {
        this.addToken('GREATER_EQUAL', '>=', startLine, startColumn)
      } else {
        this.addToken('GREATER_THAN', '>', startLine, startColumn)
      }
      return
    }

    if (char === '&') {
      if (this.match('&')) {
        this.addToken('AND', '&&', startLine, startColumn)
        return
      }
      // Single & is invalid in OpenSCAD
      throw new OpenSCADLexError(
        `Unexpected character '${char}' at line ${startLine}, column ${startColumn}`,
        startLine,
        startColumn,
        char
      )
    }

    if (char === '|') {
      if (this.match('|')) {
        this.addToken('OR', '||', startLine, startColumn)
        return
      }
      // Single | is invalid in OpenSCAD
      throw new OpenSCADLexError(
        `Unexpected character '${char}' at line ${startLine}, column ${startColumn}`,
        startLine,
        startColumn,
        char
      )
    }

    // Handle strings
    if (char === '"') {
      this.scanString(startLine, startColumn)
      return
    }

    // Handle numbers (including those starting with .)
    if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek()))) {
      this.scanNumber(char, startLine, startColumn)
      return
    }

    // Handle special variables ($fn, $fa, etc.)
    if (char === '$') {
      this.scanSpecialVariable(startLine, startColumn)
      return
    }

    // Handle identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      this.scanIdentifierOrKeyword(char, startLine, startColumn)
      return
    }

    // Handle DOT (not followed by digit, already handled in number case above)
    if (char === '.') {
      this.addToken('DOT', '.', startLine, startColumn)
      return
    }

    // Unknown character - throw error
    throw new OpenSCADLexError(
      `Unexpected character '${char}' at line ${startLine}, column ${startColumn}`,
      startLine,
      startColumn,
      char
    )
  }

  /**
   * Check if a character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r'
  }

  /**
   * Check if a character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9'
  }

  /**
   * Check if a character is alphabetic
   */
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
  }

  /**
   * Check if a character is alphanumeric or underscore
   */
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char) || char === '_'
  }

  /**
   * Skip a single-line comment
   */
  private skipSingleLineComment(): void {
    // Consume until end of line or end of file
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance()
    }
  }

  /**
   * Skip a multi-line comment
   */
  private skipMultiLineComment(startLine: number, startColumn: number): void {
    // Consume the *
    this.advance()

    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance() // consume *
        this.advance() // consume /
        return
      }
      this.advance()
    }

    // Unterminated comment
    throw new OpenSCADLexError(
      `Unterminated multi-line comment starting at line ${startLine}, column ${startColumn}`,
      startLine,
      startColumn,
      '/*'
    )
  }

  /**
   * Scan a string literal
   */
  private scanString(startLine: number, startColumn: number): void {
    let value = ''

    while (!this.isAtEnd() && this.peek() !== '"') {
      const char = this.peek()

      // Handle escape sequences
      if (char === '\\' && !this.isAtEnd()) {
        value += this.advance() // add the backslash
        if (!this.isAtEnd()) {
          value += this.advance() // add the escaped character
        }
      } else if (char === '\n') {
        // Newlines in strings are allowed in some contexts, but typically an error
        // For now, allow them (OpenSCAD might be lenient here)
        throw new OpenSCADLexError(
          `Unterminated string starting at line ${startLine}, column ${startColumn}`,
          startLine,
          startColumn,
          '"'
        )
      } else {
        value += this.advance()
      }
    }

    if (this.isAtEnd()) {
      throw new OpenSCADLexError(
        `Unterminated string starting at line ${startLine}, column ${startColumn}`,
        startLine,
        startColumn,
        '"'
      )
    }

    // Consume the closing quote
    this.advance()

    this.addToken('STRING', value, startLine, startColumn)
  }

  /**
   * Scan a number literal (integer, decimal, or scientific notation)
   */
  private scanNumber(firstChar: string, startLine: number, startColumn: number): void {
    let value = firstChar

    // Consume integer part
    while (this.isDigit(this.peek())) {
      value += this.advance()
    }

    // Look for decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance() // consume the dot
      while (this.isDigit(this.peek())) {
        value += this.advance()
      }
    }

    // Look for exponent part - only consume if valid exponent follows
    if (this.peek() === 'e' || this.peek() === 'E') {
      // Look ahead to check if this is a valid exponent
      let lookAhead = 1
      const nextChar = this.peekAhead(lookAhead)

      // Check for optional sign
      if (nextChar === '+' || nextChar === '-') {
        lookAhead++
      }

      // Only consume exponent if digit follows (after optional sign)
      const digitAfterExp = this.peekAhead(lookAhead)
      if (this.isDigit(digitAfterExp)) {
        value += this.advance() // consume the e/E

        // Consume optional sign
        if (this.peek() === '+' || this.peek() === '-') {
          value += this.advance()
        }

        // Consume exponent digits
        while (this.isDigit(this.peek())) {
          value += this.advance()
        }
      }
      // If no valid exponent digits, don't consume the 'e' - treat it as end of number
    }

    this.addToken('NUMBER', value, startLine, startColumn)
  }

  /**
   * Scan a special variable ($fn, $fa, etc.)
   */
  private scanSpecialVariable(startLine: number, startColumn: number): void {
    let value = '$'

    // Special variables must start with letter after $
    while (this.isAlphaNumeric(this.peek())) {
      value += this.advance()
    }

    this.addToken('SPECIAL_VAR', value, startLine, startColumn)
  }

  /**
   * Scan an identifier or keyword
   */
  private scanIdentifierOrKeyword(firstChar: string, startLine: number, startColumn: number): void {
    let value = firstChar

    while (this.isAlphaNumeric(this.peek())) {
      value += this.advance()
    }

    // Check if it's a keyword
    const tokenType = KEYWORDS[value] || 'IDENTIFIER'
    this.addToken(tokenType, value, startLine, startColumn)
  }
}

/**
 * Tokenize OpenSCAD source code
 *
 * @param source - The OpenSCAD source code to tokenize
 * @returns Array of tokens including EOF at the end
 * @throws OpenSCADLexError if invalid input is encountered
 */
export function lex(source: string): Token[] {
  const lexer = new Lexer(source)
  return lexer.tokenize()
}

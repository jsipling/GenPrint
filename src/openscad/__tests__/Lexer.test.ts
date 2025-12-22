import { describe, it, expect } from 'vitest'
import { lex } from '../Lexer'
import type { Token, TokenType } from '../types'
import { OpenSCADLexError } from '../errors'

/**
 * Helper function to find token by type in token array
 */
function findToken(tokens: Token[], type: TokenType): Token | undefined {
  return tokens.find(t => t.type === type)
}

/**
 * Helper function to get all tokens except EOF
 */
function tokensWithoutEOF(tokens: Token[]): Token[] {
  return tokens.filter(t => t.type !== 'EOF')
}

describe('Lexer', () => {
  // ============================================================================
  // Empty Input Tests
  // ============================================================================

  describe('empty input', () => {
    it('should produce only EOF token for empty string', () => {
      const tokens = lex('')
      expect(tokens).toHaveLength(1)
      expect(tokens[0]!.type).toBe('EOF')
    })

    it('should produce only EOF token for whitespace-only input', () => {
      const tokens = lex('   \t\n  ')
      expect(tokens).toHaveLength(1)
      expect(tokens[0]!.type).toBe('EOF')
    })

    it('should set correct position for EOF in empty input', () => {
      const tokens = lex('')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
    })
  })

  // ============================================================================
  // Primitive Keywords Tests (3D)
  // ============================================================================

  describe('3D primitive keywords', () => {
    it('should tokenize cube keyword', () => {
      const tokens = lex('cube')
      expect(tokens[0]!.type).toBe('CUBE')
      expect(tokens[0]!.value).toBe('cube')
    })

    it('should tokenize sphere keyword', () => {
      const tokens = lex('sphere')
      expect(tokens[0]!.type).toBe('SPHERE')
      expect(tokens[0]!.value).toBe('sphere')
    })

    it('should tokenize cylinder keyword', () => {
      const tokens = lex('cylinder')
      expect(tokens[0]!.type).toBe('CYLINDER')
      expect(tokens[0]!.value).toBe('cylinder')
    })

    it('should tokenize polyhedron keyword', () => {
      const tokens = lex('polyhedron')
      expect(tokens[0]!.type).toBe('POLYHEDRON')
      expect(tokens[0]!.value).toBe('polyhedron')
    })
  })

  // ============================================================================
  // Primitive Keywords Tests (2D)
  // ============================================================================

  describe('2D primitive keywords', () => {
    it('should tokenize circle keyword', () => {
      const tokens = lex('circle')
      expect(tokens[0]!.type).toBe('CIRCLE')
      expect(tokens[0]!.value).toBe('circle')
    })

    it('should tokenize square keyword', () => {
      const tokens = lex('square')
      expect(tokens[0]!.type).toBe('SQUARE')
      expect(tokens[0]!.value).toBe('square')
    })

    it('should tokenize polygon keyword', () => {
      const tokens = lex('polygon')
      expect(tokens[0]!.type).toBe('POLYGON')
      expect(tokens[0]!.value).toBe('polygon')
    })

    it('should tokenize text keyword', () => {
      const tokens = lex('text')
      expect(tokens[0]!.type).toBe('TEXT')
      expect(tokens[0]!.value).toBe('text')
    })
  })

  // ============================================================================
  // Transform Keywords Tests
  // ============================================================================

  describe('transform keywords', () => {
    it('should tokenize translate keyword', () => {
      const tokens = lex('translate')
      expect(tokens[0]!.type).toBe('TRANSLATE')
      expect(tokens[0]!.value).toBe('translate')
    })

    it('should tokenize rotate keyword', () => {
      const tokens = lex('rotate')
      expect(tokens[0]!.type).toBe('ROTATE')
      expect(tokens[0]!.value).toBe('rotate')
    })

    it('should tokenize scale keyword', () => {
      const tokens = lex('scale')
      expect(tokens[0]!.type).toBe('SCALE')
      expect(tokens[0]!.value).toBe('scale')
    })

    it('should tokenize mirror keyword', () => {
      const tokens = lex('mirror')
      expect(tokens[0]!.type).toBe('MIRROR')
      expect(tokens[0]!.value).toBe('mirror')
    })

    it('should tokenize resize keyword', () => {
      const tokens = lex('resize')
      expect(tokens[0]!.type).toBe('RESIZE')
      expect(tokens[0]!.value).toBe('resize')
    })

    it('should tokenize multmatrix keyword', () => {
      const tokens = lex('multmatrix')
      expect(tokens[0]!.type).toBe('MULTMATRIX')
      expect(tokens[0]!.value).toBe('multmatrix')
    })

    it('should tokenize color keyword', () => {
      const tokens = lex('color')
      expect(tokens[0]!.type).toBe('COLOR')
      expect(tokens[0]!.value).toBe('color')
    })

    it('should tokenize offset keyword', () => {
      const tokens = lex('offset')
      expect(tokens[0]!.type).toBe('OFFSET')
      expect(tokens[0]!.value).toBe('offset')
    })

    it('should tokenize hull keyword', () => {
      const tokens = lex('hull')
      expect(tokens[0]!.type).toBe('HULL')
      expect(tokens[0]!.value).toBe('hull')
    })

    it('should tokenize minkowski keyword', () => {
      const tokens = lex('minkowski')
      expect(tokens[0]!.type).toBe('MINKOWSKI')
      expect(tokens[0]!.value).toBe('minkowski')
    })
  })

  // ============================================================================
  // Boolean Keywords Tests
  // ============================================================================

  describe('boolean operation keywords', () => {
    it('should tokenize union keyword', () => {
      const tokens = lex('union')
      expect(tokens[0]!.type).toBe('UNION')
      expect(tokens[0]!.value).toBe('union')
    })

    it('should tokenize difference keyword', () => {
      const tokens = lex('difference')
      expect(tokens[0]!.type).toBe('DIFFERENCE')
      expect(tokens[0]!.value).toBe('difference')
    })

    it('should tokenize intersection keyword', () => {
      const tokens = lex('intersection')
      expect(tokens[0]!.type).toBe('INTERSECTION')
      expect(tokens[0]!.value).toBe('intersection')
    })
  })

  // ============================================================================
  // Extrusion Keywords Tests
  // ============================================================================

  describe('extrusion keywords', () => {
    it('should tokenize linear_extrude keyword', () => {
      const tokens = lex('linear_extrude')
      expect(tokens[0]!.type).toBe('LINEAR_EXTRUDE')
      expect(tokens[0]!.value).toBe('linear_extrude')
    })

    it('should tokenize rotate_extrude keyword', () => {
      const tokens = lex('rotate_extrude')
      expect(tokens[0]!.type).toBe('ROTATE_EXTRUDE')
      expect(tokens[0]!.value).toBe('rotate_extrude')
    })
  })

  // ============================================================================
  // Control Flow Keywords Tests
  // ============================================================================

  describe('control flow keywords', () => {
    it('should tokenize module keyword', () => {
      const tokens = lex('module')
      expect(tokens[0]!.type).toBe('MODULE')
      expect(tokens[0]!.value).toBe('module')
    })

    it('should tokenize function keyword', () => {
      const tokens = lex('function')
      expect(tokens[0]!.type).toBe('FUNCTION')
      expect(tokens[0]!.value).toBe('function')
    })

    it('should tokenize if keyword', () => {
      const tokens = lex('if')
      expect(tokens[0]!.type).toBe('IF')
      expect(tokens[0]!.value).toBe('if')
    })

    it('should tokenize else keyword', () => {
      const tokens = lex('else')
      expect(tokens[0]!.type).toBe('ELSE')
      expect(tokens[0]!.value).toBe('else')
    })

    it('should tokenize for keyword', () => {
      const tokens = lex('for')
      expect(tokens[0]!.type).toBe('FOR')
      expect(tokens[0]!.value).toBe('for')
    })

    it('should tokenize let keyword', () => {
      const tokens = lex('let')
      expect(tokens[0]!.type).toBe('LET')
      expect(tokens[0]!.value).toBe('let')
    })

    it('should tokenize each keyword', () => {
      const tokens = lex('each')
      expect(tokens[0]!.type).toBe('EACH')
      expect(tokens[0]!.value).toBe('each')
    })
  })

  // ============================================================================
  // Boolean Literals Tests (true/false)
  // ============================================================================

  describe('boolean literals', () => {
    it('should tokenize true as TRUE token', () => {
      const tokens = lex('true')
      expect(tokens[0]!.type).toBe('TRUE')
      expect(tokens[0]!.value).toBe('true')
    })

    it('should tokenize false as FALSE token', () => {
      const tokens = lex('false')
      expect(tokens[0]!.type).toBe('FALSE')
      expect(tokens[0]!.value).toBe('false')
    })

    it('should tokenize undef as UNDEF token', () => {
      const tokens = lex('undef')
      expect(tokens[0]!.type).toBe('UNDEF')
      expect(tokens[0]!.value).toBe('undef')
    })
  })

  // ============================================================================
  // Number Tokenization Tests
  // ============================================================================

  describe('number tokenization', () => {
    describe('integers', () => {
      it('should tokenize single digit integer', () => {
        const tokens = lex('5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('5')
      })

      it('should tokenize multi-digit integer', () => {
        const tokens = lex('123')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('123')
      })

      it('should tokenize zero', () => {
        const tokens = lex('0')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('0')
      })

      it('should tokenize large integer', () => {
        const tokens = lex('999999999')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('999999999')
      })
    })

    describe('floating point numbers', () => {
      it('should tokenize simple decimal', () => {
        const tokens = lex('3.14')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('3.14')
      })

      it('should tokenize decimal starting with zero', () => {
        const tokens = lex('0.5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('0.5')
      })

      it('should tokenize decimal with multiple fractional digits', () => {
        const tokens = lex('1.23456')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1.23456')
      })

      it('should tokenize decimal starting with dot', () => {
        const tokens = lex('.5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('.5')
      })
    })

    describe('negative numbers', () => {
      it('should tokenize negative integer as MINUS followed by NUMBER', () => {
        const tokens = lex('-5')
        expect(tokens[0]!.type).toBe('MINUS')
        expect(tokens[1]!.type).toBe('NUMBER')
        expect(tokens[1]!.value).toBe('5')
      })

      it('should tokenize negative float as MINUS followed by NUMBER', () => {
        const tokens = lex('-3.14')
        expect(tokens[0]!.type).toBe('MINUS')
        expect(tokens[1]!.type).toBe('NUMBER')
        expect(tokens[1]!.value).toBe('3.14')
      })
    })

    describe('scientific notation', () => {
      it('should tokenize positive exponent with lowercase e', () => {
        const tokens = lex('1e5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1e5')
      })

      it('should tokenize positive exponent with uppercase E', () => {
        const tokens = lex('1E5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1E5')
      })

      it('should tokenize explicit positive exponent', () => {
        const tokens = lex('1e+5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1e+5')
      })

      it('should tokenize negative exponent', () => {
        const tokens = lex('1e-5')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1e-5')
      })

      it('should tokenize float with scientific notation', () => {
        const tokens = lex('3.14e10')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('3.14e10')
      })

      it('should tokenize float with negative exponent', () => {
        const tokens = lex('1.5e-3')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1.5e-3')
      })
    })

    describe('malformed scientific notation', () => {
      it('should treat 1e without digits as number followed by identifier', () => {
        // 1e with no exponent digits should become: NUMBER(1), IDENTIFIER(e), EOF
        const tokens = lex('1e')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1')
        expect(tokens[1]!.type).toBe('IDENTIFIER')
        expect(tokens[1]!.value).toBe('e')
        expect(tokens[2]!.type).toBe('EOF')
      })

      it('should treat 1e+ without digits as number followed by identifier and plus', () => {
        // 1e+ with no exponent digits should become: NUMBER(1), IDENTIFIER(e), PLUS, EOF
        const tokens = lex('1e+')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1')
        expect(tokens[1]!.type).toBe('IDENTIFIER')
        expect(tokens[1]!.value).toBe('e')
        expect(tokens[2]!.type).toBe('PLUS')
        expect(tokens[3]!.type).toBe('EOF')
      })

      it('should treat 1E- without digits as number followed by identifier and minus', () => {
        // 1E- with no exponent digits should become: NUMBER(1), IDENTIFIER(E), MINUS, EOF
        const tokens = lex('1E-')
        expect(tokens[0]!.type).toBe('NUMBER')
        expect(tokens[0]!.value).toBe('1')
        expect(tokens[1]!.type).toBe('IDENTIFIER')
        expect(tokens[1]!.value).toBe('E')
        expect(tokens[2]!.type).toBe('MINUS')
        expect(tokens[3]!.type).toBe('EOF')
      })
    })
  })

  // ============================================================================
  // Punctuation Tests
  // ============================================================================

  describe('punctuation', () => {
    describe('parentheses', () => {
      it('should tokenize left parenthesis', () => {
        const tokens = lex('(')
        expect(tokens[0]!.type).toBe('LPAREN')
        expect(tokens[0]!.value).toBe('(')
      })

      it('should tokenize right parenthesis', () => {
        const tokens = lex(')')
        expect(tokens[0]!.type).toBe('RPAREN')
        expect(tokens[0]!.value).toBe(')')
      })

      it('should tokenize matching parentheses', () => {
        const tokens = lex('()')
        expect(tokens[0]!.type).toBe('LPAREN')
        expect(tokens[1]!.type).toBe('RPAREN')
      })
    })

    describe('braces', () => {
      it('should tokenize left brace', () => {
        const tokens = lex('{')
        expect(tokens[0]!.type).toBe('LBRACE')
        expect(tokens[0]!.value).toBe('{')
      })

      it('should tokenize right brace', () => {
        const tokens = lex('}')
        expect(tokens[0]!.type).toBe('RBRACE')
        expect(tokens[0]!.value).toBe('}')
      })

      it('should tokenize matching braces', () => {
        const tokens = lex('{}')
        expect(tokens[0]!.type).toBe('LBRACE')
        expect(tokens[1]!.type).toBe('RBRACE')
      })
    })

    describe('brackets', () => {
      it('should tokenize left bracket', () => {
        const tokens = lex('[')
        expect(tokens[0]!.type).toBe('LBRACKET')
        expect(tokens[0]!.value).toBe('[')
      })

      it('should tokenize right bracket', () => {
        const tokens = lex(']')
        expect(tokens[0]!.type).toBe('RBRACKET')
        expect(tokens[0]!.value).toBe(']')
      })

      it('should tokenize matching brackets', () => {
        const tokens = lex('[]')
        expect(tokens[0]!.type).toBe('LBRACKET')
        expect(tokens[1]!.type).toBe('RBRACKET')
      })
    })

    describe('other punctuation', () => {
      it('should tokenize comma', () => {
        const tokens = lex(',')
        expect(tokens[0]!.type).toBe('COMMA')
        expect(tokens[0]!.value).toBe(',')
      })

      it('should tokenize semicolon', () => {
        const tokens = lex(';')
        expect(tokens[0]!.type).toBe('SEMICOLON')
        expect(tokens[0]!.value).toBe(';')
      })

      it('should tokenize equals sign as ASSIGN', () => {
        const tokens = lex('=')
        expect(tokens[0]!.type).toBe('ASSIGN')
        expect(tokens[0]!.value).toBe('=')
      })

      it('should tokenize dot', () => {
        const tokens = lex('a.b')
        const dotToken = findToken(tokens, 'DOT')
        expect(dotToken).toBeDefined()
        expect(dotToken!.value).toBe('.')
      })

      it('should tokenize colon', () => {
        const tokens = lex(':')
        expect(tokens[0]!.type).toBe('COLON')
        expect(tokens[0]!.value).toBe(':')
      })

      it('should tokenize question mark', () => {
        const tokens = lex('?')
        expect(tokens[0]!.type).toBe('QUESTION')
        expect(tokens[0]!.value).toBe('?')
      })
    })
  })

  // ============================================================================
  // Operator Tests
  // ============================================================================

  describe('operators', () => {
    describe('arithmetic operators', () => {
      it('should tokenize plus', () => {
        const tokens = lex('+')
        expect(tokens[0]!.type).toBe('PLUS')
        expect(tokens[0]!.value).toBe('+')
      })

      it('should tokenize minus', () => {
        const tokens = lex('-')
        expect(tokens[0]!.type).toBe('MINUS')
        expect(tokens[0]!.value).toBe('-')
      })

      it('should tokenize multiply', () => {
        const tokens = lex('*')
        expect(tokens[0]!.type).toBe('MULTIPLY')
        expect(tokens[0]!.value).toBe('*')
      })

      it('should tokenize divide', () => {
        const tokens = lex('/')
        expect(tokens[0]!.type).toBe('DIVIDE')
        expect(tokens[0]!.value).toBe('/')
      })

      it('should tokenize modulo', () => {
        const tokens = lex('%')
        expect(tokens[0]!.type).toBe('MODULO')
        expect(tokens[0]!.value).toBe('%')
      })

      it('should tokenize power', () => {
        const tokens = lex('^')
        expect(tokens[0]!.type).toBe('POWER')
        expect(tokens[0]!.value).toBe('^')
      })
    })

    describe('comparison operators', () => {
      it('should tokenize equal', () => {
        const tokens = lex('==')
        expect(tokens[0]!.type).toBe('EQUAL')
        expect(tokens[0]!.value).toBe('==')
      })

      it('should tokenize not equal', () => {
        const tokens = lex('!=')
        expect(tokens[0]!.type).toBe('NOT_EQUAL')
        expect(tokens[0]!.value).toBe('!=')
      })

      it('should tokenize less than', () => {
        const tokens = lex('<')
        expect(tokens[0]!.type).toBe('LESS_THAN')
        expect(tokens[0]!.value).toBe('<')
      })

      it('should tokenize greater than', () => {
        const tokens = lex('>')
        expect(tokens[0]!.type).toBe('GREATER_THAN')
        expect(tokens[0]!.value).toBe('>')
      })

      it('should tokenize less than or equal', () => {
        const tokens = lex('<=')
        expect(tokens[0]!.type).toBe('LESS_EQUAL')
        expect(tokens[0]!.value).toBe('<=')
      })

      it('should tokenize greater than or equal', () => {
        const tokens = lex('>=')
        expect(tokens[0]!.type).toBe('GREATER_EQUAL')
        expect(tokens[0]!.value).toBe('>=')
      })
    })

    describe('logical operators', () => {
      it('should tokenize logical and', () => {
        const tokens = lex('&&')
        expect(tokens[0]!.type).toBe('AND')
        expect(tokens[0]!.value).toBe('&&')
      })

      it('should tokenize logical or', () => {
        const tokens = lex('||')
        expect(tokens[0]!.type).toBe('OR')
        expect(tokens[0]!.value).toBe('||')
      })

      it('should tokenize logical not', () => {
        const tokens = lex('!')
        expect(tokens[0]!.type).toBe('NOT')
        expect(tokens[0]!.value).toBe('!')
      })
    })
  })

  // ============================================================================
  // Special Variables Tests
  // ============================================================================

  describe('special variables', () => {
    it('should tokenize $fn', () => {
      const tokens = lex('$fn')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$fn')
    })

    it('should tokenize $fa', () => {
      const tokens = lex('$fa')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$fa')
    })

    it('should tokenize $fs', () => {
      const tokens = lex('$fs')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$fs')
    })

    it('should tokenize $t', () => {
      const tokens = lex('$t')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$t')
    })

    it('should tokenize $vpr', () => {
      const tokens = lex('$vpr')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$vpr')
    })

    it('should tokenize $vpt', () => {
      const tokens = lex('$vpt')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$vpt')
    })

    it('should tokenize $vpd', () => {
      const tokens = lex('$vpd')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$vpd')
    })

    it('should tokenize custom special variable starting with $', () => {
      const tokens = lex('$myvar')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$myvar')
    })
  })

  // ============================================================================
  // Identifier Tests
  // ============================================================================

  describe('identifiers', () => {
    it('should tokenize simple identifier', () => {
      const tokens = lex('myvar')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('myvar')
    })

    it('should tokenize identifier with underscore', () => {
      const tokens = lex('my_var')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('my_var')
    })

    it('should tokenize identifier starting with underscore', () => {
      const tokens = lex('_myvar')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('_myvar')
    })

    it('should tokenize identifier with numbers', () => {
      const tokens = lex('var123')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('var123')
    })

    it('should tokenize mixed case identifier', () => {
      const tokens = lex('myVar')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('myVar')
    })

    it('should not confuse partial keywords with keywords', () => {
      const tokens = lex('cubes')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('cubes')
    })

    it('should not confuse keywords followed by underscore', () => {
      const tokens = lex('cube_size')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('cube_size')
    })
  })

  // ============================================================================
  // String Literal Tests
  // ============================================================================

  describe('string literals', () => {
    it('should tokenize simple string', () => {
      const tokens = lex('"hello"')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('hello')
    })

    it('should tokenize empty string', () => {
      const tokens = lex('""')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('')
    })

    it('should tokenize string with spaces', () => {
      const tokens = lex('"hello world"')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('hello world')
    })

    it('should tokenize string with numbers', () => {
      const tokens = lex('"test123"')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('test123')
    })

    it('should tokenize string with escape characters', () => {
      const tokens = lex('"hello\\nworld"')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('hello\\nworld')
    })

    it('should tokenize string with escaped quotes', () => {
      const tokens = lex('"say \\"hello\\""')
      expect(tokens[0]!.type).toBe('STRING')
      expect(tokens[0]!.value).toBe('say \\"hello\\"')
    })
  })

  // ============================================================================
  // Named Argument Tests
  // ============================================================================

  describe('named arguments', () => {
    it('should tokenize center=true', () => {
      const tokens = lex('center=true')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('center')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('TRUE')
    })

    it('should tokenize height=10', () => {
      const tokens = lex('height=10')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('height')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[2]!.value).toBe('10')
    })

    it('should tokenize r=5.5', () => {
      const tokens = lex('r=5.5')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('r')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[2]!.value).toBe('5.5')
    })

    it('should tokenize $fn=64', () => {
      const tokens = lex('$fn=64')
      expect(tokens[0]!.type).toBe('SPECIAL_VAR')
      expect(tokens[0]!.value).toBe('$fn')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[2]!.value).toBe('64')
    })

    it('should tokenize named argument with spaces', () => {
      const tokens = lex('center = true')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[0]!.value).toBe('center')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('TRUE')
    })
  })

  // ============================================================================
  // Comment Tests
  // ============================================================================

  describe('comments', () => {
    describe('single-line comments', () => {
      it('should skip single-line comment', () => {
        const tokens = lex('// this is a comment')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should skip comment and tokenize code before it', () => {
        const tokens = lex('cube // comment')
        expect(tokens[0]!.type).toBe('CUBE')
        expect(tokens[1]!.type).toBe('EOF')
      })

      it('should handle code after comment on next line', () => {
        const tokens = lex('cube // comment\nsphere')
        expect(tokens[0]!.type).toBe('CUBE')
        expect(tokens[1]!.type).toBe('SPHERE')
        expect(tokens[2]!.type).toBe('EOF')
      })

      it('should handle empty single-line comment', () => {
        const tokens = lex('//')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should handle multiple consecutive single-line comments', () => {
        const tokens = lex('// comment 1\n// comment 2\ncube')
        expect(tokens[0]!.type).toBe('CUBE')
        expect(tokens[1]!.type).toBe('EOF')
      })
    })

    describe('multi-line comments', () => {
      it('should skip multi-line comment', () => {
        const tokens = lex('/* this is a comment */')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should skip multi-line comment spanning lines', () => {
        const tokens = lex('/* this is\na multi-line\ncomment */')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should tokenize code before and after multi-line comment', () => {
        const tokens = lex('cube /* comment */ sphere')
        expect(tokens[0]!.type).toBe('CUBE')
        expect(tokens[1]!.type).toBe('SPHERE')
        expect(tokens[2]!.type).toBe('EOF')
      })

      it('should handle empty multi-line comment', () => {
        const tokens = lex('/**/')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should handle multi-line comment with asterisks inside', () => {
        const tokens = lex('/* * * * */')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })

      it('should handle nested asterisks and slashes in multi-line comment', () => {
        const tokens = lex('/* a/b * c/d */')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]!.type).toBe('EOF')
      })
    })
  })

  // ============================================================================
  // Line and Column Tracking Tests
  // ============================================================================

  describe('line and column tracking', () => {
    it('should track position of first token at line 1, column 1', () => {
      const tokens = lex('cube')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
    })

    it('should track position after whitespace', () => {
      const tokens = lex('   cube')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(4)
    })

    it('should track position on second line', () => {
      const tokens = lex('\ncube')
      expect(tokens[0]!.line).toBe(2)
      expect(tokens[0]!.column).toBe(1)
    })

    it('should track positions for multiple tokens on same line', () => {
      const tokens = lex('cube sphere')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
      expect(tokens[1]!.line).toBe(1)
      expect(tokens[1]!.column).toBe(6)
    })

    it('should track positions across multiple lines', () => {
      const tokens = lex('cube\nsphere\ncylinder')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
      expect(tokens[1]!.line).toBe(2)
      expect(tokens[1]!.column).toBe(1)
      expect(tokens[2]!.line).toBe(3)
      expect(tokens[2]!.column).toBe(1)
    })

    it('should track positions after multi-line comment', () => {
      const tokens = lex('cube\n/* comment\nline 2 */\nsphere')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
      // sphere is on line 4 (after multi-line comment)
      expect(tokens[1]!.line).toBe(4)
      expect(tokens[1]!.column).toBe(1)
    })

    it('should track column correctly with tabs', () => {
      const tokens = lex('\tcube')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(2)
    })

    it('should track EOF position correctly', () => {
      const tokens = lex('cube\nsphere')
      const eof = tokens[tokens.length - 1]!
      expect(eof.type).toBe('EOF')
      // EOF should be at end of last token
      expect(eof.line).toBe(2)
    })

    it('should track position of punctuation', () => {
      const tokens = lex('cube()')
      expect(tokens[0]!.line).toBe(1)
      expect(tokens[0]!.column).toBe(1)
      expect(tokens[1]!.line).toBe(1)
      expect(tokens[1]!.column).toBe(5)
      expect(tokens[2]!.line).toBe(1)
      expect(tokens[2]!.column).toBe(6)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    describe('invalid characters', () => {
      it('should throw error on invalid character @', () => {
        expect(() => lex('@')).toThrow(OpenSCADLexError)
      })

      it('should throw error on invalid character #', () => {
        expect(() => lex('#')).toThrow(OpenSCADLexError)
      })

      it('should throw error on invalid character `', () => {
        expect(() => lex('`')).toThrow(OpenSCADLexError)
      })

      it('should throw error on invalid character ~', () => {
        expect(() => lex('~')).toThrow(OpenSCADLexError)
      })

      it('should report correct position for invalid character', () => {
        try {
          lex('cube @')
          expect.fail('Expected OpenSCADLexError to be thrown')
        } catch (e) {
          expect(e).toBeInstanceOf(OpenSCADLexError)
          const error = e as OpenSCADLexError
          expect(error.line).toBe(1)
          expect(error.column).toBe(6)
          expect(error.found).toBe('@')
        }
      })

      it('should report correct position for invalid character on second line', () => {
        try {
          lex('cube\n@sphere')
          expect.fail('Expected OpenSCADLexError to be thrown')
        } catch (e) {
          expect(e).toBeInstanceOf(OpenSCADLexError)
          const error = e as OpenSCADLexError
          expect(error.line).toBe(2)
          expect(error.column).toBe(1)
          expect(error.found).toBe('@')
        }
      })
    })

    describe('unterminated constructs', () => {
      it('should throw error on unterminated multi-line comment', () => {
        expect(() => lex('/* comment without end')).toThrow(OpenSCADLexError)
      })

      it('should throw error on unterminated multi-line comment at start', () => {
        expect(() => lex('/*')).toThrow(OpenSCADLexError)
      })

      it('should throw error on unterminated string', () => {
        expect(() => lex('"unclosed string')).toThrow(OpenSCADLexError)
      })

      it('should report correct position for unterminated comment', () => {
        try {
          lex('cube /* unclosed comment')
          expect.fail('Expected OpenSCADLexError to be thrown')
        } catch (e) {
          expect(e).toBeInstanceOf(OpenSCADLexError)
          const error = e as OpenSCADLexError
          expect(error.line).toBe(1)
        }
      })
    })
  })

  // ============================================================================
  // Complex Expression Tests
  // ============================================================================

  describe('complex expressions', () => {
    it('should tokenize cube call with size argument', () => {
      const tokens = lex('cube(10)')
      expect(tokens[0]!.type).toBe('CUBE')
      expect(tokens[1]!.type).toBe('LPAREN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[3]!.type).toBe('RPAREN')
    })

    it('should tokenize cube with named arguments', () => {
      const tokens = lex('cube(size=10, center=true)')
      expect(tokens[0]!.type).toBe('CUBE')
      expect(tokens[1]!.type).toBe('LPAREN')
      expect(tokens[2]!.type).toBe('IDENTIFIER')
      expect(tokens[3]!.type).toBe('ASSIGN')
      expect(tokens[4]!.type).toBe('NUMBER')
      expect(tokens[5]!.type).toBe('COMMA')
      expect(tokens[6]!.type).toBe('IDENTIFIER')
      expect(tokens[7]!.type).toBe('ASSIGN')
      expect(tokens[8]!.type).toBe('TRUE')
      expect(tokens[9]!.type).toBe('RPAREN')
    })

    it('should tokenize translate with vector', () => {
      const tokens = lex('translate([1, 2, 3])')
      expect(tokens[0]!.type).toBe('TRANSLATE')
      expect(tokens[1]!.type).toBe('LPAREN')
      expect(tokens[2]!.type).toBe('LBRACKET')
      expect(tokens[3]!.type).toBe('NUMBER')
      expect(tokens[4]!.type).toBe('COMMA')
      expect(tokens[5]!.type).toBe('NUMBER')
      expect(tokens[6]!.type).toBe('COMMA')
      expect(tokens[7]!.type).toBe('NUMBER')
      expect(tokens[8]!.type).toBe('RBRACKET')
      expect(tokens[9]!.type).toBe('RPAREN')
    })

    it('should tokenize difference operation', () => {
      const tokens = lex('difference() { cube(10); sphere(5); }')
      expect(tokens[0]!.type).toBe('DIFFERENCE')
      expect(tokens[1]!.type).toBe('LPAREN')
      expect(tokens[2]!.type).toBe('RPAREN')
      expect(tokens[3]!.type).toBe('LBRACE')
      expect(tokens[4]!.type).toBe('CUBE')
      expect(tokens[5]!.type).toBe('LPAREN')
      expect(tokens[6]!.type).toBe('NUMBER')
      expect(tokens[7]!.type).toBe('RPAREN')
      expect(tokens[8]!.type).toBe('SEMICOLON')
      expect(tokens[9]!.type).toBe('SPHERE')
      expect(tokens[10]!.type).toBe('LPAREN')
      expect(tokens[11]!.type).toBe('NUMBER')
      expect(tokens[12]!.type).toBe('RPAREN')
      expect(tokens[13]!.type).toBe('SEMICOLON')
      expect(tokens[14]!.type).toBe('RBRACE')
    })

    it('should tokenize cylinder with special variable', () => {
      const tokens = lex('cylinder(h=10, r=5, $fn=64)')
      expect(tokens[0]!.type).toBe('CYLINDER')
      expect(findToken(tokens, 'SPECIAL_VAR')!.value).toBe('$fn')
    })

    it('should tokenize linear_extrude with parameters', () => {
      const tokens = lex('linear_extrude(height=10, twist=45)')
      expect(tokens[0]!.type).toBe('LINEAR_EXTRUDE')
      expect(tokens[1]!.type).toBe('LPAREN')
    })

    it('should tokenize module definition', () => {
      const tokens = lex('module myShape(size=10) { cube(size); }')
      expect(tokens[0]!.type).toBe('MODULE')
      expect(tokens[1]!.type).toBe('IDENTIFIER')
      expect(tokens[1]!.value).toBe('myShape')
    })

    it('should tokenize arithmetic expression', () => {
      const tokens = lex('a = 5 + 3 * 2')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[1]!.type).toBe('ASSIGN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[3]!.type).toBe('PLUS')
      expect(tokens[4]!.type).toBe('NUMBER')
      expect(tokens[5]!.type).toBe('MULTIPLY')
      expect(tokens[6]!.type).toBe('NUMBER')
    })

    it('should tokenize ternary expression', () => {
      const tokens = lex('x > 5 ? 10 : 20')
      expect(tokens[0]!.type).toBe('IDENTIFIER')
      expect(tokens[1]!.type).toBe('GREATER_THAN')
      expect(tokens[2]!.type).toBe('NUMBER')
      expect(tokens[3]!.type).toBe('QUESTION')
      expect(tokens[4]!.type).toBe('NUMBER')
      expect(tokens[5]!.type).toBe('COLON')
      expect(tokens[6]!.type).toBe('NUMBER')
    })

    it('should tokenize for loop', () => {
      const tokens = lex('for (i = [0:10]) cube(i);')
      expect(tokens[0]!.type).toBe('FOR')
      expect(tokens[1]!.type).toBe('LPAREN')
      expect(tokens[2]!.type).toBe('IDENTIFIER')
      expect(tokens[3]!.type).toBe('ASSIGN')
    })

    it('should tokenize if-else statement', () => {
      const tokens = lex('if (x > 0) cube(x); else sphere(5);')
      expect(tokens[0]!.type).toBe('IF')
      expect(findToken(tokens, 'ELSE')).toBeDefined()
    })
  })

  // ============================================================================
  // Full OpenSCAD Code Examples
  // ============================================================================

  describe('full code examples', () => {
    it('should tokenize complete cube example', () => {
      const code = `
        // A simple cube
        cube([10, 20, 30], center=true);
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      expect(tokenTypes).toContain('CUBE')
      expect(tokenTypes).toContain('LBRACKET')
      expect(tokenTypes).toContain('NUMBER')
      expect(tokenTypes).toContain('TRUE')
      expect(tokenTypes).toContain('SEMICOLON')
    })

    it('should tokenize difference operation example', () => {
      const code = `
        difference() {
          cube(20, center=true);
          sphere(r=12, $fn=64);
        }
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      expect(tokenTypes).toContain('DIFFERENCE')
      expect(tokenTypes).toContain('CUBE')
      expect(tokenTypes).toContain('SPHERE')
      expect(tokenTypes).toContain('SPECIAL_VAR')
    })

    it('should tokenize module with translate and rotate', () => {
      const code = `
        module bracket(size=10) {
          translate([size/2, 0, 0])
            rotate([0, 45, 0])
              cube(size);
        }
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      expect(tokenTypes).toContain('MODULE')
      expect(tokenTypes).toContain('TRANSLATE')
      expect(tokenTypes).toContain('ROTATE')
      expect(tokenTypes).toContain('DIVIDE')
    })

    it('should tokenize linear_extrude example', () => {
      const code = `
        linear_extrude(height=50, twist=90, $fn=100)
          circle(r=20);
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      expect(tokenTypes).toContain('LINEAR_EXTRUDE')
      expect(tokenTypes).toContain('CIRCLE')
      expect(tokenTypes).toContain('SPECIAL_VAR')
    })

    it('should tokenize polygon example', () => {
      const code = `
        polygon(points=[[0,0], [10,0], [10,10], [0,10]]);
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      expect(tokenTypes).toContain('POLYGON')
      expect(tokenTypes.filter(t => t === 'LBRACKET').length).toBeGreaterThan(1)
    })

    it('should tokenize function definition', () => {
      const code = `
        function double(x) = x * 2;
      `
      const tokens = lex(code)
      expect(tokens[0]!.type).toBe('FUNCTION')
      expect(tokens[1]!.type).toBe('IDENTIFIER')
      expect(tokens[1]!.value).toBe('double')
    })

    it('should tokenize code with mixed comments', () => {
      const code = `
        // Configuration
        size = 10; /* default size */

        /*
         * Main shape
         */
        cube(size);
      `
      const tokens = lex(code)
      const tokenTypes = tokensWithoutEOF(tokens).map(t => t.type)
      // Comments should be skipped
      expect(tokenTypes).not.toContain('COMMENT')
      expect(tokenTypes).toContain('IDENTIFIER')
      expect(tokenTypes).toContain('CUBE')
    })
  })
})

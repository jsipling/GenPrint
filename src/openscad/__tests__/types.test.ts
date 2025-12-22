/**
 * Tests for VarRef type and isVarRef type guard
 *
 * VarRef represents a reference to a variable in OpenSCAD, allowing
 * parameter values to reference variables instead of being literal values.
 */
import { describe, it, expect } from 'vitest';
import { VarRef, isVarRef } from '../types';

describe('VarRef type', () => {
  describe('type structure', () => {
    it('should have type property set to "VarRef"', () => {
      const varRef: VarRef = { type: 'VarRef', name: 'myVar' };
      expect(varRef.type).toBe('VarRef');
    });

    it('should have name property as string', () => {
      const varRef: VarRef = { type: 'VarRef', name: 'height' };
      expect(varRef.name).toBe('height');
    });

    it('should accept valid variable names', () => {
      const varRefs: VarRef[] = [
        { type: 'VarRef', name: 'x' },
        { type: 'VarRef', name: 'width' },
        { type: 'VarRef', name: 'my_variable' },
        { type: 'VarRef', name: 'var123' },
        { type: 'VarRef', name: '_private' },
      ];
      varRefs.forEach((ref) => {
        expect(ref.type).toBe('VarRef');
        expect(typeof ref.name).toBe('string');
      });
    });
  });
});

describe('isVarRef type guard', () => {
  describe('returns true for valid VarRef objects', () => {
    it('should return true for basic VarRef', () => {
      const varRef = { type: 'VarRef', name: 'myVar' };
      expect(isVarRef(varRef)).toBe(true);
    });

    it('should return true for VarRef with underscore in name', () => {
      const varRef = { type: 'VarRef', name: 'my_variable' };
      expect(isVarRef(varRef)).toBe(true);
    });

    it('should return true for VarRef with numbers in name', () => {
      const varRef = { type: 'VarRef', name: 'var123' };
      expect(isVarRef(varRef)).toBe(true);
    });

    it('should return true for VarRef with single character name', () => {
      const varRef = { type: 'VarRef', name: 'x' };
      expect(isVarRef(varRef)).toBe(true);
    });
  });

  describe('returns false for non-VarRef values', () => {
    it('should return false for null', () => {
      expect(isVarRef(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isVarRef(undefined)).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isVarRef(42)).toBe(false);
      expect(isVarRef(0)).toBe(false);
      expect(isVarRef(-1)).toBe(false);
    });

    it('should return false for strings', () => {
      expect(isVarRef('myVar')).toBe(false);
      expect(isVarRef('VarRef')).toBe(false);
    });

    it('should return false for booleans', () => {
      expect(isVarRef(true)).toBe(false);
      expect(isVarRef(false)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isVarRef([])).toBe(false);
      expect(isVarRef([1, 2, 3])).toBe(false);
      expect(isVarRef(['VarRef', 'name'])).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isVarRef({})).toBe(false);
    });

    it('should return false for object with wrong type', () => {
      expect(isVarRef({ type: 'NotVarRef', name: 'x' })).toBe(false);
      expect(isVarRef({ type: 'varref', name: 'x' })).toBe(false);
      expect(isVarRef({ type: 'VARREF', name: 'x' })).toBe(false);
    });

    it('should return false for object missing type property', () => {
      expect(isVarRef({ name: 'myVar' })).toBe(false);
    });

    it('should return false for object missing name property', () => {
      expect(isVarRef({ type: 'VarRef' })).toBe(false);
    });

    it('should return false when type is not a string', () => {
      expect(isVarRef({ type: 123, name: 'x' })).toBe(false);
      expect(isVarRef({ type: null, name: 'x' })).toBe(false);
      expect(isVarRef({ type: undefined, name: 'x' })).toBe(false);
    });

    it('should return false when name is not a string', () => {
      expect(isVarRef({ type: 'VarRef', name: 123 })).toBe(false);
      expect(isVarRef({ type: 'VarRef', name: null })).toBe(false);
      expect(isVarRef({ type: 'VarRef', name: undefined })).toBe(false);
      expect(isVarRef({ type: 'VarRef', name: ['x'] })).toBe(false);
    });

    it('should return false for functions', () => {
      expect(isVarRef(() => {})).toBe(false);
      expect(isVarRef(function () {})).toBe(false);
    });
  });

  describe('type narrowing works correctly', () => {
    it('should narrow type in if statement', () => {
      const value: unknown = { type: 'VarRef', name: 'x' };
      if (isVarRef(value)) {
        // TypeScript should recognize value as VarRef here
        expect(value.type).toBe('VarRef');
        expect(value.name).toBe('x');
      }
    });

    it('should work with mixed value arrays', () => {
      const values: unknown[] = [
        { type: 'VarRef', name: 'a' },
        42,
        { type: 'VarRef', name: 'b' },
        'string',
        { type: 'Other', name: 'c' },
      ];

      const varRefs = values.filter(isVarRef);
      expect(varRefs).toHaveLength(2);
      expect(varRefs[0]?.name).toBe('a');
      expect(varRefs[1]?.name).toBe('b');
    });
  });
});

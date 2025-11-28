import { describe, it, expect } from 'vitest';
import { Validator } from '../Validator';
import type { GeoNode } from '../types';
import { Box } from '../primitives/Box';
import { Cylinder } from '../primitives/Cylinder';

describe('Validator', () => {
  describe('primitive validation', () => {
    it('passes valid box', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns on thin box dimension', () => {
      const validator = new Validator({ minWallThickness: 0.4 });
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.valid).toBe(true); // Still valid
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.type).toBe('thin_wall');
    });

    it('warns on zero dimension box', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('warns on negative dimension box', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: -5, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('warns on thin cylinder diameter', () => {
      const validator = new Validator({ minWallThickness: 0.4 });
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 0.3, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('warns on thin cylinder height', () => {
      const validator = new Validator({ minWallThickness: 0.4 });
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 10, height: 0.2 };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('warns on zero dimension cylinder', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 0, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns on negative dimension cylinder', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: -5, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('passes valid cylinder', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 10, height: 20 };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('uses custom minWallThickness', () => {
      const validator = new Validator({ minWallThickness: 1.0 });
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.8, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.type).toBe('thin_wall');
    });

    it('does not warn when above custom minWallThickness', () => {
      const validator = new Validator({ minWallThickness: 0.5 });
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.6, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('operation validation', () => {
    it('passes valid union', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }
        ]
      };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
    });

    it('passes valid subtraction', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: [
          { type: 'primitive', shape: 'box', width: 50, depth: 50, height: 10 },
          { type: 'primitive', shape: 'cylinder', diameter: 5, height: 20 }
        ]
      };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
      // No warnings for basic valid subtraction
    });

    it('warns on subtraction with single child', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: [
          { type: 'primitive', shape: 'box', width: 50, depth: 50, height: 10 }
        ]
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'non_intersecting_subtraction')).toBe(true);
    });

    it('warns on subtraction with no children', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: []
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'non_intersecting_subtraction')).toBe(true);
    });

    it('validates nested operations', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [
          { type: 'primitive', shape: 'box', width: 0.1, depth: 10, height: 10 }, // thin
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }
        ]
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('validates deeply nested operations', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: [
          {
            type: 'operation',
            op: 'union',
            children: [
              { type: 'primitive', shape: 'box', width: 50, depth: 50, height: 10 },
              { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 } // thin
            ]
          },
          { type: 'primitive', shape: 'cylinder', diameter: 5, height: 20 }
        ]
      };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('passes valid intersection', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'intersect',
        children: [
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }
        ]
      };
      const result = validator.validate(node);
      expect(result.valid).toBe(true);
    });
  });

  describe('transform validation', () => {
    it('validates transformed primitives', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'transform',
        child: { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('validates transformed operations', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'transform',
        child: {
          type: 'operation',
          op: 'subtract',
          children: [
            { type: 'primitive', shape: 'box', width: 50, depth: 50, height: 10 }
            // Missing subtraction tool
          ]
        },
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'non_intersecting_subtraction')).toBe(true);
    });

    it('validates nested transforms', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'transform',
        child: {
          type: 'transform',
          child: { type: 'primitive', shape: 'cylinder', diameter: 0.1, height: 10 },
          matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        },
        matrix: [1, 0, 0, 10, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      };
      const result = validator.validate(node);
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });
  });

  describe('Shape integration', () => {
    it('validates Box Shape nodes', () => {
      const validator = new Validator();
      const thinBox = new Box({ width: 0.2, depth: 10, height: 10 });
      const result = validator.validate(thinBox.getNode());
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]!.type).toBe('thin_wall');
    });

    it('validates Cylinder Shape nodes', () => {
      const validator = new Validator();
      const thinCylinder = new Cylinder({ diameter: 0.2, height: 10 });
      const result = validator.validate(thinCylinder.getNode());
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]!.type).toBe('thin_wall');
    });

    it('validates boolean operations from Shape API', () => {
      const validator = new Validator();
      const box = new Box({ width: 0.2, depth: 10, height: 10 });
      const cylinder = new Cylinder({ diameter: 5, height: 20 });
      const result = validator.validate(box.subtract(cylinder).getNode());
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });

    it('validates valid Shape nodes without warnings', () => {
      const validator = new Validator();
      const box = new Box({ width: 50, depth: 50, height: 10 });
      const hole = new Cylinder({ diameter: 5, height: 20 });
      const result = validator.validate(box.subtract(hole).getNode());
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('validates aligned shapes', () => {
      const validator = new Validator();
      const base = new Box({ width: 50, depth: 50, height: 10 });
      const thinPeg = new Cylinder({ diameter: 0.2, height: 20 });

      thinPeg.align({
        self: 'bottom',
        target: base,
        to: 'top',
        mode: 'mate'
      });

      const combined = base.union(thinPeg);
      const result = validator.validate(combined.getNode());
      expect(result.warnings.some(w => w.type === 'thin_wall')).toBe(true);
    });
  });

  describe('warning details', () => {
    it('includes node reference in warning', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings[0]!.node).toBeDefined();
      expect(result.warnings[0]!.node).toBe(node);
    });

    it('includes descriptive message in warning', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings[0]!.message).toContain('0.4mm');
    });

    it('sets severity to warning for thin walls', () => {
      const validator = new Validator();
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 };
      const result = validator.validate(node);
      expect(result.warnings[0]!.severity).toBe('warning');
    });

    it('collects multiple warnings', () => {
      const validator = new Validator();
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [
          { type: 'primitive', shape: 'box', width: 0.2, depth: 10, height: 10 }, // thin
          { type: 'primitive', shape: 'cylinder', diameter: 0.1, height: 10 } // thin
        ]
      };
      const result = validator.validate(node);
      expect(result.warnings.length).toBe(2);
    });
  });
});

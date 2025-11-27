/**
 * Primitive shape helpers for the fluent geometry API
 * Factory function creates primitives bound to a Manifold instance
 */
import type { ManifoldToplevel } from 'manifold-3d'
import { Shape } from './Shape'
import { roundedRect } from '../shapes'
import {
  HOLE_CYLINDER_SEGMENTS,
  CORNER_SEGMENTS_PER_90,
  MIN_WALL_THICKNESS
} from '../printingConstants'

/**
 * Primitives interface for type safety
 */
export interface Primitives {
  // Basic shapes
  box(width: number, depth: number, height: number, centered?: boolean): Shape
  cylinder(height: number, radius: number, segments?: number): Shape
  sphere(radius: number, segments?: number): Shape
  cone(height: number, bottomRadius: number, topRadius?: number, segments?: number): Shape

  // Printing-optimized shapes
  roundedBox(width: number, depth: number, height: number, radius: number, centered?: boolean): Shape
  tube(height: number, outerRadius: number, innerRadius: number, segments?: number): Shape

  // Hole helpers (for clean subtraction)
  hole(diameter: number, depth: number, segments?: number): Shape
  counterboredHole(diameter: number, depth: number, headDiameter: number, headDepth: number, segments?: number): Shape
  countersunkHole(diameter: number, depth: number, headDiameter: number, segments?: number): Shape

  // 2D to 3D
  extrude(profile: [number, number][], height: number): Shape
  revolve(profile: [number, number][], angle?: number, segments?: number): Shape
}

/**
 * Factory function that creates primitive helpers bound to a Manifold instance
 */
export function createPrimitives(M: ManifoldToplevel): Primitives {
  return {
    /**
     * Create a box (rectangular prism)
     * @param width - X dimension
     * @param depth - Y dimension
     * @param height - Z dimension
     * @param centered - If true, center at origin (default: true)
     */
    box(width: number, depth: number, height: number, centered: boolean = true): Shape {
      const manifold = M.Manifold.cube([width, depth, height], centered)
      return new Shape(M, manifold)
    },

    /**
     * Create a cylinder
     * @param height - Z dimension
     * @param radius - Radius
     * @param segments - Number of segments (default: uses global setting)
     */
    cylinder(height: number, radius: number, segments?: number): Shape {
      // segments parameter is circular segments - 0 means use global setting
      const segs = segments ?? 0
      const manifold = M.Manifold.cylinder(height, radius, radius, segs)
      return new Shape(M, manifold)
    },

    /**
     * Create a sphere
     * @param radius - Radius
     * @param segments - Number of segments (default: uses global setting)
     */
    sphere(radius: number, segments?: number): Shape {
      const segs = segments ?? 0
      const manifold = M.Manifold.sphere(radius, segs)
      return new Shape(M, manifold)
    },

    /**
     * Create a cone or truncated cone
     * @param height - Z dimension
     * @param bottomRadius - Radius at bottom (z=0)
     * @param topRadius - Radius at top (default: 0 for pointed cone)
     * @param segments - Number of segments (default: uses global setting)
     */
    cone(height: number, bottomRadius: number, topRadius: number = 0, segments?: number): Shape {
      const segs = segments ?? 0
      const manifold = M.Manifold.cylinder(height, bottomRadius, topRadius, segs)
      return new Shape(M, manifold)
    },

    /**
     * Create a box with rounded corners
     * @param width - X dimension
     * @param depth - Y dimension
     * @param height - Z dimension
     * @param radius - Corner radius
     * @param centered - If true, center at origin (default: true)
     */
    roundedBox(width: number, depth: number, height: number, radius: number, centered: boolean = true): Shape {
      // Clamp radius to max possible
      const maxRadius = Math.min(width, depth) / 2
      const r = Math.min(radius, maxRadius)

      if (r <= 0) {
        // No rounding needed
        const manifold = M.Manifold.cube([width, depth, height], centered)
        return new Shape(M, manifold)
      }

      // Create rounded rectangle cross-section and extrude
      const profile = roundedRect(M, width, depth, r, centered, CORNER_SEGMENTS_PER_90)
      const manifold = profile.extrude(height)
      profile.delete()

      // Center in Z if needed (extrude starts at z=0)
      if (centered) {
        const centeredManifold = manifold.translate(0, 0, -height / 2)
        manifold.delete()
        return new Shape(M, centeredManifold)
      }

      return new Shape(M, manifold)
    },

    /**
     * Create a tube (hollow cylinder)
     * @param height - Z dimension
     * @param outerRadius - Outer radius
     * @param innerRadius - Inner radius (hole)
     * @param segments - Number of segments (default: HOLE_CYLINDER_SEGMENTS for inner)
     */
    tube(height: number, outerRadius: number, innerRadius: number, segments?: number): Shape {
      // Ensure minimum wall thickness
      const maxInner = outerRadius - MIN_WALL_THICKNESS
      const safeInnerRadius = Math.min(innerRadius, maxInner)

      const segs = segments ?? HOLE_CYLINDER_SEGMENTS
      const outer = M.Manifold.cylinder(height, outerRadius, outerRadius, segs)
      const inner = M.Manifold.cylinder(height + 2, safeInnerRadius, safeInnerRadius, segs)
        .translate(0, 0, -1)

      const result = outer.subtract(inner)
      outer.delete()
      inner.delete()

      return new Shape(M, result)
    },

    /**
     * Create a hole for subtraction
     * Extends slightly beyond the surface for clean boolean operations
     * @param diameter - Hole diameter
     * @param depth - Hole depth
     * @param segments - Number of segments (default: HOLE_CYLINDER_SEGMENTS)
     */
    hole(diameter: number, depth: number, segments?: number): Shape {
      const radius = diameter / 2
      const segs = segments ?? HOLE_CYLINDER_SEGMENTS
      // Add extra height for clean subtraction
      const manifold = M.Manifold.cylinder(depth + 2, radius, radius, segs)
        .translate(0, 0, -1)
      return new Shape(M, manifold)
    },

    /**
     * Create a counterbored hole (flat-bottom recess for bolt head)
     * @param diameter - Main hole diameter
     * @param depth - Total depth
     * @param headDiameter - Head recess diameter
     * @param headDepth - Head recess depth
     * @param segments - Number of segments (default: HOLE_CYLINDER_SEGMENTS)
     */
    counterboredHole(
      diameter: number,
      depth: number,
      headDiameter: number,
      headDepth: number,
      segments?: number
    ): Shape {
      const segs = segments ?? HOLE_CYLINDER_SEGMENTS

      // Main hole
      const mainRadius = diameter / 2
      const mainHole = M.Manifold.cylinder(depth + 2, mainRadius, mainRadius, segs)
        .translate(0, 0, -1)

      // Head recess
      const headRadius = headDiameter / 2
      const headRecess = M.Manifold.cylinder(headDepth + 1, headRadius, headRadius, segs)
        .translate(0, 0, depth - headDepth)

      const result = mainHole.add(headRecess)
      mainHole.delete()
      headRecess.delete()

      return new Shape(M, result)
    },

    /**
     * Create a countersunk hole (angled recess for flathead screw)
     * @param diameter - Main hole diameter
     * @param depth - Total depth
     * @param headDiameter - Head opening diameter (at surface)
     * @param segments - Number of segments (default: HOLE_CYLINDER_SEGMENTS)
     */
    countersunkHole(
      diameter: number,
      depth: number,
      headDiameter: number,
      segments?: number
    ): Shape {
      const segs = segments ?? HOLE_CYLINDER_SEGMENTS
      const mainRadius = diameter / 2
      const headRadius = headDiameter / 2

      // If headDiameter <= diameter, countersink is invalid - fall back to regular hole
      if (headRadius <= mainRadius) {
        const manifold = M.Manifold.cylinder(depth + 2, mainRadius, mainRadius, segs)
          .translate(0, 0, -1)
        return new Shape(M, manifold)
      }

      // Main hole
      const mainHole = M.Manifold.cylinder(depth + 2, mainRadius, mainRadius, segs)
        .translate(0, 0, -1)

      // Countersink cone (typical 82° or 90° angle - using 90° for simplicity)
      const coneHeight = (headRadius - mainRadius) // 90° angle means height = radius diff
      const countersink = M.Manifold.cylinder(coneHeight + 0.01, headRadius, mainRadius, segs)
        .translate(0, 0, depth - coneHeight)

      const result = mainHole.add(countersink)
      mainHole.delete()
      countersink.delete()

      return new Shape(M, result)
    },

    /**
     * Extrude a 2D profile to create a 3D shape
     * @param profile - Array of [x, y] points defining the profile
     * @param height - Extrusion height
     */
    extrude(profile: [number, number][], height: number): Shape {
      // Empty or invalid profile - return fallback unit cube
      if (!profile || profile.length < 3) {
        return new Shape(M, M.Manifold.cube([1, 1, 1], true))
      }
      const crossSection = new M.CrossSection([profile])
      const manifold = crossSection.extrude(height)
      crossSection.delete()
      return new Shape(M, manifold)
    },

    /**
     * Revolve a 2D profile around the Y axis
     * @param profile - Array of [x, y] points (x = radius from axis, y = height)
     * @param angle - Rotation angle in degrees (default: 360 for full revolution)
     * @param segments - Number of segments (default: uses global setting)
     */
    revolve(profile: [number, number][], angle: number = 360, segments?: number): Shape {
      // Empty or invalid profile - return fallback unit cube
      if (!profile || profile.length < 3) {
        return new Shape(M, M.Manifold.cube([1, 1, 1], true))
      }
      const crossSection = new M.CrossSection([profile])
      const segs = segments ?? 0
      const manifold = crossSection.revolve(segs, angle)
      crossSection.delete()
      return new Shape(M, manifold)
    }
  }
}

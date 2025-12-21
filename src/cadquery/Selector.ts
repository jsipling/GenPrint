import type { Mesh } from 'manifold-3d'
import type { Vec3, SelectorString, SelectionResult, FaceData, EdgeData, SelectorToken } from './types'
import { SelectorError } from './errors'

/**
 * Engine for parsing and evaluating CadQuery-style selectors.
 */
export class SelectorEngine {
  // @ts-expect-error - M may be used for Manifold API interactions
  constructor(private M: any) {}

  /**
   * Select faces from a mesh based on a selector string.
   */
  selectFaces(mesh: Mesh, selector: SelectorString): SelectionResult {
    const faces = this.extractFaces(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateFaceSelector(faces, tokens)

    return {
      type: 'faces',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => faces.find(f => f.index === i)!.centroid),
      normals: selectedIndices.map(i => faces.find(f => f.index === i)!.normal)
    }
  }

  /**
   * Select edges from a mesh based on a selector string.
   */
  selectEdges(mesh: Mesh, selector: SelectorString): SelectionResult {
    const edges = this.extractEdges(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateEdgeSelector(edges, tokens)

    return {
      type: 'edges',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => edges.find(e => e.index === i)!.midpoint)
    }
  }

  /**
   * Select vertices from a mesh based on a selector string.
   */
  selectVertices(mesh: Mesh, selector: SelectorString): SelectionResult {
    const vertices = this.extractVertices(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateVertexSelector(vertices, tokens)

    return {
      type: 'vertices',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => {
        const v = vertices[i]
        if (!v) throw new Error(`Vertex ${i} not found`)
        return v
      })
    }
  }

  // ==================== Mesh Data Extraction ====================

  private extractFaces(mesh: Mesh): FaceData[] {
    const faces: FaceData[] = []
    const numTris = mesh.numTri

    for (let i = 0; i < numTris; i++) {
      const tri = mesh.verts(i) as ArrayLike<number>
      const v0 = this.getVertex(mesh, tri[0]!)
      const v1 = this.getVertex(mesh, tri[1]!)
      const v2 = this.getVertex(mesh, tri[2]!)

      // Compute face normal
      const e1 = this.subtract(v1, v0)
      const e2 = this.subtract(v2, v0)
      const normal = this.normalize(this.cross(e1, e2))

      // Compute centroid
      const centroid: Vec3 = [
        (v0[0] + v1[0] + v2[0]) / 3,
        (v0[1] + v1[1] + v2[1]) / 3,
        (v0[2] + v1[2] + v2[2]) / 3
      ]

      faces.push({
        index: i,
        centroid,
        normal,
        vertices: [tri[0]!, tri[1]!, tri[2]!]
      })
    }

    return faces
  }

  private extractEdges(mesh: Mesh): EdgeData[] {
    const edgeMap = new Map<string, EdgeData>()
    const numTris = mesh.numTri

    for (let i = 0; i < numTris; i++) {
      const tri = mesh.verts(i) as ArrayLike<number>

      // Process each edge of the triangle
      for (let j = 0; j < 3; j++) {
        const v0idx = tri[j]!
        const v1idx = tri[(j + 1) % 3]!

        // Canonical edge key (smaller index first)
        const key = v0idx < v1idx
          ? `${v0idx}-${v1idx}`
          : `${v1idx}-${v0idx}`

        if (!edgeMap.has(key)) {
          const v0 = this.getVertex(mesh, v0idx as number)
          const v1 = this.getVertex(mesh, v1idx as number)
          const direction = this.normalize(this.subtract(v1, v0))

          edgeMap.set(key, {
            index: edgeMap.size,
            start: v0,
            end: v1,
            midpoint: [
              (v0[0] + v1[0]) / 2,
              (v0[1] + v1[1]) / 2,
              (v0[2] + v1[2]) / 2
            ],
            direction,
            length: this.length(this.subtract(v1, v0))
          })
        }
      }
    }

    return Array.from(edgeMap.values())
  }

  private extractVertices(mesh: Mesh): Vec3[] {
    const vertices: Vec3[] = []
    const numVerts = mesh.numVert

    for (let i = 0; i < numVerts; i++) {
      vertices.push(this.getVertex(mesh, i))
    }

    return vertices
  }

  private getVertex(mesh: Mesh, index: number): Vec3 {
    const pos = mesh.position(index) as ArrayLike<number>
    return [pos[0] || 0, pos[1] || 0, pos[2] || 0]
  }

  // ==================== Selector Parsing ====================

  private parseSelector(selector: SelectorString): SelectorToken[] {
    const tokens: SelectorToken[] = []
    const parts = selector.trim().split(/\s+/)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue

      // Direction selector: >Z, <X, >Y, etc.
      const dirMatch = part.match(/^([><])([XYZ])(?:\[(-?\d+)\])?$/)
      if (dirMatch) {
        const sign = dirMatch[1] === '>' ? 1 : -1
        const axis = dirMatch[2] as 'X' | 'Y' | 'Z'
        tokens.push({ type: 'direction', axis, sign })

        // Handle indexing if present
        if (dirMatch[3] !== undefined) {
          tokens.push({ type: 'index', value: parseInt(dirMatch[3], 10) })
        }
        continue
      }

      // Parallel selector: |Z, |X, |Y
      const parallelMatch = part.match(/^\|([XYZ])$/)
      if (parallelMatch) {
        tokens.push({ type: 'parallel', axis: parallelMatch[1] as 'X' | 'Y' | 'Z' })
        continue
      }

      // Perpendicular selector: #Z, #X, #Y
      const perpMatch = part.match(/^#([XYZ])$/)
      if (perpMatch) {
        tokens.push({ type: 'perpendicular', axis: perpMatch[1] as 'X' | 'Y' | 'Z' })
        continue
      }

      // Boolean operators
      if (part.toLowerCase() === 'and') {
        tokens.push({ type: 'and' })
        continue
      }
      if (part.toLowerCase() === 'or') {
        tokens.push({ type: 'or' })
        continue
      }
      if (part.toLowerCase() === 'not') {
        tokens.push({ type: 'not' })
        continue
      }

      // Radius filter: radius>5, radius<10, radius==3
      const radiusMatch = part.match(/^radius([<>=]+)(\d+\.?\d*)$/)
      if (radiusMatch) {
        const op = radiusMatch[1] as '<' | '>' | '=='
        const value = parseFloat(radiusMatch[2]!)
        tokens.push({ type: 'radius', op, value })
        continue
      }

      throw new SelectorError(`Unknown selector token: ${part}`)
    }

    return tokens
  }

  // ==================== Selector Evaluation ====================

  private evaluateFaceSelector(faces: FaceData[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return faces.map(f => f.index)
    }

    let result: Set<number> = new Set(faces.map(f => f.index))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]
      if (!token) break

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis] as 0 | 1 | 2

        // Sort faces by position on axis
        const sorted = [...faces].sort((a, b) =>
          (a.centroid[axisIndex] - b.centroid[axisIndex]) * token.sign
        )

        // Check for index token
        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.index].filter(x => x !== undefined))
          i += 2
        } else {
          // Return face(s) at extreme position
          const extreme = sorted[sorted.length - 1]?.centroid[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(f => Math.abs(f.centroid[axisIndex] - extreme) < tolerance)
              .map(f => f.index)
          )
          i++
        }
      } else if (token.type === 'parallel') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          faces
            .filter(f => Math.abs(this.dot(f.normal, axisVec)) < 0.1) // Normal perpendicular to axis
            .map(f => f.index)
        )
        i++
      } else if (token.type === 'perpendicular') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          faces
            .filter(f => Math.abs(Math.abs(this.dot(f.normal, axisVec)) - 1) < 0.1) // Normal parallel to axis
            .map(f => f.index)
        )
        i++
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set(Array.from(result).filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set(Array.from(result).concat(Array.from(matches)))
      } else if (pendingOp === 'not') {
        result = new Set(Array.from(result).filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return Array.from(result)
  }

  private evaluateEdgeSelector(edges: EdgeData[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return edges.map(e => e.index)
    }

    let result: Set<number> = new Set(edges.map(e => e.index))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]
      if (!token) break

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis] as 0 | 1 | 2

        // Sort edges by midpoint position on axis
        const sorted = [...edges].sort((a, b) =>
          (a.midpoint[axisIndex] - b.midpoint[axisIndex]) * token.sign
        )

        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.index].filter(x => x !== undefined))
          i += 2
        } else {
          const extreme = sorted[sorted.length - 1]?.midpoint[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(e => Math.abs(e.midpoint[axisIndex] - extreme) < tolerance)
              .map(e => e.index)
          )
          i++
        }
      } else if (token.type === 'parallel') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          edges
            .filter(e => Math.abs(Math.abs(this.dot(e.direction, axisVec)) - 1) < 0.1)
            .map(e => e.index)
        )
        i++
      } else if (token.type === 'perpendicular') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          edges
            .filter(e => Math.abs(this.dot(e.direction, axisVec)) < 0.1)
            .map(e => e.index)
        )
        i++
      } else if (token.type === 'radius') {
        // For edge radius filtering, we'd need curvature analysis
        // This is a placeholder - implement based on edge length as proxy
        const { op, value } = token
        matches = new Set(
          edges
            .filter(e => {
              if (op === '<') return e.length < value
              if (op === '>') return e.length > value
              return Math.abs(e.length - value) < 0.01
            })
            .map(e => e.index)
        )
        i++
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set(Array.from(result).filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set(Array.from(result).concat(Array.from(matches)))
      } else if (pendingOp === 'not') {
        result = new Set(Array.from(result).filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return Array.from(result)
  }

  private evaluateVertexSelector(vertices: Vec3[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return vertices.map((_, i) => i)
    }

    let result: Set<number> = new Set(vertices.map((_, i) => i))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]
      if (!token) break

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis] as 0 | 1 | 2

        const indexed = vertices.map((v, idx) => ({ v, idx }))
        const sorted = indexed.sort((a, b) =>
          (a.v[axisIndex] - b.v[axisIndex]) * token.sign
        )

        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.idx].filter(x => x !== undefined))
          i += 2
        } else {
          const extreme = sorted[sorted.length - 1]?.v[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(item => Math.abs(item.v[axisIndex] - extreme) < tolerance)
              .map(item => item.idx)
          )
          i++
        }
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set(Array.from(result).filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set(Array.from(result).concat(Array.from(matches)))
      } else if (pendingOp === 'not') {
        result = new Set(Array.from(result).filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return Array.from(result)
  }

  // ==================== Vector Math Utilities ====================

  private axisToVec(axis: 'X' | 'Y' | 'Z'): Vec3 {
    return axis === 'X' ? [1, 0, 0] : axis === 'Y' ? [0, 1, 0] : [0, 0, 1]
  }

  private dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]
  }

  private subtract(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  }

  private length(v: Vec3): number {
    return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  }

  private normalize(v: Vec3): Vec3 {
    const len = this.length(v)
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0]
  }
}

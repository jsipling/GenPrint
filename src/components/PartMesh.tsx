import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import type { NamedPart } from '../generators'

// Color constants for part rendering
export const NORMAL_COLOR = '#4a90d9'
export const HOVER_COLOR = '#6ab0f3'
export const HOVER_EMISSIVE = '#1a4a7a'

export interface PartMeshProps {
  part: NamedPart
  isHovered: boolean
  onPointerEnter: () => void
  onPointerLeave: () => void
}

/**
 * Renders a single part mesh with hover state support.
 * Uses React Three Fiber's pointer events for hover detection.
 * Calls stopPropagation() to prevent events from reaching parts behind this one.
 */
export function PartMesh({ part, isHovered, onPointerEnter, onPointerLeave }: PartMeshProps) {
  // Create geometry from part's mesh data, memoized to avoid recreation
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(part.meshData.positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(part.meshData.normals, 3))
    geo.setIndex(new THREE.BufferAttribute(part.meshData.indices, 1))
    geo.computeBoundingBox()
    return geo
  }, [part.meshData])

  // Dispose geometry on unmount or when geometry changes
  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  // Determine colors based on hover state
  const color = isHovered ? HOVER_COLOR : NORMAL_COLOR
  const emissive = isHovered ? HOVER_EMISSIVE : '#000000'

  return (
    <mesh
      geometry={geometry}
      onPointerOver={(e) => {
        e.stopPropagation()
        onPointerEnter()
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onPointerLeave()
      }}
    >
      <meshLambertMaterial
        color={color}
        emissive={emissive}
        flatShading
      />
    </mesh>
  )
}

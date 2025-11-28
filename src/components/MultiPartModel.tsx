import { useState, useEffect, useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { NamedPart } from '../generators'
import { PartMesh } from './PartMesh'
import {
  CAMERA_HEIGHT_MULTIPLIER,
  CAMERA_DISTANCE_MULTIPLIER,
  CAMERA_NEAR_PLANE_RATIO,
  CAMERA_FAR_PLANE_RATIO,
  CAMERA_FAR_PLANE_MIN,
  CAMERA_NEAR_PLANE_MIN
} from './viewerConstants'

function isPerspectiveCamera(camera: THREE.Camera): camera is THREE.PerspectiveCamera {
  return 'fov' in camera && 'near' in camera && 'far' in camera
}

export interface MultiPartModelProps {
  parts: NamedPart[]
  generatorId?: string
  onPartHover: (part: NamedPart | null) => void
}

/**
 * Renders multiple named parts with hover tracking.
 * Handles camera positioning based on combined bounding box of all parts.
 */
export function MultiPartModel({ parts, generatorId, onPartHover }: MultiPartModelProps) {
  const [hoveredPartName, setHoveredPartName] = useState<string | null>(null)
  const { camera, controls } = useThree()
  const lastGeneratorIdRef = useRef<string | null>(null)
  const hasInitializedCameraRef = useRef(false)
  const groupRef = useRef<THREE.Group>(null)

  // Calculate combined bounding box from all parts
  const combinedBounds = useMemo(() => {
    if (parts.length === 0) return null

    const box = new THREE.Box3()
    box.makeEmpty()

    for (const part of parts) {
      const [minX, minY, minZ] = part.boundingBox.min
      const [maxX, maxY, maxZ] = part.boundingBox.max
      box.expandByPoint(new THREE.Vector3(minX, minY, minZ))
      box.expandByPoint(new THREE.Vector3(maxX, maxY, maxZ))
    }

    return box
  }, [parts])

  // Position group and setup camera when parts change
  useEffect(() => {
    const group = groupRef.current
    if (!group || !combinedBounds || parts.length === 0) return

    // Position group so combined bounds min is at origin
    // Guard against test environments where group.position may not exist
    if (group.position?.set) {
      group.position.set(
        -combinedBounds.min.x,
        -combinedBounds.min.y,
        -combinedBounds.min.z
      )
    }

    // Calculate size for camera positioning
    const size = new THREE.Vector3()
    combinedBounds.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

    // Only reset camera when generator changes (not on parameter changes)
    const currentId = generatorId ?? 'default'
    const lastId = lastGeneratorIdRef.current ?? 'default'
    const generatorChanged = currentId !== lastId
    lastGeneratorIdRef.current = currentId

    // Skip camera reset if same generator and camera has been initialized
    if (!generatorChanged && hasInitializedCameraRef.current) {
      // Still update clipping planes for the new geometry size
      if (isPerspectiveCamera(camera)) {
        camera.near = Math.max(CAMERA_NEAR_PLANE_MIN, maxDim * CAMERA_NEAR_PLANE_RATIO)
        camera.far = Math.max(CAMERA_FAR_PLANE_MIN, maxDim * CAMERA_FAR_PLANE_RATIO)
        camera.updateProjectionMatrix()
      }
      return
    }

    hasInitializedCameraRef.current = true

    if (isPerspectiveCamera(camera)) {
      const fov = camera.fov * (Math.PI / 180)
      const distance = maxDim / (2 * Math.tan(fov / 2)) * CAMERA_DISTANCE_MULTIPLIER

      // Calculate center of model (after it's positioned with corner at origin)
      const center = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2)

      camera.position.set(center.x + distance, center.y - distance, center.z + distance * CAMERA_HEIGHT_MULTIPLIER)
      camera.up.set(0, 0, 1)
      camera.lookAt(center)

      // Update OrbitControls target to orbit around model center
      if (controls) {
        const orbitControls = controls as OrbitControlsImpl
        orbitControls.target.copy(center)
        orbitControls.update()
      }

      // Update clipping planes based on model size
      camera.near = Math.max(CAMERA_NEAR_PLANE_MIN, maxDim * CAMERA_NEAR_PLANE_RATIO)
      camera.far = Math.max(CAMERA_FAR_PLANE_MIN, maxDim * CAMERA_FAR_PLANE_RATIO)
      camera.updateProjectionMatrix()
    }
  }, [parts, combinedBounds, camera, generatorId, controls])

  // Handle hover state changes
  const handlePartEnter = (part: NamedPart) => {
    setHoveredPartName(part.name)
    onPartHover(part)
  }

  const handlePartLeave = () => {
    setHoveredPartName(null)
    onPartHover(null)
  }

  if (parts.length === 0) {
    return null
  }

  return (
    <group ref={groupRef}>
      {parts.map((part) => (
        <PartMesh
          key={part.name}
          part={part}
          isHovered={hoveredPartName === part.name}
          onPointerEnter={() => handlePartEnter(part)}
          onPointerLeave={handlePartLeave}
        />
      ))}
    </group>
  )
}

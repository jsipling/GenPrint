import { useRef, useEffect, useState, useMemo, Component, type ReactNode } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { calculateTicksAndLabels, calculateGridParams } from './gridUtils'
import { validateMeshData, MeshValidationError, type MeshData } from './meshValidation'
import {
  GRID_LINE_Z_OFFSET,
  AXIS_LABEL_OFFSET,
  CAMERA_HEIGHT_MULTIPLIER,
  CAMERA_DISTANCE_MULTIPLIER,
  CAMERA_NEAR_PLANE_RATIO,
  CAMERA_FAR_PLANE_RATIO,
  CAMERA_FAR_PLANE_MIN,
  CAMERA_NEAR_PLANE_MIN,
  ZOOM_SPEED,
  PAN_SPEED_MIN,
  PAN_SPEED_SCALE,
  PAN_SPEED_UPDATE_THRESHOLD,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_INTENSITY
} from './viewerConstants'

// Error boundary to catch WebGL/Canvas crashes
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Canvas error:', error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-900 text-red-400">
          <div className="text-center">
            <p className="text-lg font-medium">3D Viewer Error</p>
            <p className="text-sm mt-2 text-gray-400">
              {this.state.error?.message || 'WebGL context lost or unavailable'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Light that follows the camera - always illuminates from viewer's perspective
function CameraLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null)

  useFrame(({ camera }) => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position)
    }
  })

  return <directionalLight ref={lightRef} intensity={DIRECTIONAL_LIGHT_INTENSITY} />
}

// Dynamic pan speed controls - scales with camera distance
function DynamicControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastDistanceRef = useRef(0)

  useFrame(({ camera }) => {
    if (controlsRef.current) {
      const distance = camera.position.length()
      // Only update pan speed if distance changed by threshold
      if (Math.abs(distance - lastDistanceRef.current) > distance * PAN_SPEED_UPDATE_THRESHOLD) {
        lastDistanceRef.current = distance
        controlsRef.current.panSpeed = Math.max(PAN_SPEED_MIN, distance * PAN_SPEED_SCALE)
      }
    }
  })

  return <OrbitControls ref={controlsRef} makeDefault zoomSpeed={ZOOM_SPEED} />
}

// Grid with measurement labels (Z-up coordinate system)
function MeasuredGrid({ size = 100, divisions = 10 }: { size?: number; divisions?: number }) {
  // Memoize tick and label calculations to avoid recreating on every render
  const { ticks, labels } = useMemo(() => calculateTicksAndLabels(size), [size])

  // Memoize label style to avoid object recreation
  const labelStyle = useMemo(() => ({
    fontSize: '9px',
    color: '#888',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const
  }), [])

  const axisLabelStyle = useMemo(() => ({
    fontSize: '12px',
    fontWeight: 'bold' as const
  }), [])

  return (
    <group>
      {/* Grid on XY plane (rotated from default XZ) */}
      <gridHelper args={[size, divisions, '#555', '#333']} rotation={[Math.PI / 2, 0, 0]} />

      {/* Main axis lines (positive direction only) */}
      <Line points={[[0, 0, GRID_LINE_Z_OFFSET], [size/2, 0, GRID_LINE_Z_OFFSET]]} color="#ff4444" lineWidth={2} />
      <Line points={[[0, 0, GRID_LINE_Z_OFFSET], [0, size/2, GRID_LINE_Z_OFFSET]]} color="#44ff44" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, size/2]]} color="#4444ff" lineWidth={2} />

      {/* Tick marks */}
      {ticks.map((tick, i) => (
        <Line key={`tick-${i}`} points={tick.points} color={tick.color} lineWidth={1} />
      ))}

      {/* Measurement labels - reduced count for performance */}
      {labels.map((label, i) => (
        <Html key={`label-${i}`} position={label.pos} style={labelStyle} center>
          {label.text}
        </Html>
      ))}

      {/* Axis labels */}
      <Html position={[size/2 + AXIS_LABEL_OFFSET, 0, 0]} style={{ ...axisLabelStyle, color: '#ff6666' }} center>
        X (mm)
      </Html>
      <Html position={[0, size/2 + AXIS_LABEL_OFFSET, 0]} style={{ ...axisLabelStyle, color: '#66ff66' }} center>
        Y (mm)
      </Html>
      <Html position={[0, 0, size/2 + AXIS_LABEL_OFFSET]} style={{ ...axisLabelStyle, color: '#6666ff' }} center>
        Z (mm)
      </Html>
    </group>
  )
}

interface ModelProps {
  geometry: THREE.BufferGeometry
  /** Generator ID - camera only resets when this changes */
  generatorId?: string
}

function Model({ geometry, generatorId }: ModelProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const lastGeneratorIdRef = useRef<string | null>(null)
  const hasInitializedCameraRef = useRef(false)

  useEffect(() => {
    if (!meshRef.current) return

    // computeBoundingBox() only computes and caches the box, it doesn't mutate vertex data
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return

    // Place model corner at origin (min X, Y, Z all at 0)
    if (meshRef.current) {
      meshRef.current.position.set(-box.min.x, -box.min.y, -box.min.z)
    }

    // Only reset camera when generator changes (not on parameter changes)
    // Use null coalescing to treat undefined as 'default' for comparison
    const currentId = generatorId ?? 'default'
    const lastId = lastGeneratorIdRef.current ?? 'default'
    const generatorChanged = currentId !== lastId
    lastGeneratorIdRef.current = currentId

    // Skip camera reset if same generator and camera has been initialized
    if (!generatorChanged && hasInitializedCameraRef.current) {
      // Still update clipping planes for the new geometry size
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const perspCamera = camera as THREE.PerspectiveCamera
      perspCamera.near = Math.max(CAMERA_NEAR_PLANE_MIN, maxDim * CAMERA_NEAR_PLANE_RATIO)
      perspCamera.far = Math.max(CAMERA_FAR_PLANE_MIN, maxDim * CAMERA_FAR_PLANE_RATIO)
      camera.updateProjectionMatrix()
      return
    }

    hasInitializedCameraRef.current = true

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const perspCamera = camera as THREE.PerspectiveCamera
    const fov = perspCamera.fov * (Math.PI / 180)
    const distance = maxDim / (2 * Math.tan(fov / 2)) * CAMERA_DISTANCE_MULTIPLIER

    camera.position.set(distance, -distance, distance * CAMERA_HEIGHT_MULTIPLIER)
    camera.up.set(0, 0, 1)
    camera.lookAt(0, 0, 0)

    // Update clipping planes based on model size to prevent large models from being clipped
    perspCamera.near = Math.max(CAMERA_NEAR_PLANE_MIN, maxDim * CAMERA_NEAR_PLANE_RATIO)
    perspCamera.far = Math.max(CAMERA_FAR_PLANE_MIN, maxDim * CAMERA_FAR_PLANE_RATIO)
    camera.updateProjectionMatrix()
  }, [geometry, camera, generatorId])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshLambertMaterial color="#4a90d9" flatShading />
    </mesh>
  )
}

interface ViewerProps {
  /** STL blob from OpenSCAD compilation */
  stlBlob?: Blob | null
  /** Direct mesh data from Manifold (takes precedence over stlBlob) */
  meshData?: MeshData | null
  isCompiling: boolean
  /** Generator ID - camera resets only when this changes */
  generatorId?: string
}

export function Viewer({ stlBlob, meshData, isCompiling, generatorId }: ViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modelMaxDim, setModelMaxDim] = useState<number>(0)
  const blobIdRef = useRef(0)
  const meshDataIdRef = useRef(0)

  // Handle direct mesh data from Manifold (takes precedence)
  useEffect(() => {
    if (!meshData) return

    const currentId = ++meshDataIdRef.current

    try {
      // Validate before processing
      validateMeshData(meshData)

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
      geo.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
      geo.setIndex(new THREE.BufferAttribute(meshData.indices, 1))
      geo.computeBoundingBox()

      // Bail if superseded
      if (currentId !== meshDataIdRef.current) {
        geo.dispose()
        return
      }

      // Calculate model size for grid sizing
      if (geo.boundingBox) {
        const size = new THREE.Vector3()
        geo.boundingBox.getSize(size)
        setModelMaxDim(Math.max(size.x, size.y, size.z))
      }

      setGeometry((prev) => {
        prev?.dispose()
        return geo
      })
      setLoadError(null)
    } catch (err) {
      if (currentId !== meshDataIdRef.current) return
      if (import.meta.env.DEV) console.error('Mesh data error:', err)
      if (err instanceof MeshValidationError) {
        setLoadError(`Invalid mesh: ${err.message}`)
      } else {
        setLoadError(err instanceof Error ? err.message : 'Failed to load mesh data')
      }
    }
  }, [meshData])

  // Handle STL blob from OpenSCAD (only if no meshData)
  useEffect(() => {
    // Skip if we have direct mesh data
    if (meshData) return

    if (!stlBlob) {
      setGeometry((prev) => {
        prev?.dispose()
        return null
      })
      setModelMaxDim(0)
      return
    }

    // Track blob version to prevent stale reads
    const currentBlobId = ++blobIdRef.current
    const loader = new STLLoader()
    const reader = new FileReader()

    reader.onload = () => {
      // Bail if a newer blob arrived while reading
      if (currentBlobId !== blobIdRef.current) return

      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const geo = loader.parse(arrayBuffer)

        // Keep OpenSCAD's Z-up orientation (no rotation needed)

        geo.computeVertexNormals()
        geo.computeBoundingBox()

        // Calculate model size for grid sizing
        if (geo.boundingBox) {
          const size = new THREE.Vector3()
          geo.boundingBox.getSize(size)
          setModelMaxDim(Math.max(size.x, size.y, size.z))
        }

        // Dispose old geometry and set new one
        setGeometry((prev) => {
          prev?.dispose()
          return geo
        })
        setLoadError(null)
      } catch (err) {
        if (import.meta.env.DEV) console.error('STL parse error:', err)
        setLoadError(err instanceof Error ? err.message : 'Failed to parse STL')
      }
    }

    reader.onerror = () => {
      if (currentBlobId !== blobIdRef.current) return
      setLoadError('Failed to read STL blob')
    }

    reader.readAsArrayBuffer(stlBlob)

    // Cleanup: abort reader if blob changes before read completes
    return () => {
      reader.abort()
    }
  }, [stlBlob, meshData])

  // Dispose geometry on unmount
  useEffect(() => {
    return () => {
      setGeometry((prev) => {
        prev?.dispose()
        return null
      })
    }
  }, [])

  // Grid size: default 400mm, grows with model if larger
  const { gridSize, gridDivisions } = calculateGridParams(modelMaxDim)

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Always render Canvas to preserve WebGL context */}
      <CanvasErrorBoundary>
        <Canvas camera={{ position: [50, -50, 40], fov: 50, up: [0, 0, 1] }}>
          <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
          <CameraLight />
          {geometry && <Model geometry={geometry} generatorId={generatorId} />}
          <DynamicControls />
          <MeasuredGrid size={gridSize} divisions={gridDivisions} />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Overlay states */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-red-400">Error: {loadError}</div>
        </div>
      )}

      {isCompiling && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50" role="status" aria-live="polite">
          <div className="text-white flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Compiling...</span>
          </div>
        </div>
      )}

      {!geometry && !isCompiling && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
          <div className="text-gray-500">Waiting for model...</div>
        </div>
      )}
    </div>
  )
}

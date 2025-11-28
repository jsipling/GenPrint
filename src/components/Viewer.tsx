import { useRef, useEffect, useState, useMemo, useCallback, Component, type ReactNode, type MouseEvent } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { calculateTicksAndLabels, calculateGridParams } from './gridUtils'
import { validateMeshData, MeshValidationError, type MeshData } from './meshValidation'
import type { BoundingBox, DisplayDimension, ParameterValues, NamedPart } from '../generators'
import { MultiPartModel } from './MultiPartModel'
import { PartTooltip } from './PartTooltip'
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

function isPerspectiveCamera(camera: THREE.Camera): camera is THREE.PerspectiveCamera {
  return 'fov' in camera && 'near' in camera && 'far' in camera
}

// Error boundary to catch WebGL/Canvas crashes
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  resetKey?: number
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKey changes (new data arrived)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
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
    return (
      <div className="w-full h-full" data-error-boundary-key={this.props.resetKey}>
        {this.props.children}
      </div>
    )
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
  const { camera, controls } = useThree()
  const lastGeneratorIdRef = useRef<string | null>(null)
  const hasInitializedCameraRef = useRef(false)

  useEffect(() => {
    // Capture mesh ref at effect start to avoid race conditions
    // Also verify mesh has position property (guards against test mocks without Three.js mesh)
    const mesh = meshRef.current
    if (!mesh || !mesh.position) return

    // computeBoundingBox() only computes and caches the box, it doesn't mutate vertex data
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return

    // Place model corner at origin (min X, Y, Z all at 0)
    mesh.position.set(-box.min.x, -box.min.y, -box.min.z)

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
      if (isPerspectiveCamera(camera)) {
        camera.near = Math.max(CAMERA_NEAR_PLANE_MIN, maxDim * CAMERA_NEAR_PLANE_RATIO)
        camera.far = Math.max(CAMERA_FAR_PLANE_MIN, maxDim * CAMERA_FAR_PLANE_RATIO)
        camera.updateProjectionMatrix()
      }
      return
    }

    hasInitializedCameraRef.current = true

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)

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
  }, [geometry, camera, generatorId, controls])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshLambertMaterial color="#4a90d9" flatShading />
    </mesh>
  )
}

/**
 * Formats a number for display in the dimension panel.
 * Shows 1 decimal place for non-integers, whole number otherwise.
 */
function formatDimension(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1)
}

/**
 * Gets a nested parameter value from params using dot notation.
 * e.g., "bore.diameter" gets params.bore.diameter
 */
function getNestedParam(params: ParameterValues, path: string): number | string | boolean | undefined {
  const parts = path.split('.')
  let current: unknown = params
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current as number | string | boolean | undefined
}

interface DimensionPanelProps {
  boundingBox?: BoundingBox | null
  displayDimensions?: DisplayDimension[]
  params?: ParameterValues
  isLoading?: boolean
}

/**
 * Overlay panel showing model dimensions and key feature measurements.
 */
function DimensionPanel({ boundingBox, displayDimensions, params, isLoading }: DimensionPanelProps) {
  // Calculate bounding box dimensions
  const boxDimensions = useMemo(() => {
    if (!boundingBox) return null
    const [minX, minY, minZ] = boundingBox.min
    const [maxX, maxY, maxZ] = boundingBox.max
    return {
      width: maxX - minX,
      depth: maxY - minY,
      height: maxZ - minZ
    }
  }, [boundingBox])

  // Format feature dimensions from displayDimensions config
  const featureDimensions = useMemo(() => {
    if (!displayDimensions || !params) return []
    return displayDimensions.map(dim => {
      const value = getNestedParam(params, dim.param)
      if (value === undefined) return null

      // Format the value
      let formattedValue: string
      if (typeof value === 'number') {
        if (dim.format) {
          formattedValue = dim.format.replace('{value}', formatDimension(value))
        } else {
          formattedValue = `${formatDimension(value)}mm`
        }
      } else {
        formattedValue = String(value)
      }

      return { label: dim.label, value: formattedValue }
    }).filter((d): d is { label: string; value: string } => d !== null)
  }, [displayDimensions, params])

  return (
    <div
      className="absolute top-3 right-3 bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700 text-white text-sm font-mono shadow-lg"
      style={{ minWidth: '140px' }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 text-gray-400 text-xs flex items-center gap-1.5">
        <span>📐</span>
        <span>Dimensions</span>
      </div>

      {/* Bounding box dimensions */}
      <div className="px-3 py-2 border-b border-gray-700">
        {isLoading || !boxDimensions ? (
          <span className="text-gray-500">—</span>
        ) : (
          <span>
            {formatDimension(boxDimensions.width)} × {formatDimension(boxDimensions.depth)} × {formatDimension(boxDimensions.height)} mm
          </span>
        )}
      </div>

      {/* Feature dimensions */}
      {featureDimensions.length > 0 && (
        <div className="px-3 py-2">
          {featureDimensions.map((dim, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span className="text-gray-400">{dim.label}</span>
              <span>{isLoading ? '—' : dim.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ViewerProps {
  /** Mesh data from Manifold builder (single-part) */
  meshData?: MeshData | null
  /** Named parts from Manifold builder (multi-part) */
  parts?: NamedPart[] | null
  isCompiling: boolean
  /** Generator ID - camera resets only when this changes */
  generatorId?: string
  /** Bounding box from Manifold */
  boundingBox?: BoundingBox | null
  /** Display dimensions configuration from generator */
  displayDimensions?: DisplayDimension[]
  /** Current parameter values */
  params?: ParameterValues
  /** Callback when hovered part changes (for tooltip in Phase 5) */
  onHoveredPartChange?: (part: NamedPart | null) => void
}

export function Viewer({ meshData, parts, isCompiling, generatorId, boundingBox, displayDimensions, params, onHoveredPartChange }: ViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modelMaxDim, setModelMaxDim] = useState<number>(0)
  const [errorBoundaryKey, setErrorBoundaryKey] = useState(0)
  const [hoveredPart, setHoveredPart] = useState<NamedPart | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const meshDataIdRef = useRef(0)

  // Handle mouse move to track position for tooltip
  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!viewerRef.current) return
    const rect = viewerRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }, [])

  // Clear mouse position when leaving viewer
  const handleMouseLeave = useCallback(() => {
    setMousePosition(null)
  }, [])

  // Notify parent when hovered part changes
  useEffect(() => {
    onHoveredPartChange?.(hoveredPart)
  }, [hoveredPart, onHoveredPartChange])

  // Determine if we have multi-part or single-part data
  const hasMultiPart = parts && parts.length > 0
  const hasSinglePart = !hasMultiPart && meshData

  // Calculate model max dimension from parts for grid sizing
  useEffect(() => {
    if (!hasMultiPart || !parts || parts.length === 0) return

    // Calculate combined bounds from all parts
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (const part of parts) {
      const [pMinX, pMinY, pMinZ] = part.boundingBox.min
      const [pMaxX, pMaxY, pMaxZ] = part.boundingBox.max
      minX = Math.min(minX, pMinX)
      minY = Math.min(minY, pMinY)
      minZ = Math.min(minZ, pMinZ)
      maxX = Math.max(maxX, pMaxX)
      maxY = Math.max(maxY, pMaxY)
      maxZ = Math.max(maxZ, pMaxZ)
    }

    const sizeX = maxX - minX
    const sizeY = maxY - minY
    const sizeZ = maxZ - minZ
    setModelMaxDim(Math.max(sizeX, sizeY, sizeZ))
    setErrorBoundaryKey(k => k + 1)
  }, [parts, hasMultiPart])

  // Handle direct mesh data from Manifold (single-part mode)
  useEffect(() => {
    if (!meshData || hasMultiPart) return

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
      setErrorBoundaryKey(k => k + 1)
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
    <div
      ref={viewerRef}
      className="relative w-full h-full bg-gray-900"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Always render Canvas to preserve WebGL context */}
      <CanvasErrorBoundary resetKey={errorBoundaryKey}>
        <Canvas camera={{ position: [50, -50, 40], fov: 50, up: [0, 0, 1] }}>
          <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
          <CameraLight />
          {hasMultiPart && parts && (
            <MultiPartModel
              parts={parts}
              generatorId={generatorId}
              onPartHover={setHoveredPart}
            />
          )}
          {hasSinglePart && geometry && (
            <Model geometry={geometry} generatorId={generatorId} />
          )}
          <DynamicControls />
          <MeasuredGrid size={gridSize} divisions={gridDivisions} />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Dimension panel overlay */}
      <DimensionPanel
        boundingBox={boundingBox}
        displayDimensions={displayDimensions}
        params={params}
        isLoading={isCompiling || (!hasMultiPart && !geometry)}
      />

      {/* Part hover tooltip */}
      <PartTooltip part={hoveredPart} position={mousePosition} />

      {/* Overlay states */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-red-400">Error: {loadError}</div>
        </div>
      )}

      {!hasMultiPart && !geometry && !isCompiling && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
          <div className="text-gray-500">Waiting for model...</div>
        </div>
      )}
    </div>
  )
}

import { useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { calculateTicksAndLabels, calculateGridParams } from './gridUtils'

// Dynamic pan speed controls - scales with camera distance
function DynamicControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  useFrame(({ camera }) => {
    if (controlsRef.current) {
      // Scale pan speed with camera distance (closer = faster relative movement)
      const distance = camera.position.length()
      const basePanSpeed = 0.02
      controlsRef.current.panSpeed = Math.max(0.5, distance * basePanSpeed)
    }
  })

  return <OrbitControls ref={controlsRef} makeDefault zoomSpeed={1.5} />
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
      <Line points={[[0, 0, 0.01], [size/2, 0, 0.01]]} color="#ff4444" lineWidth={2} />
      <Line points={[[0, 0, 0.01], [0, size/2, 0.01]]} color="#44ff44" lineWidth={2} />
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
      <Html position={[size/2 + 5, 0, 0]} style={{ ...axisLabelStyle, color: '#ff6666' }} center>
        X (mm)
      </Html>
      <Html position={[0, size/2 + 5, 0]} style={{ ...axisLabelStyle, color: '#66ff66' }} center>
        Y (mm)
      </Html>
      <Html position={[0, 0, size/2 + 5]} style={{ ...axisLabelStyle, color: '#6666ff' }} center>
        Z (mm)
      </Html>
    </group>
  )
}

interface ModelProps {
  geometry: THREE.BufferGeometry
}

function Model({ geometry }: ModelProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

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

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const perspCamera = camera as THREE.PerspectiveCamera
    const fov = perspCamera.fov * (Math.PI / 180)
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5

    camera.position.set(distance, -distance, distance * 0.8)
    camera.up.set(0, 0, 1)
    camera.lookAt(0, 0, 0)

    // Update clipping planes based on model size to prevent large models from being clipped
    perspCamera.near = Math.max(0.1, maxDim * 0.001)
    perspCamera.far = Math.max(2000, maxDim * 10)
    camera.updateProjectionMatrix()
  }, [geometry, camera])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial color="#4a90d9" metalness={0.3} roughness={0.6} />
    </mesh>
  )
}

interface ViewerProps {
  stlBlob: Blob | null
  isCompiling: boolean
}

export function Viewer({ stlBlob, isCompiling }: ViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modelMaxDim, setModelMaxDim] = useState<number>(0)
  const blobIdRef = useRef(0)

  useEffect(() => {
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
  }, [stlBlob])

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
      <Canvas camera={{ position: [50, -50, 40], fov: 50, up: [0, 0, 1] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        {geometry && <Model geometry={geometry} />}
        <DynamicControls />
        <MeasuredGrid size={gridSize} divisions={gridDivisions} />
      </Canvas>

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

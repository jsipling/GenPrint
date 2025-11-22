import { useRef, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'

// Grid with measurement labels (Z-up coordinate system)
function MeasuredGrid({ size = 100, divisions = 10 }: { size?: number; divisions?: number }) {
  const tickSize = 1.5 // Length of tick marks
  const smallTickSize = 0.8 // Length of small (5mm) tick marks

  // Generate tick marks and labels along axes
  const ticks: { points: [[number, number, number], [number, number, number]]; color: string }[] = []
  const labels: { pos: [number, number, number]; text: string; size: string }[] = []

  // X axis ticks and labels (positive only)
  for (let mm = 1; mm <= size / 2; mm += 1) {
    const isCm = mm % 10 === 0
    const is5mm = mm % 5 === 0
    const tick = isCm ? tickSize : (is5mm ? smallTickSize : 0.4)

    // Tick on X axis
    ticks.push({ points: [[mm, -tick, 0.01], [mm, tick, 0.01]], color: '#ff4444' })

    // Label every 10mm (1cm)
    if (isCm) {
      labels.push({ pos: [mm, -tickSize - 2, 0], text: `${mm}`, size: '9px' })
    }
  }

  // Y axis ticks and labels (positive only)
  for (let mm = 1; mm <= size / 2; mm += 1) {
    const isCm = mm % 10 === 0
    const is5mm = mm % 5 === 0
    const tick = isCm ? tickSize : (is5mm ? smallTickSize : 0.4)

    // Tick on Y axis
    ticks.push({ points: [[-tick, mm, 0.01], [tick, mm, 0.01]], color: '#44ff44' })

    // Label every 10mm (1cm)
    if (isCm) {
      labels.push({ pos: [-tickSize - 2, mm, 0], text: `${mm}`, size: '9px' })
    }
  }

  // Z axis ticks and labels (vertical, positive only)
  for (let mm = 1; mm <= size / 2; mm += 1) {
    const isCm = mm % 10 === 0
    const is5mm = mm % 5 === 0
    const tick = isCm ? tickSize : (is5mm ? smallTickSize : 0.4)

    // Tick on Z axis
    ticks.push({ points: [[-tick, 0, mm], [tick, 0, mm]], color: '#4444ff' })
    ticks.push({ points: [[0, -tick, mm], [0, tick, mm]], color: '#4444ff' })

    // Label every 10mm (1cm)
    if (isCm) {
      labels.push({ pos: [-tickSize - 2, -tickSize - 2, mm], text: `${mm}`, size: '9px' })
    }
  }

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

      {/* Measurement labels */}
      {labels.map((label, i) => (
        <Html
          key={`label-${i}`}
          position={label.pos}
          style={{
            fontSize: label.size,
            color: '#888',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          center
        >
          {label.text}
        </Html>
      ))}

      {/* Axis labels */}
      <Html position={[size/2 + 5, 0, 0]} style={{ color: '#ff6666', fontSize: '12px', fontWeight: 'bold' }} center>
        X (mm)
      </Html>
      <Html position={[0, size/2 + 5, 0]} style={{ color: '#66ff66', fontSize: '12px', fontWeight: 'bold' }} center>
        Y (mm)
      </Html>
      <Html position={[0, 0, size/2 + 5]} style={{ color: '#6666ff', fontSize: '12px', fontWeight: 'bold' }} center>
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

    // Clone geometry to avoid mutating the original
    const geo = geometry.clone()
    geo.computeBoundingBox()
    const box = geo.boundingBox
    if (!box) return

    const center = new THREE.Vector3()
    box.getCenter(center)

    // Place model corner at origin (min X, Y, Z all at 0)
    if (meshRef.current) {
      meshRef.current.position.set(-box.min.x, -box.min.y, -box.min.z)
    }

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5

    camera.position.set(distance, -distance, distance * 0.8)
    camera.up.set(0, 0, 1)
    camera.lookAt(0, 0, 0)
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

  useEffect(() => {
    if (!stlBlob) {
      setGeometry(null)
      return
    }

    const loader = new STLLoader()
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const geo = loader.parse(arrayBuffer)

        // Keep OpenSCAD's Z-up orientation (no rotation needed)

        geo.computeVertexNormals()
        setGeometry(geo)
        setLoadError(null)
      } catch (err) {
        console.error('STL parse error:', err)
        setLoadError(err instanceof Error ? err.message : 'Failed to parse STL')
      }
    }

    reader.onerror = () => {
      setLoadError('Failed to read STL blob')
    }

    reader.readAsArrayBuffer(stlBlob)
  }, [stlBlob])

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Always render Canvas to preserve WebGL context */}
      <Canvas camera={{ position: [50, -50, 40], fov: 50, up: [0, 0, 1] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        {geometry && <Model geometry={geometry} />}
        <OrbitControls makeDefault />
        <MeasuredGrid size={100} divisions={10} />
      </Canvas>

      {/* Overlay states */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-red-400">Error: {loadError}</div>
        </div>
      )}

      {isCompiling && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Compiling...
          </div>
        </div>
      )}

      {!geometry && !isCompiling && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-gray-500">Waiting for model...</div>
        </div>
      )}
    </div>
  )
}

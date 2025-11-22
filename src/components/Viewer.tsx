import { useRef, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three-stdlib'

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

    // Center the mesh
    if (meshRef.current) {
      meshRef.current.position.set(-center.x, -center.y, -center.z)
    }

    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5

    camera.position.set(distance, distance * 0.5, distance)
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

        // Rotate from OpenSCAD's Z-up to Three.js Y-up orientation
        geo.rotateX(-Math.PI / 2)

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
      <Canvas camera={{ position: [50, 50, 50], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        {geometry && <Model geometry={geometry} />}
        <OrbitControls makeDefault />
        <gridHelper args={[100, 10, '#444', '#333']} />
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

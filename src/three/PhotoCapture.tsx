import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'

/**
 * Grabs the rendered frame whenever `request` changes. Runs after the post-processing
 * pass (priority 1) in the same frame, so the drawing buffer still holds the image.
 */
export function PhotoCapture({ request, onCapture }: { request: number; onCapture: (dataUrl: string) => void }) {
  const gl = useThree((s) => s.gl)
  const handled = useRef(request)

  useFrame(() => {
    if (request === handled.current) return
    handled.current = request
    onCapture(gl.domElement.toDataURL('image/png'))
  }, 2)

  return null
}

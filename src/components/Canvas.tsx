import {forwardRef, ReactNode} from 'react'

interface CanvasProps {
  children?: ReactNode
}

const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>((props, ref) => {
  return <canvas ref={ref} />
})

export default Canvas

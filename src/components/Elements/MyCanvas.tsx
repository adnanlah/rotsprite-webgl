import {forwardRef, ReactNode} from 'react'

interface MyCanvasProps {
  children?: ReactNode
}

export const MyCanvas = forwardRef<HTMLCanvasElement, MyCanvasProps>(
  (props, ref) => {
    return <canvas ref={ref} />
  },
)

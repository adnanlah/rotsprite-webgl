import {useDebouncedValue} from '@mantine/hooks'
import {createRef, useEffect, useMemo, useState} from 'react'
import Button from './Button'
import Canvas from './Canvas'

interface RotspriteToolProps {
  imageUrl?: string
  fileName?: string
  title: string
  errorHandler: (errorMessage: string) => void
  algorithmFunc: (
    canvas: HTMLCanvasElement,
    imageUrl: string,
    DEGREE: number,
  ) => Promise<string>
}

function RotspriteTool({
  imageUrl,
  fileName,
  title,
  errorHandler,
  algorithmFunc,
}: RotspriteToolProps) {
  const canvasRef = createRef<HTMLCanvasElement>()
  const linkRef = createRef<HTMLAnchorElement>()
  const [processing, setProcessing] = useState<Boolean>(false)
  const [rotationDeg, setRotationDeg] = useState<string>('0')
  const [debouncedRotationDeg] = useDebouncedValue<string>(rotationDeg, 700)
  const [globalUrl, setGlobalUrl] = useState<string>()
  const [processCache, setProcessCache] = useState<{
    imageUrl: string
    imageDataBase64: string
    rotationDeg: string
  }>({imageUrl: '', imageDataBase64: '', rotationDeg: '0'})

  const rotationDegInt = parseInt(rotationDeg)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setRotationDeg('0'), [imageUrl])

  useEffect(() => {
    ;(async function processImage() {
      if (
        canvasRef.current &&
        imageUrl &&
        imageUrl !== processCache[imageUrl as keyof typeof processCache] &&
        rotationDeg !== processCache[rotationDeg as keyof typeof processCache]
      ) {
        try {
          setProcessing(true)
          const imageDataBase64 = await algorithmFunc(
            canvasRef.current,
            imageUrl,
            rotationDegInt,
          )
          setGlobalUrl(imageDataBase64)
          setProcessCache({
            imageUrl,
            imageDataBase64,
            rotationDeg,
          })
          setProcessing(false)
        } catch (err: any) {
          setProcessing(false)
          errorHandler(err.message)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef.current, debouncedRotationDeg, imageUrl])

  const downloadImage = () => {
    linkRef.current?.click()
  }

  return (
    <section className="tool">
      <div>
        <h4>{title}</h4>
        <div>
          <label>Rotation degree ({rotationDeg}°): </label>
          <div>
            <input
              value={rotationDeg}
              onChange={e => {
                setRotationDeg(e.target.value)
              }}
              disabled={!!(!imageUrl || processing)}
              type="range"
              min="0"
              max="360"
            />
          </div>
        </div>
      </div>
      <div className={`canvasWrapper ${!globalUrl && 'placeholder'}`}>
        {processing && (
          <div className="spinWrapper">
            <div className="spinnerSquare"></div>
          </div>
        )}
        <Canvas ref={canvasRef} />
      </div>
      <Button onClick={downloadImage} disabled={!!(!imageUrl || processing)}>
        Download
      </Button>
      <a
        ref={linkRef}
        href={globalUrl}
        download={`${rotationDeg}deg-${title}-${fileName}`}
        style={{display: 'none'}}
      >
        Download image
      </a>
    </section>
  )
}

export default RotspriteTool

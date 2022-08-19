import {loadImage} from './helpers'

let UPSCALED_IMAGE_CACHE: Record<string, string[]> = {}

const jsAlgorithm = async (
  canvas: HTMLCanvasElement,
  imageUrl: string,
  DEGREE: number,
): Promise<string> => {
  const SCALE = 8
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No context!')
  const img = (await loadImage(imageUrl)) as HTMLImageElement
  const {naturalWidth, naturalHeight} = img
  if (naturalWidth > 512 || naturalHeight > 512) {
    throw new Error('Size exceeded')
  }
  canvas.width = naturalWidth
  canvas.height = naturalHeight
  context.drawImage(img, 0, 0)
  const imageData = context.getImageData(
    0,
    0,
    img.naturalWidth,
    img.naturalHeight,
  ).data

  if (DEGREE === 0) {
    return canvas.toDataURL('image/png')
  }

  const reduced = reduceImage(imageData)

  if (!UPSCALED_IMAGE_CACHE[imageUrl]) {
    UPSCALED_IMAGE_CACHE[imageUrl] = upscaleImageEPX(
      reduced,
      naturalWidth,
      naturalHeight,
      SCALE,
    )
  }

  let {rotated, rotW, rotH} = rotate(
    UPSCALED_IMAGE_CACHE[imageUrl],
    naturalWidth * SCALE,
    naturalHeight * SCALE,
    DEGREE,
  )

  let {
    downscaled,
    width: finalWidth,
    height: finalHeight,
  } = downscaleNNTopLeft(rotated, rotW, rotH, SCALE, 2)

  let finalResult = flattenImage(downscaled)

  const imageDataFinal = new ImageData(
    new Uint8ClampedArray(finalResult),
    finalWidth,
    finalHeight,
  )

  canvas.width = finalWidth
  canvas.height = finalHeight
  context.putImageData(imageDataFinal, 0, 0)
  return canvas.toDataURL('image/png')
}

const reduceImage = (imageData: Uint8ClampedArray) => {
  return imageData.reduce((acc, curr, idx, array) => {
    if (idx % 4 === 0) {
      return acc.concat(stringifyRGBA(array.slice(idx, idx + 4)))
    } else return acc
  }, [] as string[])
}

const upscaleImageEPX = (
  imageData: string[],
  srcW: number,
  srcH: number,
  scale: number,
): string[] => {
  if (scale === 1) return imageData

  let dstA = new Array(imageData.length * 4)
  let dstIt1 = 0
  let dstIt2 = 0

  for (let y = 0; y < srcH; y++) {
    dstIt2 += srcW * 2
    for (let x = 0; x < srcW; x++) {
      const p = imageData[getIdx(srcW, y, x)],
        a = y > 0 ? imageData[getIdx(srcW, y - 1, x)] : p,
        b = x < srcW - 1 ? imageData[getIdx(srcW, y, x + 1)] : p,
        c = x > 0 ? imageData[getIdx(srcW, y, x - 1)] : p,
        d = y < srcH - 1 ? imageData[getIdx(srcW, y + 1, x)] : p

      dstA[dstIt1] =
        areEqual(c, a) && !areEqual(c, d) && !areEqual(a, b) ? a : p
      dstIt1++
      dstA[dstIt1] =
        areEqual(a, b) && !areEqual(a, c) && !areEqual(b, d) ? b : p
      dstIt1++

      dstA[dstIt2] =
        areEqual(d, c) && !areEqual(d, b) && !areEqual(c, a) ? c : p
      dstIt2++
      dstA[dstIt2] =
        areEqual(b, d) && !areEqual(b, a) && !areEqual(d, c) ? d : p
      dstIt2++
    }
    dstIt1 += srcW * 2
  }

  return upscaleImageEPX(dstA, srcW * 2, srcH * 2, scale / 2)
}

const rotate = (
  imageData: string[],
  srcW: number,
  srcH: number,
  deg: number,
) => {
  const [rotW, rotH] = imageSizeAfterRotation([srcW, srcH], deg)

  const cos = Math.cos((deg * Math.PI) / 180),
    sin = Math.sin((deg * Math.PI) / 180)

  let rotated: string[] = new Array(Math.round(rotW) * Math.round(rotH))
  let painted = []

  for (let t = 0; t < rotH; t++) {
    let row = []
    for (let s = 0; s < rotW; s++) {
      const x = Math.round(
        (s - rotW / 2) * cos + (t - rotH / 2) * sin + srcW / 2,
      )
      const y = Math.round(
        -(s - rotW / 2) * sin + (t - rotH / 2) * cos + srcH / 2,
      )
      if (x >= 0 && y >= 0 && x < srcW && y < srcH) {
        rotated[getIdx(rotW, t, s)] = imageData[getIdx(srcW, y, x)]
        const paintedPix = {x: s, color: imageData[getIdx(srcW, y, x)]}
        row.push(paintedPix)
      } else {
        rotated[getIdx(rotW, t, s)] = stringifyRGBA([0, 255, 255, 0])
      }
    }
    if (row.length) painted.push(row)
  }

  return {rotated, painted, rotW, rotH}
}

const downscaleNNTopLeft = (
  imageData: string[],
  width: number,
  height: number,
  sourceScale: number,
  step = 2,
): {downscaled: string[]; width: number; height: number} => {
  if (sourceScale === 1) return {downscaled: imageData, width, height}
  const smallH = Math.ceil(height / step)
  const smallW = Math.ceil(width / step)
  let downscaled: string[] = new Array(smallH * smallW)

  for (let i = 0; i < smallH; i++) {
    for (let j = 0; j < smallW; j++) {
      downscaled[getIdx(smallW, i, j)] =
        imageData[getIdx(width, i * step, j * step)]
    }
  }

  return downscaleNNTopLeft(
    downscaled,
    smallW,
    smallH,
    sourceScale / step,
    step,
  )
}

const stringifyRGBA = (a: Uint8ClampedArray | number[]) =>
  `${a[0]}.${a[1]}.${a[2]}.${a[3]}`

const getIdx = (w: number, y: number, x: number) => w * y + x

const areEqual = (c1: string, c2: string) => c1 === c2

const flattenImage = (arr: string[]) =>
  arr.map(e => e.split('.').map(e => Number(e))).flat()

const imageSizeAfterRotation = (size: [number, number], degrees: number) => {
  degrees = degrees % 180
  if (degrees < 0) {
    degrees = 180 + degrees
  }
  if (degrees >= 90) {
    size = [size[1], size[0]]
    degrees = degrees - 90
  }
  if (degrees === 0) {
    return size
  }
  const radians = (degrees * Math.PI) / 180
  const width = size[0] * Math.cos(radians) + size[1] * Math.sin(radians)
  const height = size[0] * Math.sin(radians) + size[1] * Math.cos(radians)
  return [width, height]
}

export default jsAlgorithm

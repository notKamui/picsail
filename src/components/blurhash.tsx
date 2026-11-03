import { decode } from 'blurhash'
import { useEffect, useRef } from 'react'

type BlurhashProps = {
  hash: string
  width: number | string
  height: number | string
  resolutionX?: number
  resolutionY?: number
  punch?: number
  alt?: string
  className?: string
  style?: React.CSSProperties
}

function Blurhash({
  hash,
  width,
  height,
  resolutionX = 32,
  resolutionY = 32,
  punch = 1,
  alt = 'Blurhash preview',
  className,
  style,
}: BlurhashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      throw new Error('Could not render the blurhash preview')
    }

    const pixels = decode(hash, resolutionX, resolutionY, punch)
    context.putImageData(
      new ImageData(new Uint8ClampedArray(pixels), resolutionX, resolutionY),
      0,
      0,
    )
  }, [hash, punch, resolutionX, resolutionY])

  return (
    <figure aria-label={alt} className={className} style={{ width, height, margin: 0, ...style }}>
      <canvas
        ref={canvasRef}
        width={resolutionX}
        height={resolutionY}
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </figure>
  )
}

export { Blurhash }

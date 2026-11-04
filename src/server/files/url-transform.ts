export type ImageTransform =
  | { type: 'resize'; width?: number; height?: number }
  | { type: 'force-size' }
  | { type: 'rotate'; direction: 'upside' | 'left' | 'right' }
  | { type: 'filter'; name: string; values?: number[] }
  | { type: 'format'; format: 'webp' | 'avif' }
  | { type: 'video'; format: 'mp4' }
  | { type: 'video-mode'; mode: 'raw' | 'preview' | 'download' }

const MAX_IMAGE_DIMENSION = 4096
const MAX_FILTER_VALUE = 1000
const filters = new Set([
  'sepia',
  'sepia2',
  'sharpen',
  'emboss',
  'cool',
  'light',
  'aqua',
  'fuzzy',
  'boost',
  'boost2',
  'gray',
  'antique',
  'blackwhite',
  'vintage',
  'concentrate',
  'hermajesty',
  'everglow',
  'freshblue',
  'tender',
  'dream',
  'frozen',
  'forest',
  'rain',
  'orangepeel',
  'darken',
  'summer',
  'retro',
  'country',
  'washed',
  'pixelate',
  'brightness',
  'contrast',
  'colorize',
  'blur',
])

export type ParsedImageUrl = {
  id: string
  extension: string
  transforms: ImageTransform[]
}

export type ParseResult<T> = { success: true; value: T } | { success: false }
export type ParsedImageUrlResult =
  | { success: true; value: ParsedImageUrl }
  | { success: false; reason: 'not-found' | 'bad-request' }

type TransformParser = (token: string) => ImageTransform | null | undefined

const transformParsers: TransformParser[] = [
  parseDimensions,
  parseGeometryModifier,
  parseFormatModifier,
  parseVideoModifier,
  parseFilter,
]

export function parsePublicImageUrl(pathname: string): ParsedImageUrlResult {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2 || segments[0] !== 'f') {
    return { success: false, reason: 'not-found' }
  }

  const fileSegment = segments.at(-1)
  const fileMatch = fileSegment && /^([a-f0-9]{12})\.([a-z0-9]+)$/i.exec(fileSegment)
  if (!fileMatch) return { success: false, reason: 'not-found' }

  const parsedTransforms = parseImageTransforms(segments.slice(1, -1))
  if (!parsedTransforms.success) return { success: false, reason: 'bad-request' }

  return {
    success: true,
    value: {
      id: fileMatch[1].toLowerCase(),
      extension: fileMatch[2].toLowerCase(),
      transforms: parsedTransforms.value,
    },
  }
}

export function parseImageTransforms(tokens: string[]): ParseResult<ImageTransform[]> {
  const transforms: ImageTransform[] = []

  for (const token of tokens) {
    const transform = parseImageTransform(token.toLowerCase())
    if (!transform) return { success: false }
    transforms.push(transform)
  }

  if (transforms.some(({ type }) => type === 'video' || type === 'video-mode')) {
    const hasVideo = transforms.some(({ type }) => type === 'video')
    if (!hasVideo) return { success: false }
  }

  return { success: true, value: transforms }
}

function parseImageTransform(token: string): ImageTransform | null {
  for (const parser of transformParsers) {
    const transform = parser(token)
    if (transform !== undefined) return transform
  }

  return null
}

function parseDimensions(token: string): ImageTransform | null | undefined {
  if (/^\d+$/.test(token)) return parseResizeDimensions(Number(token), undefined)

  const match = /^(\d*)x(\d*)$/.exec(token)
  if (!match) return undefined
  if (!match[1] && !match[2]) return null

  return parseResizeDimensions(
    match[1] ? Number(match[1]) : undefined,
    match[2] ? Number(match[2]) : undefined,
  )
}

function parseResizeDimensions(
  width: number | undefined,
  height: number | undefined,
): ImageTransform | null {
  if (
    (width !== undefined &&
      (!Number.isSafeInteger(width) || width < 1 || width > MAX_IMAGE_DIMENSION)) ||
    (height !== undefined &&
      (!Number.isSafeInteger(height) || height < 1 || height > MAX_IMAGE_DIMENSION))
  ) {
    return null
  }

  return { type: 'resize', width, height }
}

function parseGeometryModifier(token: string): ImageTransform | undefined {
  if (token === 'forcesize') return { type: 'force-size' }
  if (token === 'upside' || token === 'left' || token === 'right') {
    return { type: 'rotate', direction: token }
  }
}

function parseFormatModifier(token: string): ImageTransform | undefined {
  if (token === 'webp' || token === 'avif') return { type: 'format', format: token }
}

function parseVideoModifier(token: string): ImageTransform | undefined {
  if (token === 'mp4') return { type: 'video', format: 'mp4' }
  if (token === 'raw' || token === 'preview' || token === 'download') {
    return { type: 'video-mode', mode: token }
  }
}

function parseFilter(token: string): ImageTransform | null {
  const separator = token.indexOf('_')
  const name = separator === -1 ? token : token.slice(0, separator)
  if (!filters.has(name)) return null

  const rawValues = separator === -1 ? [] : token.slice(separator + 1).split('_')
  if (rawValues.some((value) => !/^[+-]?\d+(?:\.\d+)?$/.test(value))) return null

  const values = rawValues.map(Number)
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_FILTER_VALUE)) {
    return null
  }
  if (
    name === 'colorize' &&
    (values.length > 3 || values.some((value) => value < 0 || value > 255))
  ) {
    return null
  }
  if (name !== 'colorize' && values.length > 1) return null

  return {
    type: 'filter',
    name,
    ...(values.length > 0 ? { values } : {}),
  }
}

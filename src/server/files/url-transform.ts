export type ImageTransform =
  | { type: 'resize'; width?: number; height?: number }
  | { type: 'fit' }
  | { type: 'rotate'; direction: 'upside' | 'left' | 'right' }
  | { type: 'filter'; name: string; values?: number[] }
  | { type: 'video'; format: 'mp4' }
  | { type: 'video-mode'; mode: 'raw' | 'preview' | 'download' }

export type ExecutableImageTransform =
  | { type: 'resize'; width?: number; height?: number; fit: 'inside' | 'cover' }
  | Extract<ImageTransform, { type: 'rotate' }>

const MAX_IMAGE_DIMENSION = 4096
const MAX_FILTER_VALUE = 1000
const MAX_TRANSFORMS = 16
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
  parseVideoModifier,
  parseFilter,
]

/**
 * Parses a public /f/ URL before the route dispatches original or transformed content.
 * @param pathname - URL pathname, including the /f/ prefix and final filename.
 * @returns Normalized ID, extension and ordered transforms, or a failure reason for
 * an invalid filename/path or invalid transform.
 */
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

/**
 * Parses the ordered modifier segments of a public image URL without executing them.
 * Recognized modifiers may still be unsupported by the route's transform resolver.
 * @param tokens - Path segments before the filename.
 * @returns Typed transforms in input order or a failure if any token is invalid.
 */
export function parseImageTransforms(tokens: string[]): ParseResult<ImageTransform[]> {
  if (tokens.length > MAX_TRANSFORMS) return { success: false }
  const transforms: ImageTransform[] = []

  for (const token of tokens) {
    const transform = parseImageTransform(token.toLowerCase())
    if (!transform) return { success: false }
    if (transform.type === 'fit' && transforms.at(-1)?.type !== 'resize') {
      return { success: false }
    }
    transforms.push(transform)
  }

  if (transforms.some(({ type }) => type === 'video' || type === 'video-mode')) {
    const hasVideo = transforms.some(({ type }) => type === 'video')
    if (!hasVideo) return { success: false }
  }

  return { success: true, value: transforms }
}

/**
 * Dispatches one normalized path token through the transform parsers.
 * @param token - Lowercase transform segment.
 * @returns A recognized transform, or null if no parser accepts it.
 */
function parseImageTransform(token: string): ImageTransform | null {
  for (const parser of transformParsers) {
    const transform = parser(token)
    if (transform !== undefined) return transform
  }

  return null
}

/**
 * Recognizes size segments such as 800, 800x600 and x600.
 * @param token - Lowercase transform segment.
 * @returns A resize transform, null for invalid dimensions, or undefined if not a size.
 */
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

/**
 * Validates requested dimensions against the supported per-axis limit.
 * @param width - Requested width, or undefined if omitted.
 * @param height - Requested height, or undefined if omitted.
 * @returns A resize transform or null for a nonpositive, unsafe or oversized value.
 */
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

/**
 * Recognizes fit and rotation modifiers.
 * @param token - Lowercase transform segment.
 * @returns The corresponding typed modifier, or undefined when it does not match.
 */
function parseGeometryModifier(token: string): ImageTransform | undefined {
  if (token === 'fit') return { type: 'fit' }
  if (token === 'upside' || token === 'left' || token === 'right') {
    return { type: 'rotate', direction: token }
  }
}

/**
 * Recognizes future GIF-to-video conversion and serving-mode modifiers.
 * @param token - Lowercase transform segment.
 * @returns A video modifier or undefined if the segment is unrelated.
 */
function parseVideoModifier(token: string): ImageTransform | undefined {
  if (token === 'mp4') return { type: 'video', format: 'mp4' }
  if (token === 'raw' || token === 'preview' || token === 'download') {
    return { type: 'video-mode', mode: token }
  }
}

/**
 * Parses recognized PictShare filter names and optional numeric arguments.
 * @param token - Lowercase filter segment, with underscore-separated arguments.
 * @returns A typed filter or null if the name, argument count or values are invalid.
 */
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

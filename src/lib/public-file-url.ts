/**
 * Builds the public original-file path used by upload and listing responses.
 * @param id - Public file ID.
 * @param extension - Stored filename extension without a dot.
 * @returns A root-relative /f/ path; arguments are not validated or encoded.
 */
export function publicFilePath(id: string, extension: string) {
  return `/f/${id}.${extension}`
}

/**
 * Selects a lightweight image for the personal library grid. Animated GIF
 * resizing is not supported, so those thumbnails use the original.
 * @param id - Public file ID from the listing.
 * @param extension - Stored filename extension without a dot.
 * @returns A root-relative thumbnail or original file path.
 */
export function thumbnailFilePath(id: string, extension: string) {
  return extension.toLowerCase() === 'gif'
    ? publicFilePath(id, extension)
    : `/f/320/${id}.${extension}`
}

/**
 * Resolves a public original-file path against the configured application base URL.
 * @param id - Public file ID.
 * @param extension - Stored filename extension without a dot.
 * @param baseUrl - Absolute base URL used for resolution.
 * @returns The absolute public file URL.
 */
export function publicFileUrl(id: string, extension: string, baseUrl: string) {
  return new URL(publicFilePath(id, extension), baseUrl).toString()
}

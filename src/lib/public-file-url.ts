export function publicFilePath(id: string, extension: string) {
  return `/f/${id}.${extension}`
}

export function publicFileUrl(id: string, extension: string, baseUrl: string) {
  return new URL(publicFilePath(id, extension), baseUrl).toString()
}

import { tryAsync } from './try'

export async function copyLink(url: string) {
  if (!navigator.clipboard) {
    return 'Clipboard unavailable. Select the link above to copy it.'
  }

  const [error] = await tryAsync(navigator.clipboard.writeText(url))
  return error ? 'Could not copy the link. Select it above to copy it.' : 'Link copied.'
}

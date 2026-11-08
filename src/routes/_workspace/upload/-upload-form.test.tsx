import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'
import { UploadForm } from './-upload-form'

describe('UploadForm', () => {
  const callbacks = {
    onChooseFile: vi.fn(),
    onError: vi.fn(),
    onUpload: vi.fn(),
  }

  it('disables upload until a file is selected', () => {
    const html = renderToStaticMarkup(
      <UploadForm {...callbacks} file={null} error={null} isPending={false} />,
    )
    expect(html).toContain('Drop an image here')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]* disabled=""/)
  })

  it('shows selection, pending and error states', () => {
    const file = new File(['image'], 'example.png', { type: 'image/png' })
    const html = renderToStaticMarkup(
      <UploadForm {...callbacks} file={file} error="Upload failed" isPending />,
    )
    expect(html).toContain('example.png')
    expect(html).toContain('Uploading…')
    expect(html).toContain('Upload failed')
    expect(html).toMatch(/<p role="alert"[^>]*>Upload failed<\/p>/)
    expect(html).toMatch(/<input[^>]* disabled=""/)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]* disabled=""/)
  })
})

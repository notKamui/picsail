import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'
import { FilePagination } from './file-pagination'

describe('FilePagination', () => {
  const onPageChange = vi.fn()

  it('hides pagination for a single page', () => {
    expect(
      renderToStaticMarkup(<FilePagination page={1} totalPages={1} onPageChange={onPageChange} />),
    ).toBe('')
  })

  it.each([
    [1, true, false],
    [2, false, false],
    [3, false, true],
  ])('disables the correct buttons on page %i', (page, previousDisabled, nextDisabled) => {
    const html = renderToStaticMarkup(
      <FilePagination page={page} totalPages={3} onPageChange={onPageChange} />,
    )
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(([button]) => button)
    expect(buttons[0]).toMatch(previousDisabled ? / disabled=""/ : /^(?!.* disabled="")/)
    expect(buttons[1]).toMatch(nextDisabled ? / disabled=""/ : /^(?!.* disabled="")/)
    expect(html).toContain(`Page ${page} of 3`)
    expect(html).toContain('aria-live="polite"')
  })
})

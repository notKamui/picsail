import { describe, expect, it } from 'vite-plus/test'
import { tryAsync } from './try'

function rejectValue(reason: unknown): Promise<never> {
  // Exercise the non-Error rejections that JavaScript permits.
  // oxlint-disable-next-line typescript/prefer-promise-reject-errors
  return Promise.reject(reason)
}

describe('tryAsync', () => {
  it('returns the resolved value', async () => {
    expect(await tryAsync(Promise.resolve('value'))).toEqual([null, 'value'])
  })

  it('preserves Error rejections', async () => {
    const error = new Error('failed')
    expect(await tryAsync(Promise.reject(error))).toEqual([error, null])
  })

  it.each([null, undefined, false, 0, 'failure'])(
    'returns the original non-Error rejection (%s)',
    async (reason) => {
      expect(await tryAsync(rejectValue(reason))).toEqual([reason, null])
    },
  )

  it('rethrows values outside the allowed error classes', async () => {
    await expect(tryAsync(rejectValue(null), [Error])).rejects.toBeNull()
    const error = new TypeError('failed')
    expect(await tryAsync(Promise.reject(error), [Error])).toEqual([error, null])
  })
})

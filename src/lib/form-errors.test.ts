import { describe, expect, it } from 'vite-plus/test'
import { toFieldErrors } from './form-errors'

describe('toFieldErrors', () => {
  it('keeps displayable messages from form validation errors', () => {
    expect(toFieldErrors(['Required', { message: 'Invalid email' }])).toEqual([
      { message: 'Required' },
      { message: 'Invalid email' },
    ])
  })

  it('ignores values without a string message', () => {
    expect(toFieldErrors([null, undefined, 1, {}, { message: 42 }])).toEqual([])
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'
import { AuthField } from './auth-field'

describe('AuthField', () => {
  const field = {
    name: 'email',
    state: {
      value: '',
      meta: { isTouched: false, isValid: false, errors: ['Enter a valid email'] },
    },
    handleBlur: vi.fn(),
    handleChange: vi.fn(),
  }

  it('hides validation errors before the field is touched', () => {
    const html = renderToStaticMarkup(
      <AuthField field={field} label="Email" type="email" autoComplete="email" />,
    )
    expect(html).toContain('aria-invalid="false"')
    expect(html).not.toContain('Enter a valid email')
    expect(html).not.toContain('aria-describedby')
  })

  it('associates a touched validation error with its input', () => {
    const html = renderToStaticMarkup(
      <AuthField
        field={{
          ...field,
          state: { ...field.state, meta: { ...field.state.meta, isTouched: true } },
        }}
        label="Email"
        type="email"
        autoComplete="email"
      />,
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="email-error"')
    expect(html).toContain('id="email-error"')
    expect(html).toContain('Enter a valid email')
  })
})

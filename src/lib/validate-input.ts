import * as z from 'zod'

export function validateInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  fallbackMessage: string,
): { success: true; data: z.output<TSchema> } | { success: false; response: Response } {
  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      response: Response.json(
        { error: parsed.error.issues[0]?.message ?? fallbackMessage },
        { status: 400 },
      ),
    }
  }

  return { success: true, data: parsed.data }
}

/**
 * Converts a synchronous operation into an error/result tuple.
 * @param func - Operation to execute immediately, including any side effects.
 * @param catchableErrors - Allowed error constructors; an empty list catches all thrown values.
 * @returns [null, value] on success or [error, null] on a caught failure.
 * @throws Any thrown value not matching a non-empty catchableErrors list.
 */
export function tryInline<T, E extends Error = Error>(
  func: () => T,
  catchableErrors: (new (...args: any[]) => E)[] = [],
): [error: E, success: null] | [error: null, success: T] {
  try {
    const result = func()
    return [null, result]
  } catch (error) {
    if (
      catchableErrors.length > 0 &&
      !catchableErrors.some((ErrorClass) => error instanceof ErrorClass)
    ) {
      throw error
    }
    return [error as E, null]
  }
}

/**
 * Converts a promise's outcome into an error/result tuple for async call sites.
 * @param promise - Already-started operation to await, including its side effects.
 * @param catchableErrors - Allowed error constructors; an empty list catches all rejections.
 * @returns [null, value] on success or [error, null] on a caught rejection.
 * @throws Rejections not matching a non-empty catchableErrors list.
 */
export async function tryAsync<T, E extends Error = Error>(
  promise: Promise<T>,
  catchableErrors: (new (...args: any[]) => E)[] = [],
): Promise<[error: E, success: null] | [error: null, success: T]> {
  try {
    const result = await promise
    return [null, result]
  } catch (error) {
    if (
      catchableErrors.length > 0 &&
      !catchableErrors.some((ErrorClass) => error instanceof ErrorClass)
    ) {
      throw error
    }
    return [error as E, null]
  }
}

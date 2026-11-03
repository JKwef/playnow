/**
 * Короткие проверки в стиле assertEquals поверх expect из Jest.
 * Часть тестов писалась раньше под Deno (до появления Jest в проекте), так их проще читать.
 */
type ErrorClass = abstract new (...args: never[]) => Error;

export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new Error(message ?? 'Ожидалось истинное условие');
}

export const assertEquals = (actual: unknown, expected: unknown, message?: string): void => {
  if (message === undefined) {
    expect(actual).toEqual(expected);
    return;
  }
  try {
    expect(actual).toEqual(expected);
  } catch (error) {
    throw new Error(`${message}\n${String(error)}`, { cause: error });
  }
};

const checkError = (error: unknown, errorClass?: ErrorClass, includes?: string): Error => {
  if (errorClass !== undefined) expect(error).toBeInstanceOf(errorClass);
  if (includes !== undefined) expect(String((error as Error).message)).toContain(includes);
  return error as Error;
};

export const assertRejects = async (
  fn: () => Promise<unknown>,
  errorClass?: ErrorClass,
  includes?: string,
): Promise<Error> => {
  try {
    await fn();
  } catch (error) {
    return checkError(error, errorClass, includes);
  }
  throw new Error('Ожидалась ошибка, но промис выполнился успешно');
};

export const assertThrows = (
  fn: () => unknown,
  errorClass?: ErrorClass,
  includes?: string,
): Error => {
  try {
    fn();
  } catch (error) {
    return checkError(error, errorClass, includes);
  }
  throw new Error('Ожидалась ошибка, но функция выполнилась успешно');
};

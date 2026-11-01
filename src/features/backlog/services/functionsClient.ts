import { isRecord } from '@/shared/utils/validation';

import { BacklogError, type BacklogErrorCode } from '../types/Game';

export interface FunctionsClientDeps {
  /** https://<ref>.supabase.co/functions/v1 */
  functionsBaseUrl: string;
  /** Публичный ключ проекта: gateway Supabase требует его в заголовке apikey. */
  apiKey: string;
  /** Актуальный access token пользователя или null, если сессии нет. */
  getAccessToken: () => Promise<string | null>;
  fetch: typeof fetch;
}

const ERROR_BY_STATUS: Record<number, BacklogErrorCode> = {
  401: 'unauthorized',
  403: 'private_profile',
  502: 'steam_unavailable',
};

const readErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.error === 'string' ? body.error : null;
  } catch {
    // Тело не JSON (например, HTML от прокси) — опираемся только на статус.
    return null;
  }
};

/**
 * POST в Edge Function с JWT пользователя. Возвращает разобранный JSON-объект или
 * бросает BacklogError с кодом, понятным экранам. Общая часть steamApi и rawgApi.
 */
export const callFunction = async (
  deps: FunctionsClientDeps,
  name: string,
): Promise<Record<string, unknown>> => {
  const token = await deps.getAccessToken();
  if (token === null) {
    throw new BacklogError('unauthorized', 'Нет сессии');
  }

  let response: Response;
  try {
    response = await deps.fetch(`${deps.functionsBaseUrl}/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: deps.apiKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (error) {
    // TypeError — нет сети, AbortError — наш таймаут 10 с. Для пользователя одно и то же.
    throw new BacklogError('network', 'Сеть недоступна', { cause: error });
  }

  if (!response.ok) {
    const serverCode = await readErrorCode(response);
    const code: BacklogErrorCode =
      serverCode === 'private_profile'
        ? 'private_profile'
        : (ERROR_BY_STATUS[response.status] ?? 'server');
    throw new BacklogError(code, `${name} ответил ${response.status} ${serverCode ?? ''}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new BacklogError('server', `${name}: ответ не JSON`, { cause: error });
  }
  if (!isRecord(body)) {
    throw new BacklogError('server', `${name}: неожиданный формат ответа`);
  }
  return body;
};

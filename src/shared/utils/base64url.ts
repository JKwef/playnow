const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * base64url без паддинга (RFC 4648 §5) для байтов.
 * Своя реализация, чтобы не зависеть от наличия btoa/Buffer в конкретном JS-движке.
 */
export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    const remaining = bytes.length - i;
    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    if (remaining > 1) out += ALPHABET[(triple >> 6) & 63];
    if (remaining > 2) out += ALPHABET[triple & 63];
  }
  return out;
};

/** Обычный base64 → base64url без паддинга. */
export const base64ToBase64Url = (base64: string): string =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

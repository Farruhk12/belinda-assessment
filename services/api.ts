const TOKEN_KEY = 'belinda_token';

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* localStorage недоступен */ }
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UNAUTHORIZED_EVENT = 'belinda:unauthorized';
export const onUnauthorized = (cb: () => void) => {
  window.addEventListener(UNAUTHORIZED_EVENT, cb);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, cb);
};

const request = async <T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> => {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // токен недействителен: сбрасываем сессию (кроме самого входа, где 401 означает неверный пароль)
    if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(res.status, data?.message || 'Ошибка сервера');
  }
  return data as T;
};

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body: unknown) => request<T>('POST', url, body)
};

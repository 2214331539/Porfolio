const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';
const TOKEN_KEY = 'inkfold_token';

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.detail ?? '请求失败', response.status);
  }
  return response.json() as Promise<T>;
}

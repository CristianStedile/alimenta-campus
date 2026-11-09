const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/u, '');

let accessToken = null;
let refreshInProgress = null;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

async function readResponse(response) {
  if (response.status === 204) return null;
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new ApiError(response.status, payload.erro || 'Não foi possível concluir a solicitação.');
  }
  return payload;
}

export async function login(email, senha) {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const payload = await readResponse(response);
  setAccessToken(payload.accessToken);
  return payload.accessToken;
}

export async function refreshAccessToken() {
  if (!refreshInProgress) {
    refreshInProgress = (async () => {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        clearAccessToken();
        if (response.status === 401) return null;
        throw new ApiError(response.status, 'Não foi possível restaurar a sessão.');
      }
      const payload = await readResponse(response);
      setAccessToken(payload.accessToken);
      return payload.accessToken;
    })().finally(() => {
      refreshInProgress = null;
    });
  }
  return refreshInProgress;
}

export async function apiRequest(route, options = {}) {
  const url = `${API_URL}${route}`;
  const send = () => {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body !== undefined && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    });
  };

  let response = await send();
  if (response.status === 401 && route !== '/login' && route !== '/auth/refresh') {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) throw new ApiError(401, 'sessão inválida ou expirada');
    response = await send();
  }
  return readResponse(response);
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    clearAccessToken();
  }
}

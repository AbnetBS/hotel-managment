const TOKEN_KEY = 'clove.token';
const USER_KEY = 'clove.user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && getToken()) headers['x-clove-token'] = getToken();
  const response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const error = new ApiError(data?.error || `Request failed (${response.status})`, response.status);
    error.payload = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  public: {
    get: (path) => request(path, { auth: false }),
    post: (path, body) => request(path, { method: 'POST', body, auth: false }),
  },
};

/**
 * Build a browser-loadable URL for a protected media route (e.g. a guest ID
 * scan). An <img> or <a> cannot send the auth header, so we append the session
 * token as a query param — the server accepts it there, exactly like the WS.
 */
export function mediaUrl(pathOrUrl) {
  if (!pathOrUrl) return pathOrUrl;
  if (!pathOrUrl.startsWith('/api/')) return pathOrUrl; // public asset (e.g. /uploads/*)
  const token = getToken();
  if (!token) return pathOrUrl;
  return `${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

/** Turn a picked file into a data URL for the upload endpoint. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadPhoto(file) {
  const dataUrl = await fileToDataUrl(file);
  return api.post('/admin/uploads', { data_url: dataUrl, filename: file.name });
}

/**
 * One reference per submit attempt, reused when the same form is retried.
 * The server ignores a second request that carries a reference it has already
 * seen, so a dropped connection or a double tap can never charge twice.
 */
export function clientRef(scope) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${scope}-${Date.now().toString(36)}-${random}`;
}

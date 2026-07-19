export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function getUser(): { id: string; email: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setSession(user: unknown) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('user');
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.user) setSession(data.user);
    return true;
  } catch {
    return false;
  }
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  };

  let res = await doFetch();
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch();
  }
  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return res;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // เคลียร์ session ฝั่ง client ต่อแม้ API ล้มเหลว
  }
  clearSession();
}

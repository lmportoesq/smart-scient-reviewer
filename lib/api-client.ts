/**
 * Typed API client for ScientificGuard backend.
 * All requests include credentials (cookies) for JWT auth.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle 401 — try refresh
  if (res.status === 401 && !path.includes('/auth/refresh')) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry original request
      const retryRes = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (retryRes.ok) {
        return retryRes.json();
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, res.statusText, body);
  }

  return res.json();
}

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: any; message: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: any }>('/auth/me'),
  },

  documents: {
    upload: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, res.statusText, body);
      }

      return res.json() as Promise<{
        documentId: string;
        paperId: string;
        status: string;
      }>;
    },
  },

  papers: {
    get: (id: string) => request<any>(`/papers/${id}`),
    analyze: (id: string) =>
      request<any>(`/papers/${id}/analyze`, { method: 'POST' }),
    report: (id: string) => request<any>(`/papers/${id}/report`),
    evidence: (id: string) => request<any[]>(`/papers/${id}/evidence`),
    audit: (id: string) => request<any[]>(`/papers/${id}/audit`),
  },

  reviews: {
    create: (paperId: string, decision: string, reason: string) =>
      request<any>(`/papers/${paperId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    list: (paperId: string) => request<any[]>(`/papers/${paperId}/review`),
  },

  admin: {
    users: () => request<any[]>('/admin/users'),
    audit: () => request<any[]>('/admin/audit'),
  },
};

export { ApiError };

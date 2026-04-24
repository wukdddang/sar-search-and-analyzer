const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export interface ApiError extends Error {
    statusCode: number;
    code?: string;
    details?: unknown;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new Error(body?.message ?? response.statusText) as ApiError;
        error.statusCode = response.status;
        error.code = body?.code;
        error.details = body?.details;
        throw error;
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

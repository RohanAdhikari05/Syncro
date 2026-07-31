'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export type ApiFetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
  router?: AppRouterInstance
  redirectOn401?: boolean
  redirectOn403?: boolean
}

export type ApiFetchResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; unauthorized?: boolean; forbidden?: boolean }

function buildHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function handleAuthRedirect(
  status: number,
  router: AppRouterInstance | undefined,
  redirectOn401: boolean,
  redirectOn403: boolean,
): boolean {
  if (status === 401 && redirectOn401 && router) {
    router.push('/unauthorized')
    return true
  }
  if (status === 403 && redirectOn403 && router) {
    router.push('/access-denied')
    return true
  }
  return false
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<ApiFetchResult<T>> {
  const {
    method = 'GET',
    body,
    token,
    router,
    redirectOn401 = true,
    redirectOn403 = true,
  } = options

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(token),
      cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const data = (await response.json().catch(() => null)) as T & { error?: string }

    if (!response.ok) {
      const unauthorized = response.status === 401
      const forbidden = response.status === 403

      if (
        handleAuthRedirect(response.status, router, redirectOn401, redirectOn403)
      ) {
        return {
          ok: false,
          error: data?.error ?? (unauthorized ? 'Unauthorized' : 'Access denied'),
          status: response.status,
          unauthorized,
          forbidden,
        }
      }

      return {
        ok: false,
        error: data?.error ?? `Request failed (${response.status})`,
        status: response.status,
        unauthorized,
        forbidden,
      }
    }

    return { ok: true, data, status: response.status }
  } catch {
    return {
      ok: false,
      error: 'Network error — please check your connection and try again.',
      status: 0,
    }
  }
}

export function getErrorMessage(
  result: { ok: false; error: string },
  fallback = 'Something went wrong. Please try again.',
): string {
  return result.error || fallback
}

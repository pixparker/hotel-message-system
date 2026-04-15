import { useAuth } from "../state/auth.js";
import { demoFetch } from "./demo-backend.js";
import { env } from "./env.js";

const DEMO = env.VITE_DEMO;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export const IS_DEMO = DEMO;

/**
 * Try to silently refresh the access token using the refresh token.
 * Returns the new access token if successful, null if refresh fails or no token available.
 */
async function tryRefreshToken(): Promise<string | null> {
  const authState = useAuth.getState();
  const refreshToken = authState.refreshToken;
  if (!refreshToken || DEMO) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const body = await res.json();
    const { accessToken, refreshToken: newRefreshToken } = body;
    authState.setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = useAuth.getState().accessToken;
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = DEMO
    ? await demoFetch(path, { ...init, headers })
    : await fetch(path, { ...init, headers });

  // Handle 401: try silent refresh before giving up
  if (res.status === 401 && !path.startsWith("/api/auth")) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      // Retry the original request with new token
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("content-type", "application/json");
      retryHeaders.set("authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(path, { ...init, headers: retryHeaders });
      const retryText = await retryRes.text();
      const retryBody = retryText ? JSON.parse(retryText) : undefined;
      if (!retryRes.ok) {
        const msg =
          (retryBody && typeof retryBody === "object" && "error" in retryBody && String(retryBody.error)) ||
          `HTTP ${retryRes.status}`;
        throw new ApiError(retryRes.status, msg, retryBody);
      }
      return retryBody as T;
    }

    // Refresh failed or no refresh token; logout
    useAuth.getState().logout();
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && String(body.error)) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

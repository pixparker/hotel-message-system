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

  if (res.status === 401) {
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

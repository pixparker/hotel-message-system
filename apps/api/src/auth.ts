import { SignJWT, jwtVerify } from "jose";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "./env.js";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AuthClaims {
  sub: string; // user id
  orgId: string;
  role: "admin" | "staff";
}

export async function signAccessToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL}s`)
    .sign(accessKey);
}

export async function signRefreshToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_REFRESH_TTL}s`)
    .sign(refreshKey);
}

export async function verifyAccessToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, accessKey);
  return payload as unknown as AuthClaims;
}

export async function verifyRefreshToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, refreshKey);
  return payload as unknown as AuthClaims;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthClaims;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    const claims = await verifyAccessToken(header.slice(7));
    c.set("auth", claims);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};

export function currentOrgId(c: Context): string {
  return c.get("auth").orgId;
}

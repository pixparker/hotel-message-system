import crypto from "crypto";
import { env } from "./env.js";

const ALGO = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";

const key = crypto
  .createHash("sha256")
  .update(env.SECRETS_ENCRYPTION_KEY)
  .digest();

/**
 * Mirror of apps/api/src/crypto.ts — duplicated here so the worker can decrypt
 * per-tenant Meta access tokens without depending on the api package. If this
 * scheme gets more complex, extract to a shared @hms/crypto package.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  const body = value.slice(ENC_PREFIX.length);
  const [ivB64, ctB64, tagB64] = body.split(".");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("invalid encrypted secret format");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

import crypto from "crypto";
import { env } from "./env.js";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
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

/**
 * Bytes variants used by the Baileys auth-state adapter to persist Signal
 * key material. Layout matches apps/api/src/crypto.ts: [IV][tag][ct].
 */
export function encryptBytes(plaintext: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptBytes(blob: Buffer): Buffer {
  if (blob.length < IV_BYTES + 16) {
    throw new Error("invalid encrypted bytes blob: too short");
  }
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + 16);
  const ct = blob.subarray(IV_BYTES + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

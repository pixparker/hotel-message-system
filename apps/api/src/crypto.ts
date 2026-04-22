import crypto from "crypto";
import { env } from "./env.js";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const ENC_PREFIX = "enc:v1:";

// Derive a 32-byte key from the base64 env secret. We SHA-256 to ensure the
// key is always 32 bytes regardless of env encoding; this is a KDF for a
// non-user-supplied secret, not a password — no need for argon2/scrypt.
const key = crypto
  .createHash("sha256")
  .update(env.SECRETS_ENCRYPTION_KEY)
  .digest();

/**
 * Encrypt a secret string (Meta access token, etc.) for at-rest storage.
 * Returns a self-contained blob prefixed with "enc:v1:" so `isEncrypted` and
 * future versioning are easy. Format: enc:v1:<iv_b64>.<ct_b64>.<tag_b64>
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}.${ct.toString("base64")}.${tag.toString("base64")}`;
}

/**
 * Decrypt a secret previously encrypted with {@link encryptSecret}. If the
 * value doesn't carry our prefix we return it verbatim — allows a graceful
 * migration for operators who already have plain-text secrets in waConfig.
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

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/**
 * Bytes variants of the above — same AES-256-GCM scheme, raw binary I/O.
 * Output layout: [12-byte IV][16-byte auth tag][ciphertext]. This single-blob
 * format is easier to store in a bytea column than the prefixed string form.
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

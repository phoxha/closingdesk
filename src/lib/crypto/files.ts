import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const MAGIC = Buffer.from("CD01");

export function dataDir(): string {
  return process.env.CLOSINGDESK_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

export function fileKey(): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(keyMaterial(), "closingdesk-files-v1", 32);
  }
  return cachedKey;
}

let cachedKey: Buffer | null = null;

function keyMaterial(): string {
  const configured = process.env.CLOSINGDESK_FILE_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CLOSINGDESK_FILE_KEY is required in production.");
  }
  return readSecretFile(".file-key");
}

export function sessionSecret(): string {
  const configured = process.env.CLOSINGDESK_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CLOSINGDESK_SESSION_SECRET is required in production.");
  }
  return readSecretFile(".session-secret");
}

function readSecretFile(name: string): string {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("hex"));
  return readFileSync(file, "utf8").trim();
}

export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", fileKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptBytes(payload: Buffer): Buffer {
  if (payload.subarray(0, 4).toString() !== "CD01") {
    throw new Error("Stored file is not encrypted in the expected format.");
  }
  const iv = payload.subarray(4, 16);
  const tag = payload.subarray(16, 32);
  const data = payload.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", fileKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function retentionDays(): number | null {
  const value = Number(process.env.CLOSINGDESK_RETENTION_DAYS);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

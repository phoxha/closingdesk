import { createHmac, timingSafeEqual } from "crypto";
import { sessionSecret } from "@/lib/crypto/files";

export const SESSION_COOKIE = "cd_session";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export function createSession(userId: string): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TWELVE_HOURS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined): { uid: string } | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid?: unknown; exp?: unknown };
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

function sign(body: string): string {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

export function cookieSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { cookieSecure, createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/store";

function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

// Relative redirect so the browser stays on the public domain
// (request.url is the internal standalone address behind Plesk).
function redirectTo(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  const user = email ? await findUserByEmail(email) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const params = new URLSearchParams({ error: "1" });
    if (next !== "/") params.set("next", next);
    return redirectTo(`/login?${params.toString()}`);
  }
  const response = redirectTo(next);
  response.cookies.set(SESSION_COOKIE, createSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(request),
    maxAge: 60 * 60 * 12,
  });
  return response;
}

import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { cookieSecure, createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/store";

function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  const user = email ? await findUserByEmail(email) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "1");
    if (next !== "/") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE, createSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(request),
    maxAge: 60 * 60 * 12,
  });
  return response;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { publicUser } from "@/lib/store";
import type { PublicUser } from "@/lib/types";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const session = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return publicUser(session.uid);
}

export async function requireApiUser(): Promise<PublicUser | NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return user;
}

export function isUser(value: PublicUser | NextResponse): value is PublicUser {
  return !(value instanceof NextResponse);
}

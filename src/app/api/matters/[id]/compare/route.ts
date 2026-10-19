import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { runComparison } from "@/lib/comparison/run";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const result = await runComparison(user.id, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

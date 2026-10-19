import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { addReview } from "@/lib/store";
import type { ReviewAction } from "@/lib/types";

const ACTIONS = new Set<ReviewAction>(["confirm", "acceptable", "revision", "note", "resolved"]);

export async function POST(request: Request, context: { params: Promise<{ id: string; findingId: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id, findingId } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: string; note?: string } | null;
  if (!body?.action || !ACTIONS.has(body.action as ReviewAction)) {
    return NextResponse.json({ error: "Choose a review action." }, { status: 400 });
  }
  const review = await addReview({
    userId: user.id,
    matterId: id,
    findingId,
    action: body.action as ReviewAction,
    note: (body.note ?? "").slice(0, 4000),
  });
  if (!review) return NextResponse.json({ error: "Finding not found." }, { status: 404 });
  return NextResponse.json({ review });
}

import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { createMatter } from "@/lib/store";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    propertyAddress?: string;
    clientName?: string;
    matterName?: string;
    closingDate?: string;
  } | null;
  const propertyAddress = body?.propertyAddress?.trim() ?? "";
  if (propertyAddress.length < 4 || propertyAddress.length > 300) {
    return NextResponse.json({ error: "Enter the property address." }, { status: 400 });
  }
  const closingDate = body?.closingDate?.trim() || null;
  if (closingDate && !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
    return NextResponse.json({ error: "Closing date must be a calendar date." }, { status: 400 });
  }
  const matter = await createMatter({
    userId: user.id,
    propertyAddress,
    clientName: (body?.clientName ?? "").slice(0, 200),
    matterName: (body?.matterName ?? "").slice(0, 200),
    closingDate,
  });
  return NextResponse.json({ id: matter.id });
}

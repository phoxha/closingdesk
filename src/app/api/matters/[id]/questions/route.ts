import { NextResponse } from "next/server";
import { isUser, requireApiUser } from "@/lib/auth/current";
import { answerAboutDocuments } from "@/lib/questions/answer";
import { addQuestion, getBundle } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { question?: string; runId?: string } | null;
  const question = body?.question?.trim().slice(0, 1000) ?? "";
  const runId = body?.runId?.trim() ?? "";
  if (question.length < 3 || !runId) {
    return NextResponse.json({ error: "Enter a question about these documents." }, { status: 400 });
  }

  const bundle = await getBundle(user.id, id);
  const run = bundle?.runs.find((item) => item.id === runId);
  if (!bundle || !run) return NextResponse.json({ error: "Comparison not found." }, { status: 404 });

  const findings = bundle.findings.filter((finding) => finding.runId === run.id);
  const offer = bundle.documents.find((doc) => doc.id === run.offerDocumentIds[0]) ?? bundle.documents.find((doc) => doc.role === "offer");
  const psa = bundle.documents.find((doc) => doc.id === run.psaDocumentId) ?? bundle.documents.find((doc) => doc.role === "psa");
  const answered = await answerAboutDocuments({
    question,
    findings,
    offerText: offer?.pages.map((page) => page.text).join("\n") ?? "",
    psaText: psa?.pages.map((page) => page.text).join("\n") ?? "",
  });
  const saved = await addQuestion({
    userId: user.id,
    matterId: id,
    runId,
    question,
    answer: answered.answer,
    offerQuote: answered.offerQuote,
    psaQuote: answered.psaQuote,
  });
  if (!saved) return NextResponse.json({ error: "The question could not be saved." }, { status: 404 });
  return NextResponse.json({ question: saved });
}

import { describe, expect, it } from "vitest";
import { compareDocuments, sourceFromText } from "@/lib/comparison/compare";
import { SAMPLE_OFFER, SAMPLE_PSA } from "@/lib/documents/sample-contracts";
import { answerFromReview, keepSupportedQuotes } from "@/lib/questions/answer";

function findings() {
  return compareDocuments({
    reference: [sourceFromText("offer", "offer.pdf", "offer", SAMPLE_OFFER)],
    psa: sourceFromText("psa", "psa.pdf", "psa", SAMPLE_PSA),
  }).findings;
}

describe("document questions", () => {
  it("answers a closing-date question from the review", () => {
    const answer = answerFromReview("Why do the closing dates differ?", findings());
    expect(answer.answer).toMatch(/Closing date is a discrepancy/i);
    expect(answer.answer).toMatch(/November 15, 2026/);
    expect(answer.answer).toMatch(/December 1, 2026/);
    expect(answer.offerQuote).toMatch(/November 15, 2026/);
  });

  it("says when the review has no supporting term", () => {
    const answer = answerFromReview("What color is the front door?", findings());
    expect(answer.answer).toMatch(/do not show a direct answer/i);
    expect(answer.offerQuote).toBe("");
  });

  it("drops a quote that is not in the document", () => {
    const kept = keepSupportedQuotes(
      {
        answer: "The price is stated in both documents.",
        offerQuote: "This sentence was not in the offer.",
        psaQuote: "($350,000)",
      },
      SAMPLE_OFFER,
      SAMPLE_PSA,
    );
    expect(kept.offerQuote).toBe("");
    expect(kept.psaQuote.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { extractDocument, textToPdf } from "@/lib/documents/extract-text";
import { SAMPLE_OFFER } from "@/lib/documents/sample-contracts";
import { compareDocuments, sourceFromText } from "@/lib/comparison/compare";

describe("pdf extraction", () => {
  it("reads the sample offer back out of a PDF", async () => {
    const bytes = await textToPdf(SAMPLE_OFFER);
    const extracted = await extractDocument(bytes, "offer.pdf", "application/pdf");
    expect(extracted.status).toBe("ok");
    const text = extracted.pages.map((page) => page.text).join("\n");
    expect(text).toMatch(/Purchase Price/i);
    expect(text).toMatch(/350,000|350000/);
    expect(text).toMatch(/November 15, 2026/);
    const result = compareDocuments({
      reference: [
        sourceFromText("offer", "offer.pdf", "offer", text, extracted.status),
      ],
      psa: sourceFromText(
        "psa",
        "psa.pdf",
        "psa",
        (await extractDocument(await textToPdf((await import("@/lib/documents/sample-contracts")).SAMPLE_PSA), "psa.pdf", "application/pdf")).pages
          .map((page) => page.text)
          .join("\n"),
      ),
    });
    const statuses = Object.fromEntries(result.findings.map((finding) => [finding.provisionId, finding.status]));
    expect(statuses.purchase_price).toBe("EQUIVALENT");
    expect(statuses.closing).toBe("DISCREPANCY");
    expect(statuses.inspection).toBe("MISSING");
    expect(statuses.assignment).toBe("NEW_TERM");
  });
});

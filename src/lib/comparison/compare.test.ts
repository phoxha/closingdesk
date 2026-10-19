import { describe, expect, it } from "vitest";
import { compareDocuments, sourceFromText } from "@/lib/comparison/compare";
import { applyModelFindings } from "@/lib/comparison/llm";
import { formatMoney, parseMoney, parseWordNumber } from "@/lib/comparison/normalize";
import { SAMPLE_OFFER, SAMPLE_PSA, SAMPLE_PSA_REVISED } from "@/lib/documents/sample-contracts";
import { buildReportModel } from "@/lib/report/model";
import { isOpenFinding } from "@/lib/review-state";
import type { Finding, Matter } from "@/lib/types";

function compareSample(offer = SAMPLE_OFFER, psa = SAMPLE_PSA) {
  return compareDocuments({
    reference: [sourceFromText("offer", "offer.pdf", "offer", offer)],
    psa: sourceFromText("psa", "psa.pdf", "psa", psa),
  });
}

function status(offer = SAMPLE_OFFER, psa = SAMPLE_PSA) {
  return Object.fromEntries(compareSample(offer, psa).findings.map((finding) => [finding.provisionId, finding.status]));
}

describe("term comparison", () => {
  it("treats worded and numeric prices as the same amount", () => {
    const parsed = parseMoney("Three Hundred Fifty Thousand Dollars ($350,000)");
    expect(parsed).toEqual({ cents: 35_000_000, kind: "amount" });
    expect(formatMoney(35_000_000)).toBe("$350,000");
    expect(parseWordNumber("fifteen thousand")).toBe(15000);
    const findings = status();
    expect(findings.purchase_price).toBe("EQUIVALENT");
  });

  it("flags a changed closing date as a high-priority discrepancy", () => {
    const result = compareSample();
    const closing = result.findings.find((finding) => finding.provisionId === "closing");
    expect(closing?.status).toBe("DISCREPANCY");
    expect(closing?.severity).toBe("high");
    expect(closing?.offerQuote).toMatch(/November 15, 2026/);
    expect(closing?.psaQuote).toMatch(/December 1, 2026/);
    expect(closing?.offerPage).toBe(1);
  });

  it("flags an offer contingency that the purchase agreement does not contain", () => {
    const inspection = compareSample().findings.find((finding) => finding.provisionId === "inspection");
    expect(inspection?.status).toBe("MISSING");
    expect(inspection?.offerQuote).toMatch(/home inspection/i);
    expect(inspection?.psaQuote).toBe("");
    const appraisal = compareSample().findings.find((finding) => finding.provisionId === "appraisal");
    expect(appraisal?.status).toBe("MISSING");
  });

  it("flags a new assignment right without calling it an error", () => {
    const assignment = compareSample().findings.find((finding) => finding.provisionId === "assignment");
    expect(assignment?.status).toBe("NEW_TERM");
    expect(assignment?.severity).toBe("review");
    expect(assignment?.explanation).toMatch(/not treated as an error/i);
    expect(assignment?.psaQuote).toMatch(/assign/i);
    const time = compareSample().findings.find((finding) => finding.provisionId === "time_of_essence");
    expect(time?.status).toBe("NEW_TERM");
  });

  it("recognizes equivalent party and address wording", () => {
    const findings = status();
    expect(findings.seller).toBe("EQUIVALENT");
    expect(findings.buyer).toBe("MATCH");
    expect(findings.property_address).toBe("EQUIVALENT");
    expect(findings.due_diligence).toBe("EQUIVALENT");
    expect(findings.title_deed).toBe("EQUIVALENT");
    expect(findings.possession).toBe("EQUIVALENT");
    expect(findings.included_items).toBe("EQUIVALENT");
  });

  it("flags deposit, financing, and repair conflicts", () => {
    const findings = status();
    expect(findings.earnest_deposit).toBe("DISCREPANCY");
    expect(findings.financing).toBe("DISCREPANCY");
    expect(findings.property_condition).toBe("DISCREPANCY");
  });

  it("does not invent a provision that neither document contains", () => {
    const blob = compareSample().findings.map((finding) => `${finding.title} ${finding.explanation}`).join(" ");
    expect(blob).not.toMatch(/radon/i);
    expect(blob).not.toMatch(/lead paint/i);
  });

  it("does not assert a match when extraction fails", () => {
    const result = compareDocuments({
      reference: [sourceFromText("offer", "offer.pdf", "offer", " ")],
      psa: sourceFromText("psa", "psa.pdf", "psa", SAMPLE_PSA),
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.status).toBe("UNCLEAR");
    expect(result.findings.some((finding) => finding.status === "MATCH" || finding.status === "EQUIVALENT")).toBe(false);
  });

  it("does not treat a sparse scan as a match or a missing term", () => {
    const result = compareDocuments({
      reference: [sourceFromText("offer", "offer.pdf", "offer", SAMPLE_OFFER)],
      psa: sourceFromText("psa", "scan.pdf", "psa", "Purchase Price: $350,000\n\nClosing: November 15, 2026", "sparse"),
    });
    expect(result.findings.some((finding) => finding.status === "MATCH" || finding.status === "EQUIVALENT")).toBe(false);
    expect(result.findings.find((finding) => finding.provisionId === "inspection")?.status).toBe("UNCLEAR");
  });

  it("reads a revised price as a discrepancy", () => {
    expect(status(SAMPLE_OFFER, SAMPLE_PSA_REVISED).purchase_price).toBe("DISCREPANCY");
  });

  it("reads filled values on a standard offer form", () => {
    const offer = `
From: BUYER(S): North Pine LLC To: OWNER OF RECORD ("SELLER"): Jordan Hale
The BUYER offers to purchase the real property described as 12 Beacon Street, Boston, MA 02108 together with all buildings.
1. Purchase Price: The BUYER agrees to pay the sum of $ 410,000 to the SELLER for the purchase of the Premises.
i. $ 15,000 as a deposit to bind this Offer
5. Closing. The SELLER agrees to deliver a deed at 12:00 p.m. on 11/02/2026 at the registry of deeds.
`.trim();
    const findings = status(offer, "Purchase Price: $410,000\nClosing: November 2, 2026\nBuyer: North Pine LLC\nSeller: Jordan Hale\nProperty: 12 Beacon Street, Boston, MA 02108\nEarnest Money Deposit: $20,000.");
    expect(findings.purchase_price).toBe("EQUIVALENT");
    expect(findings.closing).toBe("EQUIVALENT");
    expect(findings.buyer).toBe("EQUIVALENT");
    expect(findings.seller).toBe("EQUIVALENT");
    expect(findings.property_address).toBe("EQUIVALENT");
    expect(findings.earnest_deposit).toBe("DISCREPANCY");
  });

  it("reads a purchase agreement that labels price, deposit, and deed delivery without colons", () => {
    const offer = `
Name(s): North Pine LLC    Name(s): Jordan Hale
The BUYER offers to purchase the real property described as 12 Beacon Street, Boston, MA 02108 together with all buildings.
1. Purchase Price: The BUYER agrees to pay the sum of $ 410,000 to the SELLER for the purchase of the Premises.
i. $ 15,000 as a deposit to bind this Offer
5. Closing. The SELLER agrees to deliver a deed at 4 p.m. on 11/02/2026 at the registry of deeds.
`.trim();
    const psa = `
This Agreement is made by and between Jordan Hale, hereinafter called SELLER, and North Pine LLC, a Massachusetts limited liability company with an address of 9 Pine Street, hereinafter called the BUYER.
The SELLER agrees to sell the following bounded and described premises: 12 Beacon Street, Boston, Hampden County, Massachusetts, being all of the premises described in a recorded deed.
For such deed the BUYER is to pay the sum of Price $ 410,000.00 of which Deposit $ 15,000.00 have been paid this day as a deposit.
The premises shall be conveyed on or before November 30, 2026 by a good and sufficient deed.
`.trim();
    const findings = status(offer, psa);
    expect(findings.purchase_price).toBe("EQUIVALENT");
    expect(findings.property_address).toBe("EQUIVALENT");
    expect(findings.buyer).toBe("EQUIVALENT");
    expect(findings.seller).toBe("EQUIVALENT");
    expect(findings.closing).toBe("DISCREPANCY");
    expect(findings.earnest_deposit).not.toBe("MISSING");
  });

  it("keeps the page of a clause that falls on a later page", () => {
    const offer = sourceFromText("offer", "offer.pdf", "offer", `Purchase Price: $350,000\fClosing: November 15, 2026`);
    const psa = sourceFromText("psa", "psa.pdf", "psa", SAMPLE_PSA);
    const closing = compareDocuments({ reference: [offer], psa }).findings.find((finding) => finding.provisionId === "closing");
    expect(closing?.offerPage).toBe(2);
  });
});

describe("model guard", () => {
  it("rejects a match that contradicts parsed dates and quotes that are not in the document", () => {
    const deterministic = compareSample().findings;
    const closing = deterministic.find((finding) => finding.provisionId === "closing");
    expect(closing?.status).toBe("DISCREPANCY");
    const result = applyModelFindings(
      deterministic,
      [
        {
          id: "closing",
          status: "MATCH",
          explanation: "These dates are close enough.",
          offerQuote: "Closing: November 15, 2026 at the offices of the seller's attorney, or by mail.",
          psaQuote: "Closing Date: December 1, 2026. Closing shall occur at the registry of deeds.",
        },
        {
          id: "radon",
          status: "NEW_TERM",
          explanation: "Radon testing is required.",
          offerQuote: "",
          psaQuote: "The buyer shall obtain a radon test.",
        },
      ],
      SAMPLE_OFFER,
      SAMPLE_PSA,
    );
    expect(result.findings.find((finding) => finding.provisionId === "closing")?.status).toBe("DISCREPANCY");
    expect(result.findings.some((finding) => /radon/i.test(finding.title + finding.explanation))).toBe(false);
  });
});

describe("attorney review and report", () => {
  it("preserves the finding when the attorney resolves it", () => {
    const compared = compareSample();
    const findings: Finding[] = compared.findings.map((finding, index) => ({
      ...finding,
      id: `f-${index}`,
      runId: "run-1",
    }));
    const closing = findings.find((finding) => finding.provisionId === "closing");
    expect(closing).toBeTruthy();
    const original = closing?.explanation;
    const reviews = [
      {
        id: "r1",
        findingId: closing!.id,
        userId: "user",
        action: "resolved" as const,
        note: "Seller agreed to the December date.",
        createdAt: "2026-10-14T12:00:00.000Z",
      },
    ];
    expect(isOpenFinding(closing!, reviews)).toBe(false);
    expect(closing?.explanation).toBe(original);
    const matter: Matter = {
      id: "m1",
      userId: "user",
      propertyAddress: "148 Commonwealth Avenue, Unit 4, Boston, MA 02116",
      clientName: "Elena Voss",
      matterName: "Voss purchase",
      closingDate: null,
      sample: true,
      createdAt: "2026-10-14T12:00:00.000Z",
      updatedAt: "2026-10-14T12:00:00.000Z",
    };
    const report = buildReportModel({
      matter,
      documents: [],
      findings,
      reviews,
      narrative: compared.summary.narrative,
      preparedAt: "2026-10-14T12:00:00.000Z",
    });
    expect(report.differences.some((row) => row.title === "Closing date")).toBe(true);
    expect(report.reviewItems.some((row) => row.title === "Inspection")).toBe(true);
    expect(report.reviewItems.some((row) => row.title === "Assignment")).toBe(true);
    expect(report.aligned.some((row) => row.title === "Purchase price")).toBe(true);
    expect(report.outstanding.some((row) => row.title === "Closing date")).toBe(false);
    expect(report.comments[0]?.note).toMatch(/December/);
    expect(report.disclaimer).toMatch(/not make a legal determination/i);
  });
});

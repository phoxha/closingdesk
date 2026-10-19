import { describe, expect, it } from "vitest";
import { layoutText, type PositionedText } from "@/lib/documents/layout-text";

function item(str: string, x: number, y: number, width: number): PositionedText {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}

describe("layoutText", () => {
  it("keeps a filled amount on the purchase-price line", () => {
    const text = layoutText([
      item("1. Purchase Price: The BUYER agrees to pay the sum of $", 40, 446.6, 250),
      item("to the SELLER for the purchase", 360, 446.6, 140),
      item("375,000", 298, 448.3, 42),
      item("i. $", 40, 421, 20),
      item("17,500", 70, 421.4, 36),
      item("as a deposit to bind this Offer", 120, 421, 160),
    ]);
    expect(text).toMatch(/sum of \$ 375,000 to the SELLER/);
    expect(text).toMatch(/\$ 17,500 as a deposit/);
    expect(text.indexOf("375,000")).toBeLessThan(text.indexOf("17,500"));
  });

  it("does not merge the next paragraph onto the same line", () => {
    const text = layoutText([
      item("Buyer:", 40, 700, 40),
      item("North Pine LLC", 90, 700.4, 80),
      item("Closing:", 40, 640, 50),
      item("November 15, 2026", 100, 640, 90),
    ]);
    expect(text).toBe("Buyer: North Pine LLC\nClosing: November 15, 2026");
  });
});

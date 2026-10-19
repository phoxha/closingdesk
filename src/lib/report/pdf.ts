import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportModel, ReportRow } from "@/lib/report/model";
import { formatDay, formatStamp } from "@/lib/format";
import { ACTION_LABELS, type ReviewAction } from "@/lib/types";

const INK = rgb(0.1, 0.13, 0.12);
const MUTED = rgb(0.32, 0.35, 0.33);
const COPPER = rgb(0.55, 0.27, 0.14);
const RULE = rgb(0.75, 0.7, 0.62);

export async function renderReportPdf(model: ReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const writer = new Writer(doc, regular, bold);
  writer.brand();
  writer.heading(model.title);
  writer.paragraph(model.disclaimer, { italic: true, size: 10, color: MUTED });
  writer.gap(8);
  writer.heading("Transaction", 2);
  writer.pair("Property", model.propertyAddress);
  writer.pair("Client", model.clientName || "—");
  writer.pair("Matter", model.matterName || "—");
  writer.pair("Closing date on file", formatDay(model.closingDate));
  writer.pair("Prepared", formatStamp(model.preparedAt));
  writer.heading("Documents compared", 2);
  if (model.documents.length === 0) writer.paragraph("Document records were not attached to this export.");
  for (const document of model.documents) {
    writer.paragraph(`${document.role}, version ${document.version}: ${document.filename} (${document.pages} page${document.pages === 1 ? "" : "s"}, extraction ${document.extraction}).`);
  }
  writer.heading("Summary", 2);
  writer.paragraph(model.narrative);
  writer.paragraph(model.counts.map((count) => `${count.label} ${count.value}`).join("   "));
  writeRows(writer, "Confirmed matching terms", model.aligned, "No matching terms were confirmed.");
  writeRows(writer, "Material differences", model.differences, "No conflicting terms were found.");
  writeRows(writer, "Missing or new provisions requiring review", model.reviewItems, "No missing, new, or unclear provisions were flagged.");
  writer.heading("Attorney comments and resolutions", 2);
  if (model.comments.length === 0) writer.paragraph("No attorney comments have been recorded.");
  for (const comment of model.comments) {
    const action = ACTION_LABELS[comment.action as ReviewAction] ?? comment.action;
    writer.paragraph(`${comment.title} — ${action}${comment.note ? `. ${comment.note}` : "."} ${formatStamp(comment.at)}`);
  }
  writeRows(writer, "Outstanding items", model.outstanding, "No items remain open.");
  writer.gap(10);
  writer.paragraph("Word export is planned for a later release. This PDF is the current report.", { size: 9, color: MUTED });
  return doc.save();
}

function writeRows(writer: Writer, title: string, rows: ReportRow[], empty: string): void {
  writer.heading(title, 2);
  if (rows.length === 0) {
    writer.paragraph(empty);
    return;
  }
  for (const row of rows) {
    writer.paragraph(`${row.title} · ${row.category} · ${row.status} · ${row.severity}`, { bold: true, size: 11 });
    writer.paragraph(row.explanation, { size: 10 });
    if (row.offerQuote) writer.paragraph(`Offer (${row.offerRef}): ${row.offerQuote}`, { size: 9, color: MUTED });
    if (row.psaQuote) writer.paragraph(`Purchase agreement (${row.psaRef}): ${row.psaQuote}`, { size: 9, color: MUTED });
    writer.paragraph(`Attorney: ${row.decision}`, { size: 10 });
    writer.gap(4);
  }
}

class Writer {
  private page: PDFPage;
  private y: number;
  private readonly width = 612;
  private readonly height = 792;
  private readonly margin = 54;

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }

  brand(): void {
    this.draw("CLOSINGDESK", { font: this.bold, size: 9, color: COPPER });
  }

  heading(text: string, level: 1 | 2 = 1): void {
    this.gap(level === 1 ? 4 : 8);
    this.draw(text, { font: this.bold, size: level === 1 ? 18 : 13, color: INK });
    if (level === 2) {
      this.page.drawLine({
        start: { x: this.margin, y: this.y + 4 },
        end: { x: this.width - this.margin, y: this.y + 4 },
        thickness: 0.4,
        color: RULE,
      });
      this.gap(6);
    }
  }

  pair(label: string, value: string): void {
    this.paragraph(`${label}: ${value || "—"}`, { size: 11 });
  }

  paragraph(text: string, options?: { size?: number; bold?: boolean; italic?: boolean; color?: ReturnType<typeof rgb> }): void {
    const size = options?.size ?? 11;
    const font = options?.bold ? this.bold : this.regular;
    const color = options?.color ?? INK;
    for (const line of wrap(clean(text), font, size, this.width - this.margin * 2)) {
      this.draw(line, { font, size, color });
    }
  }

  gap(amount: number): void {
    this.y -= amount;
    this.breakIfNeeded(0);
  }

  private draw(text: string, options: { font: PDFFont; size: number; color: ReturnType<typeof rgb> }): void {
    this.breakIfNeeded(options.size + 4);
    this.page.drawText(text, {
      x: this.margin,
      y: this.y,
      size: options.size,
      font: options.font,
      color: options.color,
    });
    this.y -= options.size + 4;
  }

  private breakIfNeeded(needed: number): void {
    if (this.y - needed >= this.margin) return;
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function clean(text: string): string {
  return text.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "").replace(/\s+/g, " ").trim();
}

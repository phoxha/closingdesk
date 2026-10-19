import { layoutText } from "@/lib/documents/layout-text";
import type { DocPage, ExtractionStatus } from "@/lib/types";

const MAX_BYTES = 20 * 1024 * 1024;

/** Bump when PDF text placement changes, so stored documents are read again. */
export const EXTRACTION_VERSION = 3;

export type ExtractedFile = {
  pages: DocPage[];
  status: ExtractionStatus;
  warning: string | null;
  mimeType: string;
};

export function acceptedKind(filename: string, mimeType: string): "pdf" | "docx" | null {
  const name = filename.toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  return null;
}

export async function extractDocument(bytes: Buffer, filename: string, mimeType: string): Promise<ExtractedFile> {
  const kind = acceptedKind(filename, mimeType);
  if (!kind) {
    return {
      pages: [{ page: 1, text: "" }],
      status: "failed",
      warning: "Upload a PDF or DOCX file.",
      mimeType,
    };
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return {
      pages: [{ page: 1, text: "" }],
      status: "failed",
      warning: bytes.length === 0 ? "The file is empty." : "Files must be 20 MB or smaller.",
      mimeType: kind === "pdf" ? "application/pdf" : docxMime(),
    };
  }
  try {
    const pages = kind === "pdf" ? await pdfPages(bytes) : await docxPages(bytes);
    return classify(pages, kind === "docx");
  } catch {
    return {
      pages: [{ page: 1, text: "" }],
      status: "failed",
      warning: "The file could not be read. No comparison will be asserted from it.",
      mimeType: kind === "pdf" ? "application/pdf" : docxMime(),
    };
  }
}

function classify(pages: DocPage[], docx: boolean): ExtractedFile {
  const chars = pages.reduce((sum, page) => sum + page.text.trim().length, 0);
  const warning = docx ? "Word files do not include a reliable page map. Section labels are used when the text has them." : null;
  if (chars < 40) {
    return {
      pages,
      status: "failed",
      warning: "Almost no text could be read. If this is a scan, OCR is not enabled, and no match will be asserted.",
      mimeType: docx ? docxMime() : "application/pdf",
    };
  }
  if (chars < 200) {
    return {
      pages,
      status: "sparse",
      warning: "Very little text was extracted. Matches and missing terms will be flagged instead of asserted.",
      mimeType: docx ? docxMime() : "application/pdf",
    };
  }
  return {
    pages,
    status: "ok",
    warning,
    mimeType: docx ? docxMime() : "application/pdf",
  };
}

async function pdfPages(bytes: Buffer): Promise<DocPage[]> {
  const data = Uint8Array.from(bytes);
  const unpdf = await import("unpdf");
  try {
    const result = await unpdf.extractTextItems(data);
    const pages = result.items.map((items, index) => ({
      page: index + 1,
      text: layoutText(items.map((item) => ({ str: item.str, transform: [0, 0, 0, 0, item.x, item.y], width: item.width }))),
    }));
    if (pages.some((page) => page.text.trim().length > 40)) return pages;
  } catch {
    // Fall back to reading order that ignores position.
  }
  const plain = await unpdf.extractText(data, { mergePages: false });
  const texts = Array.isArray(plain.text) ? plain.text : [plain.text];
  if (texts.length === 0) return [{ page: 1, text: "" }];
  return texts.map((text, index) => ({ page: index + 1, text: String(text ?? "") }));
}

async function docxPages(bytes: Buffer): Promise<DocPage[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: bytes });
  return [{ page: 1, text: result.value ?? "" }];
}

function docxMime(): string {
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export async function textToPdf(body: string): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const margin = 56;
  const width = 612;
  const height = 792;
  const maxWidth = width - margin * 2;
  let page = doc.addPage([width, height]);
  let y = height - margin;

  const paragraphs = body.split(/\n\n/).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  paragraphs.forEach((paragraph, index) => {
    const heading = index === 0 || paragraph === paragraph.toUpperCase();
    const face = heading ? bold : font;
    const size = heading ? 13 : 11;
    const lines = wrap(paragraph, face, size, maxWidth);
    const blockHeight = lines.length * (size + 4) + 12;
    if (y - blockHeight < margin) {
      page = doc.addPage([width, height]);
      y = height - margin;
    }
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size, font: face, color: rgb(0.1, 0.12, 0.11) });
      y -= size + 4;
    }
    y -= 12;
  });

  return Buffer.from(await doc.save());
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
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

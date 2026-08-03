import { BadRequestException } from '@nestjs/common';
import { classifyPdf, extractPagesMarkdown } from '@firecrawl/pdf-inspector';

export type PdfExtraction = {
  pdfType: string;
  markdown: string;
  pageCount: number;
  sampledPages: number[];
};

const START_PAGES = 10;
const MIDDLE_PAGES = 10;
const END_PAGES = 10;

export type PageSample = { start: number[]; middle: number[]; end: number[] };

export function pickPageSample(pageCount: number): PageSample {
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return { start: [0], middle: [], end: [] };
  }
  const total = Math.min(pageCount, START_PAGES + MIDDLE_PAGES + END_PAGES);
  const startCount = Math.min(START_PAGES, total);
  const endCount = Math.min(END_PAGES, Math.max(0, total - startCount));
  const middleCount = Math.max(0, total - startCount - endCount);

  const start = Array.from({ length: startCount }, (_, index) => index);
  const end = Array.from({ length: endCount }, (_, index) => pageCount - endCount + index);
  const middleStart = Math.floor((pageCount - middleCount) / 2);
  const middle = Array.from({ length: middleCount }, (_, index) => middleStart + index);
  return { start, middle, end };
}

export function pdfToMarkdown(buffer: Buffer): PdfExtraction {
  const { pdfType, pageCount } = classifyPdf(buffer);
  if (pdfType !== 'TextBased' && pdfType !== 'Mixed') {
    throw new BadRequestException(
      `No pudimos extraer texto del PDF (tipo: ${pdfType}). Los PDFs escaneados o basados en imagen requieren OCR, que esta versión no incluye.`,
    );
  }
  const sample = pickPageSample(pageCount);
  const sampledPages = [...sample.start, ...sample.middle, ...sample.end];
  const result = extractPagesMarkdown(buffer, sampledPages);
  const markdown = buildZonedMarkdown(result.pages, sample);
  if (!markdown) {
    throw new BadRequestException('No pudimos extraer texto del PDF.');
  }
  return { pdfType, markdown, pageCount, sampledPages };
}

function buildZonedMarkdown(pages: Array<{ page: number; markdown: string }>, sample: PageSample): string {
  const byPage = new Map(pages.map((page) => [page.page, page.markdown]));
  const zones: Array<[string, number[]]> = [
    ['INICIO DEL LIBRO', sample.start],
    ['SECCIÓN MEDIA DEL LIBRO', sample.middle],
    ['FINAL DEL LIBRO', sample.end],
  ];
  const blocks: string[] = [];
  for (const [label, indices] of zones) {
    const content = indices
      .map((index) => byPage.get(index) ?? '')
      .filter((text) => text.trim().length > 0)
      .join('\n\n');
    if (!content) continue;
    const first = Math.min(...indices) + 1;
    const last = Math.max(...indices) + 1;
    blocks.push(`=== ${label} · páginas ${first}–${last} (ejemplo de escritura) ===\n${content}`);
  }
  return blocks.join('\n\n');
}

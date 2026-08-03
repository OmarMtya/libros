import { describe, expect, it } from 'vitest';
import { pdfToMarkdown, pickPageSample } from '../src/ai/pdf-to-markdown';

function buildPdf(lines: string[]): Buffer {
  const parts = ['%PDF-1.4\n'];
  const pageRefs: string[] = [];
  const pageObjects: string[] = [];
  let nextObject = 3;
  for (const line of lines) {
    const safe = line.replace(/[()\\]/g, '\\$&').slice(0, 88);
    const stream = `BT /F1 11 Tf 54 720 Td (${safe}) Tj\nET`;
    const pageNumber = nextObject;
    const contentNumber = pageNumber + 1;
    const fontNumber = pageNumber + 2;
    pageObjects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNumber} 0 R /Resources << /Font << /F1 ${fontNumber} 0 R >> >> >>`,
    );
    pageObjects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageObjects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    pageRefs.push(`${pageNumber} 0 R`);
    nextObject += 3;
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`,
    ...pageObjects,
  ];
  const offsets: number[] = [];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(parts.join(''), 'latin1'));
    parts.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefPos = Buffer.byteLength(parts.join(''), 'latin1');
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  return Buffer.from(parts.join(''), 'latin1');
}

describe('pickPageSample', () => {
  it('splits short documents into start/end and fills the rest', () => {
    const sample = pickPageSample(20);
    expect(sample.start).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sample.middle).toEqual([]);
    expect(sample.end).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('samples 10 pages at the start, the middle and the end for long documents', () => {
    const sample = pickPageSample(300);
    expect(sample.start).toHaveLength(10);
    expect(sample.start[0]).toBe(0);
    expect(sample.start[9]).toBe(9);
    expect(sample.middle).toHaveLength(10);
    expect(sample.middle[0]).toBe(145);
    expect(sample.middle[9]).toBe(154);
    expect(sample.end).toHaveLength(10);
    expect(sample.end[0]).toBe(290);
    expect(sample.end[9]).toBe(299);
  });

  it('samples all pages up to the 30-page budget', () => {
    const sample = pickPageSample(35);
    const all = [...sample.start, ...sample.middle, ...sample.end];
    expect(all).toHaveLength(30);
    expect(sample.start).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sample.middle).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(sample.end).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34]);
  });

  it('handles degenerate page counts', () => {
    expect(pickPageSample(0)).toEqual({ start: [0], middle: [], end: [] });
    expect(pickPageSample(1)).toEqual({ start: [0], middle: [], end: [] });
  });
});

describe('pdfToMarkdown', () => {
  it('extracts text, marks the zones and reports page count for a text-based PDF', () => {
    const buffer = buildPdf(['Pagina uno del libro', 'Pagina dos del libro']);
    const result = pdfToMarkdown(buffer);
    expect(result.pdfType).toBe('TextBased');
    expect(result.pageCount).toBe(2);
    expect(result.sampledPages).toEqual([0, 1]);
    expect(result.markdown).toContain('INICIO DEL LIBRO');
    expect(result.markdown).toContain('páginas 1–2');
    expect(result.markdown).toContain('Pagina uno');
  });
});

// ---------------------------------------------------------------------------
// Word (.docx) and PDF (.pdf) → the same ParsedSheet grid shape that the
// Excel importer already understands (see importParser.ts). This lets one
// mapping/review/import pipeline handle all three source formats.
//
// Both libraries are dynamically imported so the ~1.7 MB combined weight of
// mammoth + pdfjs-dist is only ever downloaded by someone who actually
// uploads a Word or PDF file — everyone else still gets the small,
// Excel-only bundle.
// ---------------------------------------------------------------------------

import type { ParsedSheet } from '@/data/importParser';

function detectHeaderRow(matrix: string[][]): number {
  const scanLimit = Math.min(10, matrix.length);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i];
    const nonEmpty = row.filter((c) => c.trim() !== '');
    if (nonEmpty.length < 2) continue;
    const score = nonEmpty.length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function toSheet(name: string, matrix: string[][]): ParsedSheet {
  return { name, matrix, suggestedHeaderRow: detectHeaderRow(matrix) };
}

// ---------------------------------------------------------------------------
// Shared fallback: "Label: value" style documents (a single profile per
// buyer/seller, or a report that lists records as labelled fields rather
// than a table). Every time a label repeats, we treat that as the start of
// a new record — this works whether records are separated by blank lines,
// page breaks, or nothing at all.
// ---------------------------------------------------------------------------

const LABEL_VALUE_RE = /^([A-Za-z][A-Za-z0-9 /&_.()-]{1,40}?)\s*[:\-–]\s+(.+)$/;

export function linesToRecordMatrix(lines: string[]): string[][] | null {
  const records: Array<Map<string, string>> = [];
  let current: Map<string, string> | null = null;
  let lastKey: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LABEL_VALUE_RE);
    if (m) {
      const key = m[1].trim();
      const value = m[2].trim();
      if (current && current.has(key)) {
        records.push(current);
        current = new Map();
      }
      if (!current) current = new Map();
      current.set(key, value);
      lastKey = key;
    } else if (current && lastKey) {
      // Continuation of a multi-line value (e.g. a wrapped address).
      const prev = current.get(lastKey) ?? '';
      current.set(lastKey, prev ? `${prev} ${line}` : line);
    }
  }
  if (current && current.size > 0) records.push(current);

  // Need at least 2 records with at least 2 fields each to be worth treating
  // as structured data — a single labelled paragraph is more likely a
  // one-off note than a batch of buyer/seller records.
  if (records.length < 1) return null;

  const headers: string[] = [];
  for (const r of records) {
    for (const k of r.keys()) {
      if (!headers.includes(k)) headers.push(k);
    }
  }
  if (headers.length < 2) return null;

  const matrix: string[][] = [headers];
  for (const r of records) matrix.push(headers.map((h) => r.get(h) ?? ''));
  return matrix;
}

// A one-column dump — the guaranteed-not-to-lose-anything last resort, so
// unstructured text can still be reviewed and mapped by hand (e.g. onto
// "General Remarks") instead of the file being rejected outright.
function linesToNotesMatrix(lines: string[]): string[][] {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  return [['Text'], ...nonEmpty.map((l) => [l])];
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------

export async function parseDocxToSheets(file: File): Promise<ParsedSheet[]> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));

  const sheets: ParsedSheet[] = [];
  tables.forEach((table, i) => {
    const matrix: string[][] = [];
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
      if (cells.some((c) => c !== '')) matrix.push(cells);
    });
    if (matrix.length >= 2) sheets.push(toSheet(tables.length > 1 ? `Table ${i + 1}` : 'Table', matrix));
  });

  if (sheets.length > 0) return sheets;

  // No usable table in the document — fall back to the raw paragraph text.
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });
  const lines = text.split(/\r?\n/);

  const recordMatrix = linesToRecordMatrix(lines);
  if (recordMatrix) return [toSheet('Extracted Records', recordMatrix)];

  return [toSheet('Document Text', linesToNotesMatrix(lines))];
}

// ---------------------------------------------------------------------------
// PDF (.pdf)
// ---------------------------------------------------------------------------

interface PositionedItem { str: string; x: number; y: number; endX: number }

async function extractPdfLines(file: File): Promise<PositionedItem[][]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Vite-native worker URL — bundled as its own asset, loaded only on demand.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  const allLines: PositionedItem[][] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is typeof it & { str: string; transform: number[]; width: number } => 'str' in it && it.str.trim() !== '')
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], endX: it.transform[4] + it.width }));

    // Group into lines by y-position (allowing a small tolerance for
    // sub-pixel baseline jitter within the same visual row).
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PositionedItem[][] = [];
    for (const item of items) {
      const line = lines.find((l) => Math.abs(l[0].y - item.y) < 3);
      if (line) line.push(item);
      else lines.push([item]);
    }
    lines.forEach((l) => l.sort((a, b) => a.x - b.x));
    allLines.push(...lines);
  }
  return allLines;
}

/** Joins a positioned line into cells, splitting on gaps wide enough to be a column break rather than a word space. */
function lineToCells(line: PositionedItem[]): string[] {
  const cells: string[] = [];
  let current = line[0].str;
  for (let i = 1; i < line.length; i++) {
    const gap = line[i].x - line[i - 1].endX;
    // A gap wider than ~4 average-char-widths reads as a column break; a
    // narrower one is just a space (or missing space) within the same cell.
    const avgCharWidth = (line[i - 1].endX - line[i - 1].x) / Math.max(1, line[i - 1].str.length);
    if (gap > Math.max(8, avgCharWidth * 3.5)) {
      cells.push(current.trim());
      current = line[i].str;
    } else {
      current += (gap > avgCharWidth * 0.6 ? ' ' : '') + line[i].str;
    }
  }
  cells.push(current.trim());
  return cells.filter((c) => c !== '');
}

export async function parsePdfToSheets(file: File): Promise<ParsedSheet[]> {
  const lines = await extractPdfLines(file);
  const cellRows = lines.map(lineToCells).filter((r) => r.length > 0);

  // If most rows split into the same handful of columns (2+), this reads as
  // an actual table (e.g. a spreadsheet exported/printed to PDF) — use it
  // directly as the grid.
  const counts = new Map<number, number>();
  for (const r of cellRows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  const [modeLen, modeCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];

  if (modeLen >= 2 && modeCount >= Math.max(3, cellRows.length * 0.4)) {
    // Pad/trim every row to the mode column count so the grid is rectangular.
    const matrix = cellRows.map((r) => {
      if (r.length === modeLen) return r;
      if (r.length > modeLen) return [...r.slice(0, modeLen - 1), r.slice(modeLen - 1).join(' ')];
      return [...r, ...Array(modeLen - r.length).fill('')];
    });
    return [toSheet('PDF Table', matrix)];
  }

  // Not tabular — try labelled-record extraction, then fall back to a plain
  // text dump so nothing from the file is silently lost.
  const flatLines = cellRows.map((r) => r.join(' '));
  const recordMatrix = linesToRecordMatrix(flatLines);
  if (recordMatrix) return [toSheet('Extracted Records', recordMatrix)];

  return [toSheet('Document Text', linesToNotesMatrix(flatLines))];
}

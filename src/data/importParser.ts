import * as XLSX from 'xlsx';
import type { Activity, EventType } from '@/types';
import { nextActivityId } from '@/data/repository';
import { validateActivity, isDuplicateActivity, type FieldError } from '@/data/validation';

// ---------------------------------------------------------------------------
// Reading the workbook
// ---------------------------------------------------------------------------

export interface ParsedSheet {
  name: string;
  /** Raw grid — every row/cell as a trimmed string, no header assumptions yet. */
  matrix: string[][];
  /** Best-guess index (0-based) of the header row, from detectHeaderRow(). */
  suggestedHeaderRow: number;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][];
    const matrix = raw.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell).trim())));
    return { name, matrix, suggestedHeaderRow: detectHeaderRow(matrix) };
  });
  return { sheets };
}

/**
 * Reads Excel (.xlsx/.xls), CSV, Word (.docx) or PDF (.pdf) and returns the
 * same ParsedWorkbook grid shape regardless of source format, so the rest of
 * the import wizard (sheet/header pick, column mapping, review) never needs
 * to know which kind of file it started from.
 *
 * Word and PDF extraction is best-effort: a document with real tables (Word)
 * or a clearly columnar layout (PDF) is read as a grid directly; otherwise
 * we fall back to detecting repeated "Label: value" records, and as a last
 * resort dump the raw text as a single column so nothing is silently
 * dropped — it just may need manual column mapping in the next step.
 */
export async function parseImportFile(file: File): Promise<ParsedWorkbook> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'docx' || ext === 'doc') {
    const { parseDocxToSheets } = await import('@/data/documentExtract');
    return { sheets: await parseDocxToSheets(file) };
  }
  if (ext === 'pdf') {
    const { parsePdfToSheets } = await import('@/data/documentExtract');
    return { sheets: await parsePdfToSheets(file) };
  }
  return parseWorkbookFile(file);
}

/**
 * Scans the first 10 rows for the one that looks most like a header row —
 * most non-empty cells, without being a single merged title (e.g. sheets
 * like "Memorandum Of Understanding" that have a title row before the
 * actual column headers).
 */
function detectHeaderRow(matrix: string[][]): number {
  const scanLimit = Math.min(10, matrix.length);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i];
    const nonEmpty = row.filter((c) => c.trim() !== '');
    if (nonEmpty.length < 2) continue; // a single filled cell is almost always a title, not headers
    const score = nonEmpty.length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export interface SheetRows {
  headers: string[];
  /** Data rows keyed by header. Rows that are entirely empty are dropped. */
  rows: Record<string, string>[];
}

export function extractRows(sheet: ParsedSheet, headerRowIndex: number): SheetRows {
  const headerRow = sheet.matrix[headerRowIndex] ?? [];
  const seen = new Map<string, number>();
  const headers = headerRow.map((raw, i) => {
    const base = raw.trim() || `Column ${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const rows: Record<string, string>[] = [];
  for (let r = headerRowIndex + 1; r < sheet.matrix.length; r++) {
    const raw = sheet.matrix[r] ?? [];
    if (raw.every((c) => c.trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (raw[i] ?? '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Target fields the user can map spreadsheet columns onto
// ---------------------------------------------------------------------------

export type TargetKey =
  | 'ignore'
  | 'exporter.exporterName' | 'exporter.companyName' | 'exporter.iecNumber' | 'exporter.productCategory'
  | 'exporter.email' | 'exporter.phone' | 'exporter.website' | 'exporter.address'
  | 'composite.sellerBlock'
  | 'buyer.buyerName' | 'buyer.company' | 'buyer.country' | 'buyer.phone'
  | 'buyer.interestedProducts' | 'buyer.passportNumber'
  | 'composite.buyerBlock'
  | 'mou.signed' | 'mou.expectedValue'
  | 'orderPlaced.placed' | 'orderPlaced.finalValue' | 'orderPlaced.purchaseOrderNumber'
  | 'remarks.general' | 'remarks.challenges' | 'remarks.successStory';

interface TargetFieldMeta {
  key: TargetKey;
  label: string;
  group: string;
  /** If true, values from multiple source columns mapped to this field are concatenated (as "Header: value") instead of only the first non-empty winning. */
  concatenable?: boolean;
}

export const TARGET_FIELDS: TargetFieldMeta[] = [
  { key: 'ignore', label: "Don't import this column", group: '—' },

  { key: 'composite.sellerBlock', label: 'Seller/Exporter block (name + company + mobile + IEC — auto-split)', group: 'Exporter / Seller' },
  { key: 'exporter.exporterName', label: 'Exporter / Seller Name', group: 'Exporter / Seller' },
  { key: 'exporter.companyName', label: 'Company Name', group: 'Exporter / Seller' },
  { key: 'exporter.iecNumber', label: 'IEC Number', group: 'Exporter / Seller' },
  { key: 'exporter.productCategory', label: 'Product Category', group: 'Exporter / Seller' },
  { key: 'exporter.email', label: 'Email', group: 'Exporter / Seller' },
  { key: 'exporter.phone', label: 'Phone', group: 'Exporter / Seller' },
  { key: 'exporter.website', label: 'Website', group: 'Exporter / Seller' },
  { key: 'exporter.address', label: 'Address', group: 'Exporter / Seller', concatenable: true },

  { key: 'composite.buyerBlock', label: 'Buyer block (name + company + country + mobile — auto-split)', group: 'Buyer' },
  { key: 'buyer.buyerName', label: 'Buyer Name', group: 'Buyer' },
  { key: 'buyer.company', label: 'Buyer Company', group: 'Buyer' },
  { key: 'buyer.country', label: 'Buyer Country', group: 'Buyer' },
  { key: 'buyer.phone', label: 'Buyer Phone', group: 'Buyer' },
  { key: 'buyer.interestedProducts', label: 'Products / Items of Interest', group: 'Buyer', concatenable: true },
  { key: 'buyer.passportNumber', label: 'Passport Number', group: 'Buyer' },

  { key: 'mou.signed', label: 'MoU Signed (Yes/No)', group: 'Outcome' },
  { key: 'mou.expectedValue', label: 'MoU Expected Value', group: 'Outcome' },
  { key: 'orderPlaced.placed', label: 'Order Placed (Yes/No)', group: 'Outcome' },
  { key: 'orderPlaced.finalValue', label: 'Order Value / Amount', group: 'Outcome' },
  { key: 'orderPlaced.purchaseOrderNumber', label: 'PO / Order Number', group: 'Outcome' },

  { key: 'remarks.general', label: 'General Remarks / Notes', group: 'Remarks', concatenable: true },
  { key: 'remarks.challenges', label: 'Challenges', group: 'Remarks', concatenable: true },
  { key: 'remarks.successStory', label: 'Success Story / Feedback', group: 'Remarks', concatenable: true },
];

export type ColumnMapping = Record<string, TargetKey>; // header -> target

/** Best-effort auto-mapping from header text, so the user starts from a sensible default instead of a blank form. */
export function autoSuggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const norm = h.toLowerCase();
    mapping[h] = guessTarget(norm);
  }
  return mapping;
}

function guessTarget(norm: string): TargetKey {
  if (/(seller|exporter).*(profile|detail)/.test(norm)) return 'composite.sellerBlock';
  if (/buyer.*(profile|detail)/.test(norm)) return 'composite.buyerBlock';
  if (/company/.test(norm) && /(exporter|seller)/.test(norm)) return 'exporter.companyName';
  if (/^company name/.test(norm)) return 'exporter.companyName';
  if (/iec/.test(norm)) return 'exporter.iecNumber';
  if (/product/.test(norm) && /categor/.test(norm)) return 'exporter.productCategory';
  if (/^product/.test(norm)) return 'buyer.interestedProducts';
  if (/exporter.*name|seller.*name/.test(norm)) return 'exporter.exporterName';
  if (/e-?mail/.test(norm)) return 'exporter.email';
  if (/website/.test(norm)) return 'exporter.website';
  if (/address/.test(norm)) return 'exporter.address';
  if (/buyer.*name|contact person/.test(norm)) return 'buyer.buyerName';
  if (/buyer.*company/.test(norm)) return 'buyer.company';
  if (/country/.test(norm)) return 'buyer.country';
  if (/contact number|mobile|phone|whatsapp/.test(norm)) return 'buyer.phone';
  if (/passport/.test(norm)) return 'buyer.passportNumber';
  if (/mou/.test(norm) && /(signed|status)/.test(norm)) return 'mou.signed';
  if (/mou/.test(norm) && /value/.test(norm)) return 'mou.expectedValue';
  if (/order.*(placed|secured)/.test(norm)) return 'orderPlaced.placed';
  if (/amount|value/.test(norm)) return 'orderPlaced.finalValue';
  if (/po\b|purchase order|order.*number/.test(norm)) return 'orderPlaced.purchaseOrderNumber';
  if (/feedback|success|outcome/.test(norm)) return 'remarks.successStory';
  if (/challenge|issue|problem/.test(norm)) return 'remarks.challenges';
  if (/remark|note|point|quantity|district|district\b/.test(norm)) return 'remarks.general';
  return 'ignore';
}

// ---------------------------------------------------------------------------
// Contact-block splitting
// ---------------------------------------------------------------------------

interface ContactBlock {
  name: string;
  company: string;
  phone: string;
  iec: string;
  country: string;
}

/**
 * Splits a freeform multi-line cell like:
 *   "Evgeniy Tserenkov\nEvromarket, Russia\nMobile: 79149140053"
 * or:
 *   "B. Ioannis Shylla\nDamad Fruit Wine LLP\nMobile: 9856084579\nIEC: AINPW1959P\nUdyam Aadhar: UDYAM-ML-09-0000596"
 * into individual fields. Best-effort — always review the mapped preview
 * before importing.
 */
function splitContactBlock(raw: string): ContactBlock {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let phone = '';
  let iec = '';
  const rest: string[] = [];

  for (const line of lines) {
    const mobileMatch = line.match(/^mobile\s*:?\s*(.+)$/i);
    const iecMatch = line.match(/^iec\s*:?\s*(.*)$/i);
    const udyamMatch = line.match(/^udyam\s*(aadhar)?\s*:?/i);
    if (mobileMatch) { phone = mobileMatch[1].trim(); continue; }
    if (iecMatch) { iec = iecMatch[1].trim(); continue; }
    if (udyamMatch) continue; // captured in the raw block but no dedicated field to store it in
    rest.push(line);
  }

  // Fallback: a bare phone-looking line with no "Mobile:" label.
  if (!phone) {
    const phoneLine = rest.find((l) => /^\+?\d[\d\s-]{7,}$/.test(l));
    if (phoneLine) phone = phoneLine;
  }

  const name = rest[0] ?? '';
  const companyLine = rest.find((l, i) => i > 0 && !/^\+?\d[\d\s-]{7,}$/.test(l)) ?? '';
  let company = companyLine;
  let country = '';
  if (companyLine.includes(',')) {
    const idx = companyLine.lastIndexOf(',');
    company = companyLine.slice(0, idx).trim();
    country = companyLine.slice(idx + 1).trim();
  }

  return { name, company, phone, iec, country };
}

// ---------------------------------------------------------------------------
// Row -> Activity
// ---------------------------------------------------------------------------

export interface EventBatchDefaults {
  regionalOffice: string;
  bsmName: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  eventType: EventType;
}

export interface ImportedRow {
  rowNumber: number; // 1-based, matches spreadsheet row (excluding header)
  activity: Activity;
  errors: FieldError[];
  duplicate: boolean;
  include: boolean;
}

/** Placeholder used for text fields the source file had no data for — the row is still imported rather than dropped or left blank. */
export const NA = 'N/A';

function parseNumeric(value: string): number | undefined {
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = parseFloat(match[0]);
  return isNaN(n) ? undefined : n;
}

/** Text field with no value found in the source file → 'N/A' instead of leaving it blank/omitting the row. */
function withNA(value: string): string {
  return value.trim() !== '' ? value : NA;
}

function parseBoolish(value: string): boolean {
  const v = value.trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'signed', 'placed', 'secured', 'done'].includes(v);
}

function collect(row: Record<string, string>, headers: string[], target: TargetKey, mapping: ColumnMapping, concatenable: boolean): string {
  const cols = headers.filter((h) => mapping[h] === target);
  const values = cols.map((h) => ({ h, v: row[h]?.trim() ?? '' })).filter((x) => x.v !== '');
  if (values.length === 0) return '';
  if (!concatenable || values.length === 1) return values[values.length - 1].v;
  return values.map((x) => `${x.h}: ${x.v}`).join('\n');
}

export function buildImportedRows(
  sheetRows: SheetRows,
  mapping: ColumnMapping,
  eventDefaults: EventBatchDefaults,
  createdBy: string,
  createdByName: string,
  createdByRole: 'admin' | 'regional',
  existingActivities: Activity[],
): ImportedRow[] {
  const { headers, rows } = sheetRows;
  const nowIso = new Date().toISOString();
  const results: ImportedRow[] = [];
  const importedSoFar: Activity[] = [];

  rows.forEach((row, idx) => {
    const exporterFromBlock = collect(row, headers, 'composite.sellerBlock', mapping, false);
    const buyerFromBlock = collect(row, headers, 'composite.buyerBlock', mapping, false);
    const sellerParsed = exporterFromBlock ? splitContactBlock(exporterFromBlock) : null;
    const buyerParsed = buyerFromBlock ? splitContactBlock(buyerFromBlock) : null;

    const exporterName = collect(row, headers, 'exporter.exporterName', mapping, false) || sellerParsed?.name || '';
    const companyName = collect(row, headers, 'exporter.companyName', mapping, false) || sellerParsed?.company || '';
    const iecNumber = collect(row, headers, 'exporter.iecNumber', mapping, false) || sellerParsed?.iec || '';
    const exporterPhone = collect(row, headers, 'exporter.phone', mapping, false) || sellerParsed?.phone || '';

    const buyerName = collect(row, headers, 'buyer.buyerName', mapping, false) || buyerParsed?.name || '';
    const buyerCompany = collect(row, headers, 'buyer.company', mapping, false) || buyerParsed?.company || '';
    const buyerCountry = collect(row, headers, 'buyer.country', mapping, false) || buyerParsed?.country || '';
    const buyerPhone = collect(row, headers, 'buyer.phone', mapping, false) || buyerParsed?.phone || '';

    // Numeric fields the file has no value for become 0 rather than being
    // left undefined — the record is still imported instead of stalling on
    // a "missing value" validation error.
    const mouExpectedValueRaw = collect(row, headers, 'mou.expectedValue', mapping, false);
    const mouExpectedValue = parseNumeric(mouExpectedValueRaw) ?? 0;
    const mouSignedRaw = collect(row, headers, 'mou.signed', mapping, false);
    const mouSigned = mouSignedRaw ? parseBoolish(mouSignedRaw) : mouExpectedValue > 0;

    const orderValueRaw = collect(row, headers, 'orderPlaced.finalValue', mapping, false);
    const orderFinalValue = parseNumeric(orderValueRaw) ?? 0;
    const orderPlacedRaw = collect(row, headers, 'orderPlaced.placed', mapping, false);
    const orderPlaced = orderPlacedRaw ? parseBoolish(orderPlacedRaw) : orderFinalValue > 0;

    const status: Activity['status'] = orderPlaced ? 'Completed' : mouSigned ? 'In Process' : 'Draft';

    const activity: Activity = {
      id: nextActivityId(),
      event: {
        regionalOffice: eventDefaults.regionalOffice,
        bsmName: eventDefaults.bsmName,
        eventDate: eventDefaults.eventDate,
        venue: eventDefaults.venue,
        city: eventDefaults.city,
        state: eventDefaults.state,
        country: eventDefaults.country,
        eventType: eventDefaults.eventType,
        exporterCount: 0,
        buyerCount: 0,
      },
      exporter: {
        exporterName: withNA(exporterName),
        iecNumber: withNA(iecNumber),
        companyName: withNA(companyName),
        productCategory: withNA(collect(row, headers, 'exporter.productCategory', mapping, false)),
        email: withNA(collect(row, headers, 'exporter.email', mapping, false)),
        phone: withNA(exporterPhone),
        website: withNA(collect(row, headers, 'exporter.website', mapping, false)),
        address: withNA(collect(row, headers, 'exporter.address', mapping, true)),
      },
      buyer: {
        buyerName: withNA(buyerName),
        company: withNA(buyerCompany),
        country: withNA(buyerCountry),
        city: '',
        email: '',
        phone: withNA(buyerPhone),
        interestedProducts: withNA(collect(row, headers, 'buyer.interestedProducts', mapping, true)),
        meetingCount: 1,
        passportNumber: withNA(collect(row, headers, 'buyer.passportNumber', mapping, false)),
      },
      mou: {
        signed: mouSigned,
        expectedValue: mouExpectedValue,
      },
      orderInProcess: { active: false },
      orderPlaced: {
        placed: orderPlaced,
        finalValue: orderFinalValue,
        purchaseOrderNumber: collect(row, headers, 'orderPlaced.purchaseOrderNumber', mapping, false) || undefined,
      },
      remarks: {
        general: withNA(collect(row, headers, 'remarks.general', mapping, true)),
        challenges: withNA(collect(row, headers, 'remarks.challenges', mapping, true)),
        successStory: withNA(collect(row, headers, 'remarks.successStory', mapping, true)),
        followUpRequired: false,
      },
      documents: [],
      status,
      createdBy,
      createdByName,
      createdByRole,
      createdByOffice: eventDefaults.regionalOffice,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const errors = validateActivity(activity);
    const duplicate = isDuplicateActivity(activity, [...existingActivities, ...importedSoFar]);
    if (errors.length === 0) importedSoFar.push(activity);

    results.push({ rowNumber: idx + 1, activity, errors, duplicate, include: errors.length === 0 });
  });

  return results;
}

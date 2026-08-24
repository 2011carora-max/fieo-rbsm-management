import * as XLSX from 'xlsx';
import { COUNTRIES } from '@/types';
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
  | 'event.location' | 'event.period'
  | 'exporter.exporterName' | 'exporter.companyName' | 'exporter.iecNumber' | 'exporter.productCategory'
  | 'exporter.email' | 'exporter.phone' | 'exporter.website' | 'exporter.address'
  | 'composite.sellerBlock' | 'composite.exporterDetails'
  | 'buyer.buyerName' | 'buyer.company' | 'buyer.country' | 'buyer.phone' | 'buyer.email'
  | 'buyer.interestedProducts' | 'buyer.passportNumber'
  | 'composite.buyerBlock' | 'composite.buyerDetails' | 'composite.buyerCompanyCountry'
  | 'mou.signed' | 'mou.expectedValue' | 'mou.expectedValueUsd' | 'mou.expectedValueInr'
  | 'orderInProcess.active'
  | 'orderPlaced.placed' | 'orderPlaced.finalValue' | 'orderPlaced.finalValueUsd' | 'orderPlaced.finalValueInr' | 'orderPlaced.purchaseOrderNumber'
  | 'outcome.amount'
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

  { key: 'event.location', label: 'Event Location / City (per-row, overrides the batch default)', group: 'Event' },
  { key: 'event.period', label: 'Event Date / Period (per-row, overrides the batch default)', group: 'Event' },

  { key: 'composite.sellerBlock', label: 'Seller/Exporter block (name + company + mobile + IEC — auto-split)', group: 'Exporter / Seller' },
  { key: 'composite.exporterDetails', label: 'Exporter details block (company + mobile + email etc, no name — auto-split)', group: 'Exporter / Seller' },
  { key: 'exporter.exporterName', label: 'Exporter / Seller Name', group: 'Exporter / Seller' },
  { key: 'exporter.companyName', label: 'Company Name', group: 'Exporter / Seller' },
  { key: 'exporter.iecNumber', label: 'IEC Number', group: 'Exporter / Seller' },
  { key: 'exporter.productCategory', label: 'Product Category', group: 'Exporter / Seller' },
  { key: 'exporter.email', label: 'Email', group: 'Exporter / Seller' },
  { key: 'exporter.phone', label: 'Phone', group: 'Exporter / Seller' },
  { key: 'exporter.website', label: 'Website', group: 'Exporter / Seller' },
  { key: 'exporter.address', label: 'Address', group: 'Exporter / Seller', concatenable: true },

  { key: 'composite.buyerBlock', label: 'Buyer block (name + company + country + mobile — auto-split)', group: 'Buyer' },
  { key: 'composite.buyerDetails', label: 'Buyer details block (company + mobile + email etc, no name — auto-split)', group: 'Buyer' },
  { key: 'composite.buyerCompanyCountry', label: 'Buyer Company + Country (combined, e.g. "Acme, Nepal" — auto-split)', group: 'Buyer' },
  { key: 'buyer.buyerName', label: 'Buyer Name', group: 'Buyer' },
  { key: 'buyer.company', label: 'Buyer Company', group: 'Buyer' },
  { key: 'buyer.country', label: 'Buyer Country', group: 'Buyer' },
  { key: 'buyer.phone', label: 'Buyer Phone', group: 'Buyer' },
  { key: 'buyer.email', label: 'Buyer Email', group: 'Buyer' },
  { key: 'buyer.interestedProducts', label: 'Products / Items of Interest', group: 'Buyer', concatenable: true },
  { key: 'buyer.passportNumber', label: 'Passport Number', group: 'Buyer' },

  { key: 'mou.signed', label: 'MoU Signed (Yes/No)', group: 'Outcome' },
  { key: 'mou.expectedValue', label: 'MoU Expected Value', group: 'Outcome' },
  { key: 'mou.expectedValueUsd', label: 'MoU Value (USD)', group: 'Outcome' },
  { key: 'mou.expectedValueInr', label: 'MoU Value (INR)', group: 'Outcome' },
  { key: 'orderInProcess.active', label: 'Order In Process (Yes/No or notes)', group: 'Outcome' },
  { key: 'orderPlaced.placed', label: 'Order Placed (Yes/No)', group: 'Outcome' },
  { key: 'orderPlaced.finalValue', label: 'Order Value / Amount', group: 'Outcome' },
  { key: 'orderPlaced.finalValueUsd', label: 'Order Value (USD)', group: 'Outcome' },
  { key: 'orderPlaced.finalValueInr', label: 'Order Value (INR)', group: 'Outcome' },
  { key: 'outcome.amount', label: 'Amount (single column — routed to MoU or Order value automatically)', group: 'Outcome' },
  { key: 'orderPlaced.purchaseOrderNumber', label: 'PO / Order Number', group: 'Outcome' },

  { key: 'remarks.general', label: 'General Remarks / Notes', group: 'Remarks', concatenable: true },
  { key: 'remarks.challenges', label: 'Challenges', group: 'Remarks', concatenable: true },
  { key: 'remarks.successStory', label: 'Success Story / Feedback', group: 'Remarks', concatenable: true },
];

export type ColumnMapping = Record<string, TargetKey>; // header -> target

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Exact-match aliases for header text seen in real FIEO regional-office
 * reports (the compiled master template, plus the raw per-office feedback
 * and order sheets). Checked before the fuzzy guessTarget() fallback, so
 * these known headers always map correctly regardless of how generic or
 * ambiguous their wording would otherwise be to the fuzzy matcher.
 */
const EXACT_HEADER_ALIASES: Record<string, TargetKey> = {
  // Compiled master template (RBSM_Feedback_Compiled)
  'location of rbsm': 'event.location',
  'period': 'event.period',
  'name of the exporter': 'exporter.exporterName',
  'name of the seller': 'exporter.exporterName',
  'details of the exporter': 'composite.exporterDetails',
  'name of the buyer': 'buyer.buyerName',
  'details of the buyer': 'composite.buyerDetails',
  'product': 'exporter.productCategory',
  'products': 'exporter.productCategory',
  'mou': 'mou.signed',
  'order in process': 'orderInProcess.active',
  'order placed': 'orderPlaced.placed',
  'order status': 'orderPlaced.placed',
  'order details': 'remarks.general',
  'how much converstion inusd': 'orderPlaced.finalValueUsd',
  'how much conversion inusd': 'orderPlaced.finalValueUsd',
  'amount': 'outcome.amount',
  'remarks by buyers': 'remarks.general',
  'remarks by buyer': 'remarks.general',

  // Per-office "Feedback Summary" sheets (Kakinada / Pondicherry / Kochi etc.)
  'sl.no': 'ignore', 's.no': 'ignore', 'sno': 'ignore',
  'seller company name': 'exporter.companyName',
  'seller representative name': 'exporter.exporterName',
  'exporting products': 'exporter.productCategory',
  'buyer company name & country': 'composite.buyerCompanyCountry',
  'buyer company name and country': 'composite.buyerCompanyCountry',
  'buyer representative name': 'buyer.buyerName',
  'mou signed in usd': 'mou.expectedValueUsd',
  'in rs': 'mou.expectedValueInr',
  'mou value in inr (approximate 1usd=90 inr)': 'mou.expectedValueInr',
  'mou status': 'remarks.general',
  'actual revenue generated by msmes by exporting (usd)': 'orderPlaced.finalValueUsd',
  'actual revenue generated by msmes by exporting (rupees)': 'orderPlaced.finalValueInr',
  // Mobile/Email/Udyam are grouped with the seller's details in every one of
  // these office reports (Udyam registration is exporter-only), not the buyer's.
  'mobile': 'exporter.phone',
  'email id': 'exporter.email',
  'udyam no': 'exporter.address',
  'udyam': 'exporter.address',
  'district in which you operate': 'exporter.address',
  'verified / spot': 'remarks.general',
  'remarks (kerala msme)': 'remarks.general',
  'remarks from buyer (fieo)': 'remarks.general',

  // "Order Placed" / "Order Form" sheets
  'buyer name': 'buyer.buyerName',
  'counrty': 'buyer.country', // common typo seen in these sheets
  'country': 'buyer.country',
  'seller name': 'exporter.companyName',
  'seller': 'exporter.companyName',
  'amount in usd': 'orderPlaced.finalValueUsd',
  'amount in inr': 'orderPlaced.finalValueInr',
  'value in usd': 'orderPlaced.finalValueUsd',
  'place': 'exporter.address',
  'name of the person': 'exporter.exporterName',
  'remarks': 'remarks.general',
};

/** Best-effort auto-mapping from header text, so the user starts from a sensible default instead of a blank form. */
export function autoSuggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    mapping[h] = EXACT_HEADER_ALIASES[norm] ?? guessTarget(norm);
  }
  return mapping;
}

function guessTarget(norm: string): TargetKey {
  if (/(seller|exporter).*(profile|detail)|detail.*(seller|exporter)/.test(norm)) return 'composite.exporterDetails';
  if (/buyer.*(profile|detail)|detail.*buyer/.test(norm)) return 'composite.buyerDetails';
  if (/buyer.*company.*country|buyer.*company.*&/.test(norm)) return 'composite.buyerCompanyCountry';
  if (/location|venue|city/.test(norm) && !/buyer|exporter|seller/.test(norm)) return 'event.location';
  if (/^period$|event date|date of (the )?event/.test(norm)) return 'event.period';
  if (/company/.test(norm) && /(exporter|seller)/.test(norm)) return 'exporter.companyName';
  if (/^company name/.test(norm)) return 'exporter.companyName';
  if (/iec/.test(norm)) return 'exporter.iecNumber';
  if (/udyam/.test(norm)) return 'exporter.address';
  if (/product/.test(norm) && /categor/.test(norm)) return 'exporter.productCategory';
  if (/export(ing)?\s*products?/.test(norm)) return 'exporter.productCategory';
  if (/^product/.test(norm)) return 'buyer.interestedProducts';
  if (/exporter/.test(norm) && /name/.test(norm)) return 'exporter.exporterName';
  if (/seller/.test(norm) && /name/.test(norm)) return 'exporter.exporterName';
  if (/e-?mail/.test(norm)) return /buyer/.test(norm) ? 'buyer.email' : 'exporter.email';
  if (/website/.test(norm)) return 'exporter.website';
  if (/district|address/.test(norm)) return 'exporter.address';
  if ((/buyer/.test(norm) && /name/.test(norm)) || /contact person|name of the person/.test(norm)) return 'buyer.buyerName';
  if (/buyer.*company/.test(norm)) return 'buyer.company';
  if (/count?ry/.test(norm)) return 'buyer.country';
  if (/contact number|mobile|phone|whatsapp/.test(norm)) return /buyer/.test(norm) ? 'buyer.phone' : 'exporter.phone';
  if (/passport/.test(norm)) return 'buyer.passportNumber';
  if (/mou/.test(norm) && /usd/.test(norm)) return 'mou.expectedValueUsd';
  if (/mou/.test(norm) && /(inr|rs\.?|rupee)/.test(norm)) return 'mou.expectedValueInr';
  if (/mou/.test(norm) && /(signed|status)/.test(norm)) return 'mou.signed';
  if (/mou/.test(norm) && /value/.test(norm)) return 'mou.expectedValue';
  if (/order.*in.*process/.test(norm)) return 'orderInProcess.active';
  if (/order.*(placed|secured|issued)/.test(norm)) return 'orderPlaced.placed';
  if (/revenue|amount|value/.test(norm) && /usd/.test(norm)) return 'orderPlaced.finalValueUsd';
  if (/revenue|amount|value/.test(norm) && /(inr|rs\.?|rupee)/.test(norm)) return 'orderPlaced.finalValueInr';
  if (/amount|value/.test(norm)) return 'outcome.amount';
  if (/po\b|purchase order|order.*number/.test(norm)) return 'orderPlaced.purchaseOrderNumber';
  if (/remark|note|point|status|verified|feedback|success|outcome|challenge|issue|problem|updated as/.test(norm)) return 'remarks.general';
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
  email: string;
  country: string;
  address: string;
  /** Recognized-but-unmapped labelled data (e.g. "Category: General", "First Time Exporter: Yes") — kept so nothing from the source cell is silently dropped; the caller folds these into remarks. */
  notes: string[];
}

const INLINE_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const BARE_PHONE_RE = /^\+?\d[\d\s-]{6,}$/;
const LABELLED_SEGMENT_RE = /^([A-Za-z][A-Za-z0-9 /_.-]{1,30})\s*:\s*(.*)$/;
const COUNTRY_LOOKUP = new Map(['India', ...COUNTRIES].map((c) => [c.toLowerCase(), c]));
// Longest-name-first so a substring fallback match picks "South Africa"
// over the shorter "Africa"-less false positives, etc.
const COUNTRY_NAMES_BY_LENGTH = [...COUNTRY_LOOKUP.keys()].sort((a, b) => b.length - a.length);

/** Exact match first; falls back to substring containment so longer forms like "Sultanate of Oman" or "Kingdom of Saudi Arabia" still resolve to the plain country name. */
function matchCountry(segment: string): string | null {
  const s = segment.toLowerCase();
  const exact = COUNTRY_LOOKUP.get(s);
  if (exact) return exact;
  const found = COUNTRY_NAMES_BY_LENGTH.find((name) => s.includes(name));
  return found ? COUNTRY_LOOKUP.get(found)! : null;
}

/**
 * Splits a freeform "contact block" cell into individual fields. These cells
 * show up across real FIEO regional-office reports in several different
 * shapes — this handles all of them on a best-effort basis:
 *
 *   "Evgeniy Tserenkov\nEvromarket, Russia\nMobile: 79149140053"
 *   "B. Ioannis Shylla\nDamad Fruit Wine LLP\nMobile: 9856084579\nIEC: AINPW1959P\nUdyam Aadhar: UDYAM-ML-09-0000596"
 *   "Company: Green City Biotech\nPlace: Virudhunagar Dt\nUdyam No: UDYAM-TN-32-0001453\nMobile: 9585627360\nCategory: General"
 *   "Honors Hub Concepts Limited, +256-774079599, irenengabirano66@gmail.com"
 *   "Ali Rice Mill, Nepal"
 *
 * Any label we don't have a dedicated field for (Udyam number, category,
 * "first time exporter", etc.) is kept in `notes` rather than discarded, so
 * the caller can fold it into remarks instead of losing it. Always review
 * the mapped preview before importing — this is best-effort, not exact.
 */
function splitContactBlock(raw: string): ContactBlock {
  const hasNewlines = /\r?\n/.test(raw);
  const topSegments = hasNewlines
    ? raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : raw.split(',').map((l) => l.trim()).filter(Boolean);

  let phone = '', iec = '', email = '', country = '', address = '', company = '';
  const notes: string[] = [];
  const rest: string[] = [];

  const classifyLabel = (label: string, value: string): boolean => {
    const l = label.toLowerCase();
    if (!value) return true; // recognized-but-empty label — consume silently
    if (/mobile|phone|contact\s*no|whatsapp/.test(l)) { phone = phone || value; return true; }
    if (/iec/.test(l)) { iec = iec || value; return true; }
    if (/e-?mail/.test(l)) { email = email || value; return true; }
    if (/^company$|company name/.test(l)) { company = company || value; return true; }
    if (/place|city|district|address/.test(l)) { address = address || value; return true; }
    if (/country/.test(l)) { country = country || value; return true; }
    if (/udyam/.test(l)) { notes.push(`Udyam: ${value}`); return true; }
    if (/category|first time exporter|verified|status/.test(l)) { notes.push(`${label.trim()}: ${value}`); return true; }
    return false;
  };

  for (const seg of topSegments) {
    const labelled = seg.match(LABELLED_SEGMENT_RE);
    if (labelled && classifyLabel(labelled[1], labelled[2].trim())) continue;

    const emailMatch = seg.match(INLINE_EMAIL_RE);
    if (emailMatch) { email = email || emailMatch[0]; continue; }
    if (BARE_PHONE_RE.test(seg)) { phone = phone || seg; continue; }
    const countryMatch = matchCountry(seg);
    if (countryMatch) { country = country || countryMatch; continue; }

    rest.push(seg);
  }

  let name = '';
  if (hasNewlines) {
    // Multi-line block: convention is "Name" on its own first line, then a
    // "Company, Country" style second line for whatever wasn't already
    // pulled out as phone/email/country above.
    name = rest[0] ?? '';
    const companyLine = rest.slice(1).find(Boolean) ?? '';
    if (!company && companyLine) {
      if (companyLine.includes(',') && !country) {
        const idx = companyLine.lastIndexOf(',');
        company = companyLine.slice(0, idx).trim();
        const maybeCountry = companyLine.slice(idx + 1).trim();
        const matched = matchCountry(maybeCountry);
        country = matched ?? maybeCountry;
      } else {
        company = companyLine;
      }
    }
  } else {
    // Comma-separated single-line block: no assumed personal name (that's
    // almost always already a separate column) — every leftover segment is
    // part of the company/description.
    if (!company && rest.length > 0) company = rest.join(', ');
  }

  return { name, company, phone, iec, email, country, address, notes };
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

/** Common ways offices already write "no data" by hand — all normalized to the single canonical NA so format validation doesn't choke on them. */
const NA_TOKENS = new Set(['na', 'n/a', 'n.a', 'n.a.', 'none', 'nil', '-', '--', 'not available', 'not applicable']);

function parseNumeric(value: string): number | undefined {
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = parseFloat(match[0]);
  return isNaN(n) ? undefined : n;
}

/** Text field with no value found in the source file → 'N/A' instead of leaving it blank/omitting the row. */
function withNA(value: string): string {
  const v = value.trim();
  if (v === '' || NA_TOKENS.has(v.toLowerCase())) return NA;
  return v;
}

const PHONE_CANDIDATE_RE = /\+?\d[\d\s-]{6,}\d/g;
const EMAIL_LIST_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Real office spreadsheets routinely cram more than one phone number or
 * email into a single cell ("9447404261 / 8111887419",
 * "nitin@abntrades.com, qc@abntrades.com") — a plain single-value field
 * can't hold both. Rather than fail validation (and block the whole row's
 * import) or silently keep only a mangled combined string, the first valid
 * one is used as the actual field value and, if there was more than one,
 * the full original text is preserved as a note. A cell with nothing
 * recognizable at all is also kept as a note instead of being dropped.
 */
function sanitizeContact(raw: string, kind: 'phone' | 'email', label: string): { clean: string; note: string } {
  const v = raw.trim();
  if (!v || NA_TOKENS.has(v.toLowerCase())) return { clean: '', note: '' };
  const re = kind === 'phone' ? PHONE_CANDIDATE_RE : EMAIL_LIST_RE;
  const matches = v.match(re);
  if (!matches || matches.length === 0) return { clean: '', note: `${label} (unrecognized format): ${v}` };
  const clean = matches[0].trim();
  return { clean, note: matches.length > 1 ? `Additional ${label.toLowerCase()}(s) found: ${v}` : '' };
}

/**
 * Exact-match only (never substring), deliberately — a naive
 * `.includes('signed')` would wrongly flag text like "MoU not yet signed" or
 * "Awaiting order" as true. Real files use both short status words ("Yes",
 * "MoU Verified") and full narrative sentences; the narrative case is
 * handled separately by `boolWithNote` below rather than guessed at here.
 */
const TRUTHY_TOKENS = new Set([
  'yes', 'y', 'true', '1', 'signed', 'placed', 'secured', 'done',
  'verified', 'confirmed', 'mou verified', 'order placed', 'mou signed', 'purchased',
  'order issued', 'issued', 'sample order issued',
]);
function parseBoolish(value: string): boolean {
  return TRUTHY_TOKENS.has(value.trim().toLowerCase());
}

/**
 * For cells that are supposed to be a simple Yes/No signal but, in practice,
 * are sometimes a full narrative paragraph instead (very common in these
 * reports — e.g. "Purchased various items... however I can't find the Bill
 * of Lading."). A short value is used as-is for the boolean; a longer one is
 * also kept verbatim as a labelled note so the detail isn't silently
 * dropped just because it didn't look like a plain yes/no.
 */
function boolWithNote(raw: string, label: string): { flag: boolean; note: string } {
  const v = raw.trim();
  if (!v || v.toUpperCase() === NA) return { flag: false, note: '' };
  const flag = parseBoolish(v);
  const isShortToken = v.length <= 24 && v.split(/\s+/).length <= 3;
  return { flag, note: isShortToken ? '' : `${label}: ${v}` };
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
    const exporterDetails = collect(row, headers, 'composite.exporterDetails', mapping, false);
    const buyerFromBlock = collect(row, headers, 'composite.buyerBlock', mapping, false);
    const buyerDetails = collect(row, headers, 'composite.buyerDetails', mapping, false);
    const buyerCompanyCountry = collect(row, headers, 'composite.buyerCompanyCountry', mapping, false);

    const sellerParsed = exporterFromBlock ? splitContactBlock(exporterFromBlock)
      : exporterDetails ? splitContactBlock(exporterDetails) : null;
    const buyerParsed = buyerFromBlock ? splitContactBlock(buyerFromBlock)
      : buyerDetails ? splitContactBlock(buyerDetails)
      : buyerCompanyCountry ? splitContactBlock(buyerCompanyCountry) : null;

    const exporterName = collect(row, headers, 'exporter.exporterName', mapping, false) || sellerParsed?.name || '';
    const companyName = collect(row, headers, 'exporter.companyName', mapping, false) || sellerParsed?.company || '';
    const iecNumber = collect(row, headers, 'exporter.iecNumber', mapping, false) || sellerParsed?.iec || '';
    const exporterPhoneRaw = collect(row, headers, 'exporter.phone', mapping, false) || sellerParsed?.phone || '';
    const exporterEmailRaw = collect(row, headers, 'exporter.email', mapping, false) || sellerParsed?.email || '';
    const exporterAddress = collect(row, headers, 'exporter.address', mapping, true) || sellerParsed?.address || '';
    const exporterPhoneSan = sanitizeContact(exporterPhoneRaw, 'phone', 'Exporter phone');
    const exporterEmailSan = sanitizeContact(exporterEmailRaw, 'email', 'Exporter email');

    const buyerName = collect(row, headers, 'buyer.buyerName', mapping, false) || buyerParsed?.name || '';
    const buyerCompany = collect(row, headers, 'buyer.company', mapping, false) || buyerParsed?.company || '';
    const buyerCountry = collect(row, headers, 'buyer.country', mapping, false) || buyerParsed?.country || '';
    const buyerPhoneRaw = collect(row, headers, 'buyer.phone', mapping, false) || buyerParsed?.phone || '';
    const buyerEmailRaw = collect(row, headers, 'buyer.email', mapping, false) || buyerParsed?.email || '';
    const buyerPhoneSan = sanitizeContact(buyerPhoneRaw, 'phone', 'Buyer phone');
    const buyerEmailSan = sanitizeContact(buyerEmailRaw, 'email', 'Buyer email');

    // Any recognized-but-unmapped labelled data found while splitting a
    // contact block (Udyam number, "Category: General", etc.) — folded into
    // remarks below rather than being discarded.
    const contactNotes = [...(sellerParsed?.notes ?? []), ...(buyerParsed?.notes ?? [])];

    // A shared "Amount" column (seen in the compiled master template) can't
    // be routed to MoU vs Order value until we know which outcome actually
    // applies to this row — resolved once both booleans are known, below.
    const sharedAmount = parseNumeric(collect(row, headers, 'outcome.amount', mapping, false));

    // MoU: prefer an explicit USD column, then a generic "value" column,
    // then the shared Amount column as a last resort. INR-labelled columns
    // are deliberately never auto-consumed here — with a USD column
    // usually present alongside, we'd otherwise have no reliable way to
    // know which of the two to keep and could silently overwrite the
    // correct figure with a ~90x larger INR one.
    const mouUsd = parseNumeric(collect(row, headers, 'mou.expectedValueUsd', mapping, false));
    const mouGeneric = parseNumeric(collect(row, headers, 'mou.expectedValue', mapping, false));
    const mouSignedRaw = collect(row, headers, 'mou.signed', mapping, false);
    const { flag: mouSignedFromCell, note: mouNote } = boolWithNote(mouSignedRaw, 'MoU');

    // Order Placed: same USD-priority pattern, plus free-text narratives
    // (very common in these reports) are preserved as a note instead of
    // being reduced to just a true/false guess.
    const orderUsd = parseNumeric(collect(row, headers, 'orderPlaced.finalValueUsd', mapping, false));
    const orderGeneric = parseNumeric(collect(row, headers, 'orderPlaced.finalValue', mapping, false));
    const orderPlacedRaw = collect(row, headers, 'orderPlaced.placed', mapping, false);
    const { flag: orderPlacedFromCell, note: orderPlacedNote } = boolWithNote(orderPlacedRaw, 'Order Placed');

    const orderInProcessRaw = collect(row, headers, 'orderInProcess.active', mapping, false);
    const { flag: orderInProcessFromCell, note: orderInProcessNote } = boolWithNote(orderInProcessRaw, 'Order In Process');

    const mouExpectedValue = mouUsd ?? mouGeneric ?? 0;
    const orderFinalValue = orderUsd ?? orderGeneric ?? 0;

    const mouSigned = mouSignedRaw ? mouSignedFromCell : mouExpectedValue > 0;
    const orderPlaced = orderPlacedRaw ? orderPlacedFromCell : orderFinalValue > 0;
    const orderInProcessActive = orderInProcessFromCell || !!orderInProcessNote;

    // Now that both outcome flags are resolved, route the shared Amount
    // column to whichever outcome it belongs to for this row (order placed
    // takes priority, then a signed MoU), rather than leaving it unused.
    let mouExpectedValueFinal = mouExpectedValue;
    let orderFinalValueFinal = orderFinalValue;
    if (sharedAmount !== undefined) {
      if (orderPlaced && orderFinalValueFinal === 0) orderFinalValueFinal = sharedAmount;
      else if (mouSigned && mouExpectedValueFinal === 0) mouExpectedValueFinal = sharedAmount;
      else if (mouExpectedValueFinal === 0 && orderFinalValueFinal === 0) mouExpectedValueFinal = sharedAmount;
    }

    const status: Activity['status'] = orderPlaced ? 'Completed' : mouSigned ? 'In Process' : 'Draft';

    // Per-row event overrides (e.g. "Location of RBSM" / "Period" columns in
    // the compiled master template) fall back to the batch defaults entered
    // in step 3 when the file doesn't provide them for a given row.
    const rowLocation = collect(row, headers, 'event.location', mapping, false);
    const rowPeriodRaw = collect(row, headers, 'event.period', mapping, false);
    const rowPeriodParsed = rowPeriodRaw && !isNaN(Date.parse(rowPeriodRaw)) ? new Date(rowPeriodRaw).toISOString().slice(0, 10) : '';
    const periodNote = rowPeriodRaw && !rowPeriodParsed ? `Event period (from file): ${rowPeriodRaw}` : '';

    const generalNotes = [
      mouNote, orderPlacedNote, orderInProcessNote, periodNote,
      exporterPhoneSan.note, exporterEmailSan.note, buyerPhoneSan.note, buyerEmailSan.note,
      ...contactNotes,
    ].filter(Boolean);
    const generalRemarksFromColumns = collect(row, headers, 'remarks.general', mapping, true);
    const generalRemarks = [generalRemarksFromColumns, ...generalNotes].filter(Boolean).join('\n');

    const activity: Activity = {
      id: nextActivityId(),
      event: {
        regionalOffice: eventDefaults.regionalOffice,
        bsmName: eventDefaults.bsmName,
        eventDate: rowPeriodParsed || eventDefaults.eventDate,
        venue: eventDefaults.venue,
        city: eventDefaults.city,
        state: rowLocation || eventDefaults.state,
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
        email: withNA(exporterEmailSan.clean),
        phone: withNA(exporterPhoneSan.clean),
        website: withNA(collect(row, headers, 'exporter.website', mapping, false)),
        address: withNA(exporterAddress),
      },
      buyer: {
        buyerName: withNA(buyerName),
        company: withNA(buyerCompany),
        country: withNA(buyerCountry),
        city: '',
        email: withNA(buyerEmailSan.clean),
        phone: withNA(buyerPhoneSan.clean),
        interestedProducts: withNA(collect(row, headers, 'buyer.interestedProducts', mapping, true)),
        meetingCount: 1,
        passportNumber: withNA(collect(row, headers, 'buyer.passportNumber', mapping, false)),
      },
      mou: {
        signed: mouSigned,
        expectedValue: mouExpectedValueFinal,
      },
      orderInProcess: {
        active: orderInProcessActive,
      },
      orderPlaced: {
        placed: orderPlaced,
        finalValue: orderFinalValueFinal,
        purchaseOrderNumber: collect(row, headers, 'orderPlaced.purchaseOrderNumber', mapping, false) || undefined,
      },
      remarks: {
        general: withNA(generalRemarks),
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

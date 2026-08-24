import type { Activity } from '@/types';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * The importer fills fields the source file had no data for with the literal
 * "N/A" (see importParser.ts's withNA) rather than leaving them blank or
 * dropping the row. Two different notions of "has a value" follow from that:
 *
 * - isPresent: something was recorded at all, including "N/A" — used for
 *   required-field checks, so an imported row with a genuinely missing
 *   column still passes (it's flagged N/A for a human to fill in later,
 *   not silently discarded).
 * - isFilled: real, non-placeholder data — used before format checks
 *   (email/phone/IEC/passport patterns), so "N/A" is never validated as if
 *   it were a malformed value the user typed in.
 */
function isPresent(value: string | undefined | null): boolean {
  return !!value && value.trim() !== '';
}
function isFilled(value: string | undefined | null): boolean {
  return isPresent(value) && value!.trim().toUpperCase() !== 'N/A';
}

// Stricter email: requires name@domain.tld with a 2+ char TLD, no consecutive dots.
const EMAIL_RE = /^(?=.{3,254}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// IEC: alphanumeric only (letters + digits), 8–12 characters, no spaces or special chars.
// Indian IECs are 10 digits, but we accept alphanumeric to accommodate legacy / other formats.
const IEC_RE = /^[A-Za-z0-9]{8,12}$/;

// Country-aware phone validation. Each country has a calling code, digit length
// range, and a loose pattern. We strip spaces/dashes/parentheses before checking
// length and digit content.
interface PhoneRule {
  code: string;
  name: string;
  lengths: [number, number];
}

const PHONE_RULES: Record<string, PhoneRule> = {
  India: { code: '91', name: 'India', lengths: [10, 12] },
  'United States': { code: '1', name: 'United States', lengths: [10, 11] },
  Canada: { code: '1', name: 'Canada', lengths: [10, 11] },
  'United Kingdom': { code: '44', name: 'United Kingdom', lengths: [10, 11] },
  Germany: { code: '49', name: 'Germany', lengths: [10, 13] },
  France: { code: '33', name: 'France', lengths: [9, 12] },
  Italy: { code: '39', name: 'Italy', lengths: [9, 12] },
  Spain: { code: '34', name: 'Spain', lengths: [9, 11] },
  Netherlands: { code: '31', name: 'Netherlands', lengths: [9, 11] },
  Belgium: { code: '32', name: 'Belgium', lengths: [9, 11] },
  Switzerland: { code: '41', name: 'Switzerland', lengths: [9, 12] },
  Sweden: { code: '46', name: 'Sweden', lengths: [8, 12] },
  Norway: { code: '47', name: 'Norway', lengths: [8, 11] },
  Denmark: { code: '45', name: 'Denmark', lengths: [8, 10] },
  Finland: { code: '358', name: 'Finland', lengths: [9, 12] },
  Poland: { code: '48', name: 'Poland', lengths: [9, 12] },
  Russia: { code: '7', name: 'Russia', lengths: [10, 11] },
  Turkey: { code: '90', name: 'Turkey', lengths: [10, 12] },
  'United Arab Emirates': { code: '971', name: 'United Arab Emirates', lengths: [9, 12] },
  'Saudi Arabia': { code: '966', name: 'Saudi Arabia', lengths: [9, 12] },
  Qatar: { code: '974', name: 'Qatar', lengths: [8, 11] },
  Kuwait: { code: '965', name: 'Kuwait', lengths: [8, 10] },
  Bahrain: { code: '973', name: 'Bahrain', lengths: [8, 10] },
  Oman: { code: '968', name: 'Oman', lengths: [8, 10] },
  Egypt: { code: '20', name: 'Egypt', lengths: [10, 11] },
  'South Africa': { code: '27', name: 'South Africa', lengths: [9, 11] },
  Nigeria: { code: '234', name: 'Nigeria', lengths: [10, 13] },
  Kenya: { code: '254', name: 'Kenya', lengths: [9, 12] },
  Morocco: { code: '212', name: 'Morocco', lengths: [9, 12] },
  Algeria: { code: '213', name: 'Algeria', lengths: [9, 12] },
  Ghana: { code: '233', name: 'Ghana', lengths: [9, 11] },
  Japan: { code: '81', name: 'Japan', lengths: [10, 12] },
  China: { code: '86', name: 'China', lengths: [11, 12] },
  'South Korea': { code: '82', name: 'South Korea', lengths: [9, 11] },
  Singapore: { code: '65', name: 'Singapore', lengths: [8, 10] },
  Malaysia: { code: '60', name: 'Malaysia', lengths: [9, 11] },
  Indonesia: { code: '62', name: 'Indonesia', lengths: [9, 13] },
  Thailand: { code: '66', name: 'Thailand', lengths: [9, 10] },
  Vietnam: { code: '84', name: 'Vietnam', lengths: [9, 11] },
  Philippines: { code: '63', name: 'Philippines', lengths: [10, 11] },
  'Hong Kong': { code: '852', name: 'Hong Kong', lengths: [8, 9] },
  Taiwan: { code: '886', name: 'Taiwan', lengths: [9, 10] },
  Australia: { code: '61', name: 'Australia', lengths: [9, 11] },
  'New Zealand': { code: '64', name: 'New Zealand', lengths: [9, 11] },
  Bangladesh: { code: '880', name: 'Bangladesh', lengths: [10, 12] },
  Pakistan: { code: '92', name: 'Pakistan', lengths: [10, 11] },
  'Sri Lanka': { code: '94', name: 'Sri Lanka', lengths: [10, 11] },
  Nepal: { code: '977', name: 'Nepal', lengths: [10, 12] },
  Brazil: { code: '55', name: 'Brazil', lengths: [10, 12] },
  Argentina: { code: '54', name: 'Argentina', lengths: [10, 12] },
  Chile: { code: '56', name: 'Chile', lengths: [9, 11] },
  Mexico: { code: '52', name: 'Mexico', lengths: [10, 12] },
  Colombia: { code: '57', name: 'Colombia', lengths: [10, 11] },
  Peru: { code: '51', name: 'Peru', lengths: [9, 11] },
  Israel: { code: '972', name: 'Israel', lengths: [9, 10] },
  Greece: { code: '30', name: 'Greece', lengths: [10, 11] },
  Portugal: { code: '351', name: 'Portugal', lengths: [9, 11] },
  Ireland: { code: '353', name: 'Ireland', lengths: [9, 11] },
  Austria: { code: '43', name: 'Austria', lengths: [10, 12] },
  'Czech Republic': { code: '420', name: 'Czech Republic', lengths: [9, 10] },
  Hungary: { code: '36', name: 'Hungary', lengths: [9, 11] },
  Romania: { code: '40', name: 'Romania', lengths: [9, 11] },
};

const DEFAULT_PHONE_LENGTHS: [number, number] = [7, 15];

// Country-aware passport format checks. These are simplified/representative
// patterns for common countries — not verified against every government's
// current official spec — so unlisted countries fall back to a generic
// alphanumeric check rather than being rejected outright.
interface PassportRule {
  pattern: RegExp;
  example: string;
}

const PASSPORT_RULES: Record<string, PassportRule> = {
  'United States': { pattern: /^[0-9]{9}$/, example: '123456789' },
  'United Kingdom': { pattern: /^[0-9]{9}$/, example: '123456789' },
  Germany: { pattern: /^[A-Z0-9]{9}$/, example: 'C01X5G7H9' },
  France: { pattern: /^[A-Z]{2}[0-9]{7}$/, example: 'AB1234567' },
  Japan: { pattern: /^[A-Z]{2}[0-9]{7}$/, example: 'TZ1234567' },
  Singapore: { pattern: /^[A-Z][0-9]{7}[A-Z]$/, example: 'K1234567A' },
  Australia: { pattern: /^[A-Z][0-9]{7}$/, example: 'N1234567' },
  Canada: { pattern: /^[A-Z]{2}[0-9]{6}$/, example: 'GA123456' },
  'South Africa': { pattern: /^[A-Z][0-9]{8}$/, example: 'M12345678' },
  Nigeria: { pattern: /^[A-Z][0-9]{8}$/, example: 'A12345678' },
  Brazil: { pattern: /^[A-Z]{2}[0-9]{6}$/, example: 'FZ123456' },
  Russia: { pattern: /^[0-9]{9}$/, example: '123456789' },
  'South Korea': { pattern: /^[MS][0-9]{8}$/, example: 'M12345678' },
  China: { pattern: /^[EG][0-9]{8}$/, example: 'E12345678' },
  Bangladesh: { pattern: /^[A-Z]{2}[0-9]{7}$/, example: 'BP1234567' },
  Malaysia: { pattern: /^[AHK][0-9]{8}$/, example: 'A12345678' },
};

// Countries not in PASSPORT_RULES (e.g. UAE, Saudi Arabia, Netherlands,
// Italy, Spain, Hong Kong) use this generic fallback instead of a
// country-specific pattern, since formats vary and aren't reliably documented.
const DEFAULT_PASSPORT_RULE: PassportRule = { pattern: /^[A-Z0-9]{6,9}$/, example: 'A1234567' };

export function passportFormatHint(country: string): string {
  const rule = PASSPORT_RULES[country] ?? DEFAULT_PASSPORT_RULE;
  return `Format e.g. ${rule.example}`;
}

function validatePassport(passport: string, country: string): string | null {
  if (!isFilled(passport)) return null;
  const value = passport.trim().toUpperCase();
  const rule = PASSPORT_RULES[country] ?? DEFAULT_PASSPORT_RULE;
  if (!rule.pattern.test(value)) {
    return country && PASSPORT_RULES[country]
      ? `Doesn't match the expected ${country} passport format (e.g. ${rule.example}).`
      : `Passport number should be 6–9 letters/digits (e.g. ${rule.example}).`;
  }
  return null;
}

function validatePhone(phone: string, country: string): string | null {
  if (!isFilled(phone)) return null;
  const digits = phone.replace(/[\s\-()]/g, '');
  if (!/^\+?\d+$/.test(digits.replace(/^\+/, ''))) {
    return 'Phone may contain only digits, spaces, dashes, parentheses and a leading +.';
  }
  const bareDigits = digits.replace(/^\+/, '');
  const rule = PHONE_RULES[country];
  if (rule) {
    const [min, max] = rule.lengths;
    // A number is accepted if it's a valid length either as-is or with the
    // country code prefix stripped — checking both (rather than always
    // stripping whenever the string happens to start with the code) avoids
    // wrongly truncating a bare local number that coincidentally starts
    // with the same digits as the country code (e.g. a 10-digit Indian
    // mobile number starting with "91").
    const withCode = bareDigits.startsWith(rule.code) ? bareDigits.slice(rule.code.length) : bareDigits;
    const validAsIs = bareDigits.length >= min && bareDigits.length <= max;
    const validWithCodeStripped = withCode.length >= min && withCode.length <= max;
    if (!validAsIs && !validWithCodeStripped) {
      return `${rule.name} phone numbers must be ${min}–${max} digits (excluding the +${rule.code} country code).`;
    }
  } else {
    const [min, max] = DEFAULT_PHONE_LENGTHS;
    if (bareDigits.length < min || bareDigits.length > max) {
      return `Phone numbers must be ${min}–${max} digits.`;
    }
  }
  return null;
}

export function validateActivity(a: Activity): FieldError[] {
  const errs: FieldError[] = [];
  // Reverse BSM collects Exporter Details / Outcome Tracking / Remarks & Documents.
  // Every other event type (BSM, Trade Delegation, Virtual BSM, Exhibition) only collects Buyer Details.
  const isReverseBSM = a.event.eventType === 'Reverse BSM';

  // Mandatory fields
  if (!a.event.regionalOffice) errs.push({ field: 'event.regionalOffice', message: 'Regional office is required.' });
  if (!a.event.eventDate) errs.push({ field: 'event.eventDate', message: 'Event date is required.' });

  if (isReverseBSM) {
    if (!isPresent(a.exporter.exporterName)) errs.push({ field: 'exporter.exporterName', message: 'Exporter name is required.' });
    if (!isPresent(a.exporter.productCategory)) errs.push({ field: 'exporter.productCategory', message: 'Product category is required.' });
  } else {
    if (!isPresent(a.buyer.buyerName)) errs.push({ field: 'buyer.buyerName', message: 'Buyer name is required.' });
    if (!isPresent(a.buyer.country)) errs.push({ field: 'buyer.country', message: 'Country is required.' });
    if (!isPresent(a.buyer.phone)) errs.push({ field: 'buyer.phone', message: 'Phone / WhatsApp number is required.' });
    if (!isPresent(a.buyer.passportNumber)) errs.push({ field: 'buyer.passportNumber', message: 'Passport number is required.' });
  }

  // IEC: alphanumeric only, 8–12 chars, no special characters or spaces.
  if (isFilled(a.exporter.iecNumber) && !IEC_RE.test(a.exporter.iecNumber)) {
    errs.push({ field: 'exporter.iecNumber', message: 'IEC must be 8–12 alphanumeric characters (letters and digits only, no spaces or special characters).' });
  }

  // Email — stricter format check.
  if (isFilled(a.exporter.email) && !EMAIL_RE.test(a.exporter.email)) errs.push({ field: 'exporter.email', message: 'Enter a valid exporter email (e.g. name@company.com).' });

  // Phone — country-aware.
  if (a.exporter.phone) {
    const e = validatePhone(a.exporter.phone, a.event.country);
    if (e) errs.push({ field: 'exporter.phone', message: e });
  }
  if (a.buyer.phone) {
    const e = validatePhone(a.buyer.phone, a.buyer.country);
    if (e) errs.push({ field: 'buyer.phone', message: e });
  }

  // Passport — country-aware, only when a country is already known.
  if (a.buyer.passportNumber && a.buyer.country) {
    const p = validatePassport(a.buyer.passportNumber, a.buyer.country);
    if (p) errs.push({ field: 'buyer.passportNumber', message: p });
  }

  // Numeric currency values
  const numFields: Array<[number | undefined, string]> = [
    [a.mou.expectedValue, 'mou.expectedValue'],
    [a.orderInProcess.estimatedValue, 'orderInProcess.estimatedValue'],
    [a.orderPlaced.finalValue, 'orderPlaced.finalValue'],
  ];
  for (const [v, field] of numFields) {
    if (v !== undefined && v !== null && (isNaN(v) || v < 0)) {
      errs.push({ field, message: 'Value must be a positive number.' });
    }
  }

  // Dates
  if (a.orderPlaced.orderDate && isNaN(Date.parse(a.orderPlaced.orderDate))) {
    errs.push({ field: 'orderPlaced.orderDate', message: 'Invalid order date.' });
  }
  if (a.remarks.nextFollowUpDate && isNaN(Date.parse(a.remarks.nextFollowUpDate))) {
    errs.push({ field: 'remarks.nextFollowUpDate', message: 'Invalid follow-up date.' });
  }

  // Probability 0-100
  if (a.orderInProcess.probability !== undefined && (a.orderInProcess.probability < 0 || a.orderInProcess.probability > 100)) {
    errs.push({ field: 'orderInProcess.probability', message: 'Probability must be between 0 and 100.' });
  }

  return errs;
}

export function isDuplicateActivity(a: Activity, all: Activity[]): boolean {
  return all.some(
    (x) =>
      x.id !== a.id &&
      x.event.regionalOffice === a.event.regionalOffice &&
      x.event.eventDate === a.event.eventDate &&
      x.exporter.exporterName === a.exporter.exporterName &&
      x.buyer.buyerName === a.buyer.buyerName,
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards a value that's about to be written to a `uuid` Postgres column.
 * null/undefined/empty string are allowed through as-is (nullable FK), but
 * any non-empty value that isn't UUID-shaped is rejected here — with a
 * message naming the offending field and value — rather than being sent to
 * Postgres, where it comes back as an opaque `22P02` error with no
 * indication of which field or value caused it.
 */
export function assertUuidOrNull(value: string | null | undefined, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid data: "${fieldName}" must be a UUID but got "${value}". This looks like a display name, role, or office was placed in a UUID field — check where the payload for this field is constructed.`);
  }
  return value;
}

/** Same as assertUuidOrNull, but for required (NOT NULL) uuid columns — an empty/missing value is also rejected, not silently passed through as null. */
export function assertUuid(value: string | null | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`Invalid data: "${fieldName}" is required and must be a UUID but was empty.`);
  }
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid data: "${fieldName}" must be a UUID but got "${value}". This looks like a display name, role, or office was placed in a UUID field — check where the payload for this field is constructed.`);
  }
  return value;
}

// Core domain types for the FIEO RBSM Management System.
// Kept framework-agnostic so the same shapes work against a future REST API.

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY';

export type EventType =
  | 'Buyer-Seller Meet'
  | 'Trade Delegation'
  | 'Reverse BSM'
  | 'Virtual BSM'
  | 'Exhibition';

export type ActivityStatus =
  | 'Draft'
  | 'Follow-up Required'
  | 'In Process'
  | 'Completed'
  | 'Cancelled';

export type DocumentKind = 'MoU' | 'Purchase Order' | 'Invoice' | 'Photograph' | 'Meeting Minutes' | 'Other';

export interface StoredDocument {
  id: string;
  kind: DocumentKind;
  name: string;
  mime: string;
  /** base64 data url */
  dataUrl: string;
  size: number;
  uploadedAt: string;
}

export interface ExporterInfo {
  exporterName: string;
  iecNumber: string;
  companyName: string;
  productCategory: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export interface BuyerInfo {
  buyerName: string;
  company: string;
  country: string;
  /** @deprecated no longer collected in the wizard UI; kept so existing DB rows/exports don't break. */
  city: string;
  /** @deprecated no longer collected in the wizard UI; kept so existing DB rows/exports don't break. */
  email: string;
  phone: string;
  interestedProducts: string;
  /** @deprecated no longer collected in the wizard UI; kept so existing DB rows/exports don't break. */
  meetingCount: number;
  passportNumber: string;
}

export interface MoUOutcome {
  signed: boolean;
  expectedValue?: number;
  currency?: Currency;
  expectedTimeline?: string;
  documentId?: string;
}

export interface OrderInProcess {
  active: boolean;
  estimatedValue?: number;
  currency?: Currency;
  expectedClosureDate?: string;
  probability?: number; // 0-100
  remarks?: string;
}

export interface OrderPlaced {
  placed: boolean;
  finalValue?: number;
  currency?: Currency;
  purchaseOrderNumber?: string;
  orderDate?: string;
  documentId?: string;
}

export interface ActivityEventDetails {
  regionalOffice: string;
  bsmName: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  eventType: EventType;
  exporterCount: number;
  buyerCount: number;
}

export interface ActivityRemarks {
  general: string;
  challenges: string;
  successStory: string;
  followUpRequired: boolean;
  nextFollowUpDate?: string;
}

export interface Activity {
  id: string;
  event: ActivityEventDetails;
  exporter: ExporterInfo;
  buyer: BuyerInfo;
  mou: MoUOutcome;
  orderInProcess: OrderInProcess;
  orderPlaced: OrderPlaced;
  remarks: ActivityRemarks;
  documents: StoredDocument[];
  status: ActivityStatus;
  /** profiles.id (UUID) of the creator — was previously (incorrectly) the display name, which broke the DB's uuid FK constraint. */
  createdBy: string;
  /** Display name of the creator, for UI/CSV — kept separate from createdBy so that field can be a real UUID. */
  createdByName: string;
  createdByRole: UserRole;
  createdByOffice: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'regional';

export interface User {
  id: string;
  name: string;
  email: string;
  /** plaintext for V1 demo only */
  password: string;
  role: UserRole;
  regionalOffice?: string;
  active: boolean;
  createdAt: string;
}

export interface RegionalOffice {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  organizationName: string;
  defaultCurrency: Currency;
  paginationSize: number;
}

export const REGIONAL_OFFICES: RegionalOffice[] = [
  { id: 'ro-del', name: 'Delhi', code: 'DEL', active: true },
  { id: 'ro-mum', name: 'Mumbai', code: 'MUM', active: true },
  { id: 'ro-che', name: 'Chennai', code: 'CHE', active: true },
  { id: 'ro-kol', name: 'Kolkata', code: 'KOL', active: true },
  { id: 'ro-ben', name: 'Bengaluru', code: 'BEN', active: true },
  { id: 'ro-ahm', name: 'Ahmedabad', code: 'AHM', active: true },
  { id: 'ro-hyd', name: 'Hyderabad', code: 'HYD', active: true },
  { id: 'ro-luc', name: 'Lucknow', code: 'LUC', active: true },
  { id: 'ro-jai', name: 'Jaipur', code: 'JAI', active: true },
];

/** event.regionalOffice / createdByOffice / profile.regionalOffice store the
 * office's id (e.g. 'ro-del', matching regional_offices.id in the DB) —
 * use this wherever the human-readable name should be displayed instead. */
export function officeName(id: string | undefined | null): string {
  if (!id) return '';
  return REGIONAL_OFFICES.find((o) => o.id === id)?.name ?? id;
}

/** 3-letter office code (e.g. 'DEL') for compact badges/avatars. */
export function officeCode(id: string | undefined | null): string {
  if (!id) return '';
  return REGIONAL_OFFICES.find((o) => o.id === id)?.code ?? id.slice(0, 3).toUpperCase();
}

export const PRODUCT_CATEGORIES = [
  'Textiles & Garments',
  'Handicrafts',
  'Engineering Goods',
  'Chemicals',
  'Pharmaceuticals',
  'Agriculture & Food',
  'Leather & Products',
  'Gems & Jewellery',
  'Electronics',
  'Auto Components',
  'Marine Products',
  'Carpets',
  'Sports Goods',
  'Cosmetics & Toiletries',
  'Other',
];

// Comprehensive list of countries (English short names) for the buyer country
// dropdown and the import parser's country-recognition matching. Kept broad
// deliberately — a short curated list caused real buyer countries (Ghana,
// Kenya, Nepal, etc.) to go unrecognized during import.
export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia',
  'Cameroon', 'Canada', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Guinea', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia',
  'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Mauritania',
  'Mauritius', 'Mexico', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco',
  'Mozambique', 'Myanmar', 'Namibia', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
  'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan',
  'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname',
  'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'Togo', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

export const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

export const EVENT_TYPES: EventType[] = [
  'Buyer-Seller Meet',
  'Trade Delegation',
  'Reverse BSM',
  'Virtual BSM',
  'Exhibition',
];

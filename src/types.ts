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

export const COUNTRIES = [
  'United States', 'United Arab Emirates', 'United Kingdom', 'Germany', 'France',
  'Japan', 'Singapore', 'Australia', 'Saudi Arabia', 'Netherlands',
  'Italy', 'Spain', 'Canada', 'South Africa', 'Nigeria', 'Brazil',
  'Russia', 'South Korea', 'China', 'Hong Kong', 'Bangladesh', 'Malaysia',
];

export const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

export const EVENT_TYPES: EventType[] = [
  'Buyer-Seller Meet',
  'Trade Delegation',
  'Reverse BSM',
  'Virtual BSM',
  'Exhibition',
];

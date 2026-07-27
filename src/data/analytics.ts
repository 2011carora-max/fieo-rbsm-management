import type { Activity } from '@/types';
import { officeName } from '@/types';

// Pure functions that derive dashboard / analytics data from the activity list.
// Kept separate from the UI so the same derivations can be reused or tested.

export interface Kpis {
  totalActivities: number;
  totalExporters: number;
  totalForeignBuyers: number;
  mouSigned: number;
  mouExpectedValue: number;
  ordersInProcess: number;
  estimatedOrderValue: number;
  ordersPlaced: number;
  confirmedOrderValue: number;
  countriesCovered: number;
  regionalOfficesActive: number;
  documentsUploaded: number;
  pendingFollowups: number;
}

export function computeKpis(activities: Activity[]): Kpis {
  const exporters = new Set<string>();
  const buyers = new Set<string>();
  const countries = new Set<string>();
  const offices = new Set<string>();
  let mouSigned = 0, mouExpectedValue = 0;
  let ordersInProcess = 0, estimatedOrderValue = 0;
  let ordersPlaced = 0, confirmedOrderValue = 0;
  let documentsUploaded = 0, pendingFollowups = 0;

  for (const a of activities) {
    exporters.add(a.exporter.exporterName.toLowerCase());
    buyers.add(a.buyer.buyerName.toLowerCase());
    countries.add(a.buyer.country);
    offices.add(a.event.regionalOffice);
    if (a.mou.signed) { mouSigned++; mouExpectedValue += a.mou.expectedValue ?? 0; }
    if (a.orderInProcess.active) { ordersInProcess++; estimatedOrderValue += a.orderInProcess.estimatedValue ?? 0; }
    if (a.orderPlaced.placed) { ordersPlaced++; confirmedOrderValue += a.orderPlaced.finalValue ?? 0; }
    documentsUploaded += a.documents.length;
    if (a.remarks.followUpRequired && a.remarks.nextFollowUpDate) pendingFollowups++;
  }

  return {
    totalActivities: activities.length,
    totalExporters: exporters.size,
    totalForeignBuyers: buyers.size,
    mouSigned,
    mouExpectedValue,
    ordersInProcess,
    estimatedOrderValue,
    ordersPlaced,
    confirmedOrderValue,
    countriesCovered: countries.size,
    regionalOfficesActive: offices.size,
    documentsUploaded,
    pendingFollowups,
  };
}

export interface SeriesPoint { label: string; value: number; }

export function monthlyActivities(activities: Activity[]): SeriesPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = new Array(12).fill(0);
  const year = new Date().getFullYear();
  for (const a of activities) {
    const d = new Date(a.event.eventDate);
    if (d.getFullYear() === year) buckets[d.getMonth()]++;
  }
  return months.map((label, i) => ({ label, value: buckets[i] }));
}

export function officePerformance(activities: Activity[]): SeriesPoint[] {
  const map = new Map<string, number>();
  for (const a of activities) map.set(officeName(a.event.regionalOffice), (map.get(officeName(a.event.regionalOffice)) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function officeValuePerformance(activities: Activity[]): SeriesPoint[] {
  const map = new Map<string, number>();
  for (const a of activities) {
    const v = (a.orderPlaced.finalValue ?? 0) + (a.orderInProcess.estimatedValue ?? 0) + (a.mou.expectedValue ?? 0);
    map.set(officeName(a.event.regionalOffice), (map.get(officeName(a.event.regionalOffice)) ?? 0) + v);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function countryDistribution(activities: Activity[]): SeriesPoint[] {
  const map = new Map<string, number>();
  for (const a of activities) map.set(a.buyer.country, (map.get(a.buyer.country) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
}

export function productDistribution(activities: Activity[]): SeriesPoint[] {
  const map = new Map<string, number>();
  for (const a of activities) map.set(a.exporter.productCategory, (map.get(a.exporter.productCategory) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function mouVsOrders(activities: Activity[]): { MoUs: number; 'In Process': number; Placed: number } {
  return {
    MoUs: activities.filter((a) => a.mou.signed).length,
    'In Process': activities.filter((a) => a.orderInProcess.active).length,
    Placed: activities.filter((a) => a.orderPlaced.placed).length,
  };
}

export function upcomingFollowups(activities: Activity[]): Activity[] {
  const today = new Date().toISOString().slice(0, 10);
  return activities
    .filter((a) => a.remarks.followUpRequired && a.remarks.nextFollowUpDate && a.remarks.nextFollowUpDate >= today)
    .sort((a, b) => (a.remarks.nextFollowUpDate! < b.remarks.nextFollowUpDate! ? -1 : 1))
    .slice(0, 6);
}

export function recentActivities(activities: Activity[], n = 6): Activity[] {
  return [...activities].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, n);
}

export function topPerformingOffices(activities: Activity[], n = 5): SeriesPoint[] {
  return officeValuePerformance(activities).slice(0, n);
}

export function formatCurrency(value: number, currency = 'USD'): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', JPY: '¥' };
  const sym = symbols[currency] ?? '';
  return `${sym}${(value / 1000).toFixed(1)}K`;
}

export function formatFullCurrency(value: number, currency = 'USD'): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', JPY: '¥' };
  const sym = symbols[currency] ?? '';
  return `${sym}${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

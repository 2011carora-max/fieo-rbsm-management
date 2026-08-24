import type { Activity } from '@/types';
import { officeName } from '@/types';

// Export helpers — CSV (Excel-compatible) and a print-ready HTML document
// that opens in a new window and triggers the print dialog. The same HTML
// can be saved as PDF via the browser's "Save as PDF" destination.

const HEADERS = [
  'Activity ID', 'Regional Office', 'BSM Name', 'Event Date', 'Venue', 'City', 'Country',
  'Event Type', 'Exporters', 'Buyers',
  'Exporter Name', 'IEC', 'Company', 'Product Category', 'Exporter Email', 'Exporter Phone',
  'Buyer Name', 'Buyer Company', 'Buyer Country', 'Buyer Passport Number', 'Buyer Phone',
  'MoU Signed', 'MoU Expected Value', 'MoU Currency', 'MoU Timeline',
  'Order In Process', 'Estimated Value', 'Order Currency', 'Expected Closure', 'Probability',
  'Order Placed', 'Final Value', 'PO Number', 'Order Date',
  'Status', 'Created By', 'Order Details', 'Next Follow-up',
];

function activityRow(a: Activity): (string | number)[] {
  return [
    a.id, officeName(a.event.regionalOffice), a.event.bsmName, a.event.eventDate, a.event.venue, a.event.city, a.event.country,
    a.event.eventType, a.event.exporterCount, a.event.buyerCount,
    a.exporter.exporterName, a.exporter.iecNumber, a.exporter.companyName, a.exporter.productCategory, a.exporter.email, a.exporter.phone,
    a.buyer.buyerName, a.buyer.company, a.buyer.country, a.buyer.passportNumber, a.buyer.phone,
    a.mou.signed ? 'Yes' : 'No', a.mou.expectedValue ?? '', a.mou.currency ?? '', a.mou.expectedTimeline ?? '',
    a.orderInProcess.active ? 'Yes' : 'No', a.orderInProcess.estimatedValue ?? '', a.orderInProcess.currency ?? '', a.orderInProcess.expectedClosureDate ?? '', a.orderInProcess.probability ?? '',
    a.orderPlaced.placed ? 'Yes' : 'No', a.orderPlaced.finalValue ?? '', a.orderPlaced.purchaseOrderNumber ?? '', a.orderPlaced.orderDate ?? '',
    a.status, a.createdByName, a.remarks.general ?? '', a.remarks.nextFollowUpDate ?? '',
  ];
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function activitiesToCsv(activities: Activity[]): string {
  const rows = [HEADERS.join(','), ...activities.map((a) => activityRow(a).map(csvEscape).join(','))];
  return rows.join('\n');
}

export function downloadCsv(activities: Activity[], filename: string): void {
  const csv = activitiesToCsv(activities);
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Generic CSV download for tabular data that isn't a list of Activities (e.g. an import audit/error report). */
export function downloadRowsCsv(headers: string[], rows: (string | number)[][], filename: string): void {
  const csv = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------- Printable report ----------

export interface ReportMeta {
  title: string;
  preparedBy: string;
  filters: string[];
}

export function printReport(activities: Activity[], meta: ReportMeta): void {
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) {
    alert('Please allow pop-ups to print the report.');
    return;
  }
  const date = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
  const rowsHtml = activities.length
    ? activities.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${a.id}</td>
        <td>${officeName(a.event.regionalOffice)}</td>
        <td>${a.event.eventDate}</td>
        <td>${a.exporter.exporterName}</td>
        <td>${a.buyer.buyerName}</td>
        <td>${a.buyer.country}</td>
        <td>${a.exporter.productCategory}</td>
        <td>${a.mou.signed ? 'Yes' : 'No'}</td>
        <td>${a.orderInProcess.active ? 'Yes' : 'No'}</td>
        <td>${a.orderPlaced.placed ? 'Yes' : 'No'}</td>
        <td style="text-align:right">${a.orderPlaced.finalValue?.toLocaleString('en-IN') ?? '-'}</td>
        <td>${a.orderPlaced.currency ?? ''}</td>
        <td>${a.status}</td>
      </tr>`).join('')
    : '<tr><td colspan="14" style="text-align:center;padding:24px">No records match the selected filters.</td></tr>';

  const totals = activities.reduce(
    (acc, a) => {
      acc.mou += a.mou.expectedValue ?? 0;
      acc.estimated += a.orderInProcess.estimatedValue ?? 0;
      acc.confirmed += a.orderPlaced.finalValue ?? 0;
      return acc;
    },
    { mou: 0, estimated: 0, confirmed: 0 },
  );

  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${meta.title}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a3d72; margin: 0; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1f4a8a; padding-bottom: 12px; }
  .logo { width: 64px; height: 64px; border-radius: 12px; background: #1f4a8a; color: #fff; font-family: Georgia, serif; font-size: 30px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .title h1 { margin: 0; font-size: 18px; color: #1a3d72; }
  .title p { margin: 2px 0 0; font-size: 12px; color: #555; }
  .govt { margin-left: auto; text-align: right; font-size: 11px; color: #555; }
  .meta { display: flex; justify-content: space-between; margin: 12px 0; font-size: 12px; color: #333; }
  .filters { background: #f1f5fb; border-left: 4px solid #df7620; padding: 8px 12px; font-size: 12px; margin: 8px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1f4a8a; color: #fff; padding: 8px 6px; text-align: left; position: sticky; top: 0; }
  td { padding: 7px 6px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals { display: flex; gap: 24px; margin-top: 16px; font-size: 12px; }
  .totals div { padding: 10px 14px; background: #f1f5fb; border-radius: 8px; }
  .totals strong { color: #1a3d72; }
  .footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 4px; }
  .accent { height: 4px; background: #df7620; border-radius: 2px; margin-top: 2px; }
</style></head>
<body>
  <div class="header">
    <div class="logo">F</div>
    <div class="title">
      <h1>Federation of Indian Export Organisations</h1>
      <p>Ministry of Commerce &amp; Industry, Government of India — RBSM Outcome Tracking Portal</p>
      <div class="accent"></div>
    </div>
    <div class="govt"><strong>${meta.title}</strong><br/>Generated: ${date}</div>
  </div>
  <div class="meta">
    <span>Prepared by: <strong>${meta.preparedBy}</strong></span>
    <span>Total records: <strong>${activities.length}</strong></span>
  </div>
  ${meta.filters.length ? `<div class="filters"><strong>Filters:</strong> ${meta.filters.join(' · ')}</div>` : ''}
  <table>
    <thead><tr>
      <th>#</th><th>Activity ID</th><th>Office</th><th>Event Date</th><th>Exporter</th><th>Buyer</th>
      <th>Country</th><th>Product</th><th>MoU</th><th>In Process</th><th>Placed</th><th>Final Value</th><th>Curr.</th><th>Status</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div>MoU Expected: <strong>${totals.mou.toLocaleString('en-IN')}</strong></div>
    <div>Estimated Orders: <strong>${totals.estimated.toLocaleString('en-IN')}</strong></div>
    <div>Confirmed Orders: <strong>${totals.confirmed.toLocaleString('en-IN')}</strong></div>
  </div>
  <div class="footer"><span>FIEO RBSM Management System — Confidential</span><span>Page <span id="p"></span></span></div>
  <script>
    // Best-effort page numbering via onafterprint is unreliable; CSS @page handles it for most browsers.
    window.onload = () => setTimeout(() => window.print(), 300);
  </script>
</body></html>`);
  w.document.close();
}
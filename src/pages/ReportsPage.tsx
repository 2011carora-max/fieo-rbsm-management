import { useMemo, useState } from 'react';
import { FileBarChart, FileSpreadsheet, Printer, Filter, X, FileText } from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { downloadCsv, printReport } from '@/data/export';
import { COUNTRIES, PRODUCT_CATEGORIES, REGIONAL_OFFICES, officeName } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { formatFullCurrency } from '@/data/analytics';

export function ReportsPage() {
  const { activities } = useActivities();
  const { user } = useAuth();
  const { notify } = useToast();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState({
    office: '', country: '', exporter: '', buyer: '', product: '', from: '', to: '',
  });

  const visible = useMemo(
    () => (isAdmin ? activities : activities.filter((a) => a.createdByOffice === user?.regionalOffice || a.createdBy === user?.id)),
    [activities, isAdmin, user],
  );

  const filtered = useMemo(() => {
    let rows = visible;
    if (filters.office) rows = rows.filter((a) => a.event.regionalOffice === filters.office);
    if (filters.country) rows = rows.filter((a) => a.buyer.country === filters.country);
    if (filters.product) rows = rows.filter((a) => a.exporter.productCategory === filters.product);
    if (filters.exporter) rows = rows.filter((a) => a.exporter.exporterName.toLowerCase().includes(filters.exporter.toLowerCase()));
    if (filters.buyer) rows = rows.filter((a) => a.buyer.buyerName.toLowerCase().includes(filters.buyer.toLowerCase()));
    if (filters.from) rows = rows.filter((a) => a.event.eventDate >= filters.from);
    if (filters.to) rows = rows.filter((a) => a.event.eventDate <= filters.to);
    return rows;
  }, [visible, filters]);

  const totals = useMemo(() => filtered.reduce((acc, a) => {
    acc.mou += a.mou.expectedValue ?? 0;
    acc.estimated += a.orderInProcess.estimatedValue ?? 0;
    acc.confirmed += a.orderPlaced.finalValue ?? 0;
    acc.mouCount += a.mou.signed ? 1 : 0;
    acc.orders += a.orderPlaced.placed ? 1 : 0;
    return acc;
  }, { mou: 0, estimated: 0, confirmed: 0, mouCount: 0, orders: 0 }), [filtered]);

  const filterLabels = [
    filters.office && `Office: ${filters.office}`,
    filters.country && `Country: ${filters.country}`,
    filters.product && `Product: ${filters.product}`,
    filters.exporter && `Exporter: ${filters.exporter}`,
    filters.buyer && `Buyer: ${filters.buyer}`,
    (filters.from || filters.to) && `Date: ${filters.from || '…'} → ${filters.to || '…'}`,
  ].filter(Boolean) as string[];

  const exportCsv = () => {
    downloadCsv(filtered, `FIEO-RBSM-Report-${new Date().toISOString().slice(0, 10)}.csv`);
    notify(`Exported ${filtered.length} records.`, 'success');
  };

  const printPdf = () => {
    printReport(filtered, {
      title: 'RBSM Outcome Report',
      preparedBy: user?.name ?? 'FIEO User',
      filters: filterLabels,
    });
  };

  const clearFilters = () => setFilters({ office: '', country: '', exporter: '', buyer: '', product: '', from: '', to: '' });

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Generate filtered reports and export to Excel, PDF or print.</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-fieo-600" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Report Filters</h3>
          {filterLabels.length > 0 && <button className="btn-ghost text-xs ml-auto" onClick={clearFilters}><X size={14} /> Clear</button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Regional Office</label>
            <select className="input" value={filters.office} onChange={(e) => setFilters({ ...filters, office: e.target.value })}>
              <option value="">All</option>
              {REGIONAL_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Country</label>
            <select className="input" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
              <option value="">All</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Product Category</label>
            <select className="input" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
              <option value="">All</option>
              {PRODUCT_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Exporter</label>
            <input className="input" value={filters.exporter} onChange={(e) => setFilters({ ...filters, exporter: e.target.value })} placeholder="Name contains…" />
          </div>
          <div>
            <label className="label">Buyer</label>
            <input className="input" value={filters.buyer} onChange={(e) => setFilters({ ...filters, buyer: e.target.value })} placeholder="Name contains…" />
          </div>
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-secondary" onClick={exportCsv}><FileSpreadsheet size={16} /> Export Excel (CSV)</button>
          <button className="btn-primary" onClick={printPdf}><Printer size={16} /> Generate PDF / Print</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Records" value={filtered.length} />
        <SummaryCard label="MoUs Signed" value={totals.mouCount} />
        <SummaryCard label="Orders Placed" value={totals.orders} />
        <SummaryCard label="MoU Expected" value={formatFullCurrency(totals.mou)} />
        <SummaryCard label="Confirmed Value" value={formatFullCurrency(totals.confirmed)} />
      </div>

      {/* Preview table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
          <FileText size={16} className="text-fieo-600" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Report Preview</h3>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} records</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No records match the selected filters" message="Adjust the filters above and try again." icon={<FileBarChart size={28} />} />
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-950/50 sticky top-0">
                <tr>
                  {['Activity ID', 'Office', 'Date', 'Exporter', 'Buyer', 'Country', 'Product', 'MoU', 'Order', 'Value', 'Status'].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 100).map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-td font-mono text-xs text-fieo-600 dark:text-fieo-300">{a.id}</td>
                    <td className="table-td">{officeName(a.event.regionalOffice)}</td>
                    <td className="table-td">{a.event.eventDate}</td>
                    <td className="table-td max-w-[140px] truncate" title={a.exporter.exporterName}>{a.exporter.exporterName}</td>
                    <td className="table-td max-w-[140px] truncate" title={a.buyer.buyerName}>{a.buyer.buyerName}</td>
                    <td className="table-td">{a.buyer.country}</td>
                    <td className="table-td max-w-[120px] truncate" title={a.exporter.productCategory}>{a.exporter.productCategory}</td>
                    <td className="table-td">{a.mou.signed ? 'Yes' : 'No'}</td>
                    <td className="table-td">{a.orderPlaced.placed ? 'Placed' : a.orderInProcess.active ? 'Process' : '—'}</td>
                    <td className="table-td text-right">{a.orderPlaced.finalValue ? formatFullCurrency(a.orderPlaced.finalValue, a.orderPlaced.currency) : '—'}</td>
                    <td className="table-td">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && <p className="text-center text-xs text-gray-400 py-3">Showing first 100 of {filtered.length} records. Export for the full dataset.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

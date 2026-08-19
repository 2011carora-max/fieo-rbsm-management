import { useMemo, useState } from 'react';
import {
  Plus, Search, Eye, Pencil, Trash2, Download, X, ArrowUpDown, ArrowUp, ArrowDown,
  ClipboardList, SlidersHorizontal,
} from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ActivityWizard } from '@/pages/ActivityWizard';
import { ActivityViewModal } from '@/pages/ActivityViewModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { downloadCsv } from '@/data/export';
import { formatFullCurrency } from '@/data/analytics';
import { getActivity } from '@/data/repository';
import { COUNTRIES, PRODUCT_CATEGORIES, REGIONAL_OFFICES, officeName } from '@/types';
import type { Activity } from '@/types';

type SortKey = 'id' | 'event.regionalOffice' | 'event.eventDate' | 'exporter.exporterName' | 'buyer.buyerName' | 'buyer.country' | 'exporter.productCategory' | 'orderPlaced.finalValue' | 'status' | 'updatedAt';
type SortDir = 'asc' | 'desc';

function getPath(obj: Activity, path: string): string | number {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
  return (cur as string | number | undefined) ?? '';
}

function statusBadge(status: Activity['status']) {
  const map: Record<Activity['status'], string> = {
    Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'Follow-up Required': 'bg-saffron-100 text-saffron-700 dark:bg-saffron-900/50 dark:text-saffron-200',
    'In Process': 'bg-fieo-100 text-fieo-700 dark:bg-fieo-900/50 dark:text-fieo-200',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200',
    Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200',
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export function ActivitiesPage() {
  const { activities, upsert, remove } = useActivities();
  const { user } = useAuth();
  const { notify } = useToast();

  const isAdmin = user?.role === 'admin';
  const visible = useMemo(
    () => (isAdmin ? activities : activities.filter((a) => a.createdByOffice === user?.regionalOffice || a.createdBy === user?.id)),
    [activities, isAdmin, user],
  );

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    office: '', country: '', product: '', exporter: '', buyer: '',
    mou: '', order: '', followup: '', from: '', to: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [viewing, setViewing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  const filtered = useMemo(() => {
    let rows = visible;
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((a) =>
        [a.id, a.event.bsmName, a.exporter.exporterName, a.exporter.companyName, a.buyer.buyerName, a.buyer.company, a.buyer.country, a.exporter.productCategory]
          .join(' ').toLowerCase().includes(q),
      );
    }
    if (filters.office) rows = rows.filter((a) => a.event.regionalOffice === filters.office);
    if (filters.country) rows = rows.filter((a) => a.buyer.country === filters.country);
    if (filters.product) rows = rows.filter((a) => a.exporter.productCategory === filters.product);
    if (filters.exporter) rows = rows.filter((a) => a.exporter.exporterName.toLowerCase().includes(filters.exporter.toLowerCase()));
    if (filters.buyer) rows = rows.filter((a) => a.buyer.buyerName.toLowerCase().includes(filters.buyer.toLowerCase()));
    if (filters.mou) rows = rows.filter((a) => (filters.mou === 'yes' ? a.mou.signed : !a.mou.signed));
    if (filters.order) rows = rows.filter((a) => (filters.order === 'placed' ? a.orderPlaced.placed : filters.order === 'process' ? a.orderInProcess.active : !a.orderPlaced.placed && !a.orderInProcess.active));
    if (filters.followup) rows = rows.filter((a) => a.remarks.followUpRequired);
    if (filters.from) rows = rows.filter((a) => a.event.eventDate >= filters.from);
    if (filters.to) rows = rows.filter((a) => a.event.eventDate <= filters.to);

    rows = [...rows].sort((a, b) => {
      const av = getPath(a, sortKey);
      const bv = getPath(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [visible, query, filters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />;

  const openNew = () => { setEditing(null); setWizardOpen(true); };
  const openEdit = (a: Activity) => {
    void (async () => {
      try {
        const hydrated = await getActivity(a.id);
        setEditing(hydrated ?? a);
        setWizardOpen(true);
      } catch (err) {
        console.error('ActivitiesPage: failed to load activity for editing', err);
        notify('Failed to load activity details.', 'error');
      }
    })();
  };
  const onSave = async (a: Activity, removedDocumentIds: string[] = []) => { await upsert(a, removedDocumentIds); };
  const onDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      notify('Activity deleted.', 'info');
      setDeleting(null);
    } catch (err) {
      console.error('ActivitiesPage: failed to delete activity', err);
      notify(err instanceof Error ? err.message : 'Failed to delete activity.', 'error');
    }
  };

  const canEdit = (a: Activity) => isAdmin || a.createdByOffice === user?.regionalOffice || a.createdBy === user?.id;
  const canDelete = () => isAdmin;

  const exportCsv = () => {
    downloadCsv(filtered, `FIEO-RBSM-Activities-${new Date().toISOString().slice(0, 10)}.csv`);
    notify(`Exported ${filtered.length} records to CSV.`, 'success');
  };

  const clearFilters = () => setFilters({ office: '', country: '', product: '', exporter: '', buyer: '', mou: '', order: '', followup: '', from: '', to: '' });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Activities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} of {visible.length} records</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> New Activity</button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              className="input pl-10"
              placeholder="Search by ID, exporter, buyer, country, product…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              aria-label="Global search"
            />
          </div>
          <button className="btn-secondary" onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal size={16} /> Filters
            {Object.values(filters).some(Boolean) && <span className="w-2 h-2 rounded-full bg-saffron-500" />}
          </button>
          {Object.values(filters).some(Boolean) && (
            <button className="btn-ghost text-xs" onClick={clearFilters}><X size={14} /> Clear</button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
            <select className="input" value={filters.office} onChange={(e) => setFilters({ ...filters, office: e.target.value })} aria-label="Filter by office">
              <option value="">All Offices</option>
              {REGIONAL_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select className="input" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} aria-label="Filter by country">
              <option value="">All Countries</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })} aria-label="Filter by product">
              <option value="">All Products</option>
              {PRODUCT_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="input" placeholder="Exporter" value={filters.exporter} onChange={(e) => setFilters({ ...filters, exporter: e.target.value })} aria-label="Filter by exporter" />
            <input className="input" placeholder="Buyer" value={filters.buyer} onChange={(e) => setFilters({ ...filters, buyer: e.target.value })} aria-label="Filter by buyer" />
            <select className="input" value={filters.mou} onChange={(e) => setFilters({ ...filters, mou: e.target.value })} aria-label="Filter by MoU">
              <option value="">MoU: Any</option>
              <option value="yes">MoU: Signed</option>
              <option value="no">MoU: Not Signed</option>
            </select>
            <select className="input" value={filters.order} onChange={(e) => setFilters({ ...filters, order: e.target.value })} aria-label="Filter by order">
              <option value="">Order: Any</option>
              <option value="placed">Order: Placed</option>
              <option value="process">Order: In Process</option>
              <option value="none">Order: None</option>
            </select>
            <select className="input" value={filters.followup} onChange={(e) => setFilters({ ...filters, followup: e.target.value })} aria-label="Filter by follow-up">
              <option value="">Follow-up: Any</option>
              <option value="yes">Pending Follow-up</option>
            </select>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="From date" />
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="To date" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {pageRows.length === 0 ? (
          <EmptyState
            title="No activities found"
            message={visible.length === 0 ? "Create your first Buyer-Seller Meet record to get started." : "Try adjusting your search or filters."}
            icon={<ClipboardList size={28} />}
            action={visible.length === 0 ? <button className="btn-primary" onClick={openNew}><Plus size={16} /> New Activity</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-950/50">
                <tr>
                  {([
                    ['id', 'Activity ID'], ['event.regionalOffice', 'Office'], ['event.eventDate', 'Event Date'],
                    ['exporter.exporterName', 'Exporter'], ['buyer.buyerName', 'Buyer'], ['buyer.country', 'Country'],
                    ['exporter.productCategory', 'Product'], ['orderPlaced.finalValue', 'Final Value'], ['status', 'Status'],
                  ] as Array<[SortKey, string]>).map(([key, label]) => (
                    <th key={key} className="table-th">
                      <button className="flex items-center gap-1 hover:text-fieo-600" onClick={() => toggleSort(key)}>
                        {label} {sortIcon(key)}
                      </button>
                    </th>
                  ))}
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {pageRows.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="table-td font-mono text-xs text-fieo-600 dark:text-fieo-300">{a.id}</td>
                    <td className="table-td">{officeName(a.event.regionalOffice)}</td>
                    <td className="table-td">{a.event.eventDate}</td>
                    <td className="table-td max-w-[160px] truncate" title={a.exporter.exporterName}>{a.exporter.exporterName}</td>
                    <td className="table-td max-w-[160px] truncate" title={a.buyer.buyerName}>{a.buyer.buyerName}</td>
                    <td className="table-td">{a.buyer.country}</td>
                    <td className="table-td max-w-[140px] truncate" title={a.exporter.productCategory}>{a.exporter.productCategory}</td>
                    <td className="table-td text-right">{a.orderPlaced.finalValue ? formatFullCurrency(a.orderPlaced.finalValue, a.orderPlaced.currency) : '—'}</td>
                    <td className="table-td">{statusBadge(a.status)}</td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost p-1.5 rounded-md"
                          onClick={() => {
                            void (async () => {
                              try {
                                const hydrated = await getActivity(a.id);
                                setViewing(hydrated ?? a);
                              } catch (err) {
                                console.error('ActivitiesPage: failed to load activity detail', err);
                                notify('Failed to load activity details.', 'error');
                              }
                            })();
                          }}
                          aria-label={`View ${a.id}`}
                          title="View"
                        ><Eye size={15} /></button>
                        {canEdit(a) && <button className="btn-ghost p-1.5 rounded-md" onClick={() => openEdit(a)} aria-label={`Edit ${a.id}`} title="Edit"><Pencil size={15} /></button>}
                        {canDelete() && <button className="btn-ghost p-1.5 rounded-md text-red-500" onClick={() => setDeleting(a)} aria-label={`Delete ${a.id}`} title="Delete"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageRows.length > 0 && (
          <Pagination page={currentPage} totalPages={totalPages} pageSize={pageSize} total={filtered.length} onPage={setPage} />
        )}
      </div>

      <ActivityWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onSave={onSave} editing={editing} all={activities} />
      <ActivityViewModal open={!!viewing} onClose={() => setViewing(null)} activity={viewing} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete activity?"
        message={`This will permanently remove ${deleting?.id} (${deleting?.exporter.exporterName} → ${deleting?.buyer.buyerName}). This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

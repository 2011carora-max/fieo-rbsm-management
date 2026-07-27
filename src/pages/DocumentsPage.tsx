import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, Image, Download, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { listActivitiesWithDocumentUrls } from '@/data/repository';
import type { Activity, DocumentKind, StoredDocument } from '@/types';
import { officeName } from '@/types';

interface DocRow extends StoredDocument {
  activityId: string;
  office: string;
  exporter: string;
}

const KIND_ICON: Record<DocumentKind, React.ReactNode> = {
  MoU: <FileText size={16} />,
  'Purchase Order': <FileText size={16} />,
  Invoice: <FileText size={16} />,
  Photograph: <Image size={16} />,
  'Meeting Minutes': <FileText size={16} />,
  Other: <FileText size={16} />,
};

export function DocumentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string>('');

  // This page (unlike Dashboard/Reports/Analytics/Activities) actually
  // renders every document's thumbnail/download link, so it's the one place
  // that needs the hydrated (real signed-URL) fetch — done here, on demand,
  // rather than in the shared useActivities() hook every other page uses.
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setActivities(await listActivitiesWithDocumentUrls());
    } catch (err) {
      console.error('DocumentsPage: failed to load documents', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const docs = useMemo<DocRow[]>(() => {
    const visible = isAdmin ? activities : activities.filter((a) => a.createdByOffice === user?.regionalOffice || a.createdBy === user?.id);
    const rows: DocRow[] = [];
    for (const a of visible) for (const d of a.documents) rows.push({ ...d, activityId: a.id, office: officeName(a.event.regionalOffice), exporter: a.exporter.exporterName });
    return rows;
  }, [activities, isAdmin, user]);

  const filtered = useMemo(() => {
    let rows = docs;
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((d) => [d.name, d.kind, d.activityId, d.office, d.exporter].join(' ').toLowerCase().includes(q));
    }
    if (kind) rows = rows.filter((d) => d.kind === kind);
    return rows.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  }, [docs, query, kind]);

  const kindCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of docs) map.set(d.kind, (map.get(d.kind) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [docs]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-6 text-center space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button className="btn-secondary mx-auto" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Documents</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">All MoUs, purchase orders, invoices, photographs and minutes across activities.</p>
      </div>

      {/* Kind summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kindCounts.map(([k, n]) => (
          <button key={k} onClick={() => setKind(kind === k ? '' : k)} className={`card p-3 text-left transition hover:shadow-soft-lg ${kind === k ? 'ring-2 ring-fieo-500' : ''}`}>
            <div className="flex items-center gap-2 text-fieo-600 dark:text-fieo-300">{KIND_ICON[k as DocumentKind]}</div>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{n}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{k}</p>
          </button>
        ))}
        {kindCounts.length === 0 && (
          <div className="col-span-full card p-4 text-sm text-gray-400 text-center">No documents uploaded yet.</div>
        )}
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10" placeholder="Search by name, activity, office, exporter…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" />
          </div>
          {kind && <button className="btn-secondary" onClick={() => setKind('')}>Clear filter: {kind}</button>}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState title="No documents found" message="Upload documents from within an activity record, or adjust your search." icon={<FolderOpen size={28} />} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((d) => {
            const isImg = d.mime.startsWith('image/');
            return (
              <div key={d.id} className="card overflow-hidden hover:shadow-soft-lg transition group">
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {isImg ? (
                    <img src={d.dataUrl} alt={d.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <FileText size={40} className="text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-fieo-100 text-fieo-700 dark:bg-fieo-900/50 dark:text-fieo-200">{d.kind}</span>
                    <span className="text-[10px] text-gray-400">{(d.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={d.name}>{d.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{d.activityId} · {d.office}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-gray-400 truncate">{d.exporter}</span>
                    <a href={d.dataUrl} download={d.name} className="btn-ghost p-1.5 rounded-md text-fieo-600" aria-label={`Download ${d.name}`} title="Download">
                      <Download size={15} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

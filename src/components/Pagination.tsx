import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, pageSize, total, onPage }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </p>
      <div className="flex items-center gap-1">
        <button className="btn-ghost p-1.5 rounded-md disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={18} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, i, arr) => (
            <span key={p} className="flex items-center">
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
              <button
                className={`w-8 h-8 rounded-md text-sm transition ${p === page ? 'bg-fieo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            </span>
          ))}
        <button className="btn-ghost p-1.5 rounded-md disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

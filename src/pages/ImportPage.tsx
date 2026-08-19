import { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle,
  Loader2, RotateCcw, Info,
} from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { EmptyState } from '@/components/EmptyState';
import { COUNTRIES, EVENT_TYPES, REGIONAL_OFFICES } from '@/types';
import type { EventType } from '@/types';
import {
  parseWorkbookFile, extractRows, autoSuggestMapping, buildImportedRows, TARGET_FIELDS,
  type ParsedWorkbook, type SheetRows, type ColumnMapping, type EventBatchDefaults, type ImportedRow, type TargetKey,
} from '@/data/importParser';
import { cn } from '@/lib/cn';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload File',
  2: 'Select Sheet',
  3: 'Event Details',
  4: 'Map Columns',
  5: 'Review & Import',
  6: 'Done',
};

export function ImportPage() {
  const { activities, upsert, refresh } = useActivities();
  const { user } = useAuth();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [sheetRows, setSheetRows] = useState<SheetRows | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [eventDefaults, setEventDefaults] = useState<EventBatchDefaults>({
    regionalOffice: user?.role === 'regional' ? (user.regionalOffice ?? '') : '',
    bsmName: '', eventDate: '', venue: '', city: '', state: '', country: 'India', eventType: 'Buyer-Seller Meet',
  });
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  const reset = () => {
    setStep(1);
    setFileName('');
    setWorkbook(null);
    setSheetIdx(0);
    setHeaderRow(0);
    setSheetRows(null);
    setMapping({});
    setImportedRows([]);
    setProgress({ done: 0, total: 0, failed: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      const wb = await parseWorkbookFile(file);
      if (wb.sheets.length === 0) {
        notify('That file has no readable sheets.', 'error');
        return;
      }
      setWorkbook(wb);
      setFileName(file.name);
      setSheetIdx(0);
      setHeaderRow(wb.sheets[0].suggestedHeaderRow);
      setStep(2);
    } catch (err) {
      console.error('ImportPage: failed to parse workbook', err);
      notify('Could not read that file. Make sure it is a valid .xlsx or .csv file.', 'error');
    } finally {
      setParsing(false);
    }
  };

  const currentSheet = workbook?.sheets[sheetIdx] ?? null;

  const proceedToEventDetails = () => {
    if (!currentSheet) return;
    const rows = extractRows(currentSheet, headerRow);
    if (rows.rows.length === 0) {
      notify('No data rows found below the selected header row.', 'error');
      return;
    }
    setSheetRows(rows);
    setMapping(autoSuggestMapping(rows.headers));
    setStep(3);
  };

  const proceedToMapping = () => {
    if (!eventDefaults.regionalOffice) { notify('Select a regional office for this batch.', 'error'); return; }
    if (!eventDefaults.eventDate) { notify('Enter the event date for this batch.', 'error'); return; }
    setStep(4);
  };

  const proceedToReview = () => {
    if (!sheetRows || !user) return;
    const rows = buildImportedRows(
      sheetRows, mapping, eventDefaults,
      user.id, user.name, user.role, activities,
    );
    setImportedRows(rows);
    setStep(5);
  };

  const toggleInclude = (rowNumber: number) => {
    setImportedRows((prev) => prev.map((r) => (r.rowNumber === rowNumber ? { ...r, include: !r.include } : r)));
  };

  const readyCount = importedRows.filter((r) => r.include).length;
  const errorCount = importedRows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = importedRows.filter((r) => r.duplicate).length;

  const runImport = async () => {
    const toImport = importedRows.filter((r) => r.include);
    if (toImport.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: toImport.length, failed: 0 });
    let failed = 0;
    for (const row of toImport) {
      try {
        await upsert(row.activity);
      } catch (err) {
        console.error('ImportPage: failed to save row', row.rowNumber, err);
        failed++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1, failed }));
    }
    setImporting(false);
    setStep(6);
    await refresh();
    if (failed === 0) notify(`Imported ${toImport.length} activities.`, 'success');
    else notify(`Imported ${toImport.length - failed} activities, ${failed} failed. See console for details.`, 'warning');
  };

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof TARGET_FIELDS>();
    for (const f of TARGET_FIELDS) {
      const list = groups.get(f.group) ?? [];
      list.push(f);
      groups.set(f.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Import Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Bring in Buyer-Seller Meet records from an Excel report — map its columns to the app's fields, review, then import.
        </p>
      </div>

      {/* Step indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {([1, 2, 3, 4, 5] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 shrink-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                step === s ? 'bg-fieo-600 text-white' : step > s ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-800',
              )}>
                {step > s ? <CheckCircle2 size={14} /> : s}
              </div>
              <span className={cn('text-xs font-medium whitespace-nowrap', step === s ? 'text-gray-900 dark:text-white' : 'text-gray-400')}>
                {STEP_LABELS[s]}
              </span>
              {i < 4 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card p-8">
          <EmptyState
            icon={<FileSpreadsheet size={28} />}
            title="Upload an Excel file"
            message="Accepts .xlsx, .xls, or .csv — e.g. a regional office's RBSM status report."
            action={
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
                />
                <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
                  {parsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {parsing ? 'Reading file…' : 'Choose file'}
                </button>
              </div>
            }
          />
        </div>
      )}

      {/* Step 2: Sheet + header row */}
      {step === 2 && workbook && currentSheet && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <FileSpreadsheet size={16} /> {fileName}
          </div>

          {workbook.sheets.length > 1 && (
            <div>
              <label className="label">Sheet</label>
              <select
                className="input"
                value={sheetIdx}
                onChange={(e) => { const idx = Number(e.target.value); setSheetIdx(idx); setHeaderRow(workbook.sheets[idx].suggestedHeaderRow); }}
              >
                {workbook.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Header row</label>
            <input
              type="number"
              min={1}
              max={Math.min(10, currentSheet.matrix.length)}
              className="input max-w-[120px]"
              value={headerRow + 1}
              onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value) - 1))}
            />
            <p className="text-xs text-gray-400 mt-1">Which row in the sheet contains the column titles (e.g. "Country", "Company Name").</p>
          </div>

          <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-lg">
            <table className="w-full text-xs">
              <tbody>
                {currentSheet.matrix.slice(0, 6).map((row, i) => (
                  <tr key={i} className={cn(i === headerRow && 'bg-fieo-50 dark:bg-fieo-900/30 font-semibold')}>
                    <td className="px-2 py-1.5 text-gray-400 border-r border-gray-100 dark:border-gray-800">{i + 1}</td>
                    {row.slice(0, 8).map((cell, j) => (
                      <td key={j} className="px-2 py-1.5 whitespace-nowrap max-w-[160px] truncate text-gray-700 dark:text-gray-200" title={cell}>{cell || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={reset}><RotateCcw size={16} /> Start Over</button>
            <button className="btn-primary" onClick={proceedToEventDetails}>Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 3: Event details for the whole batch */}
      {step === 3 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>These details apply to every row imported from this file — they'll all be recorded under the same event. You can edit individual records afterward from the Activities page.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Regional Office *</label>
              <select
                className="input"
                value={eventDefaults.regionalOffice}
                onChange={(e) => setEventDefaults({ ...eventDefaults, regionalOffice: e.target.value })}
                disabled={user?.role === 'regional'}
              >
                <option value="">Select office</option>
                {REGIONAL_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Event Type</label>
              <select
                className="input"
                value={eventDefaults.eventType}
                onChange={(e) => setEventDefaults({ ...eventDefaults, eventType: e.target.value as EventType })}
              >
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">BSM Name</label>
              <input className="input" value={eventDefaults.bsmName} onChange={(e) => setEventDefaults({ ...eventDefaults, bsmName: e.target.value })} placeholder="e.g. West Bengal RBSM 2026" />
            </div>
            <div>
              <label className="label">Event Date *</label>
              <input type="date" className="input" value={eventDefaults.eventDate} onChange={(e) => setEventDefaults({ ...eventDefaults, eventDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Venue</label>
              <input className="input" value={eventDefaults.venue} onChange={(e) => setEventDefaults({ ...eventDefaults, venue: e.target.value })} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={eventDefaults.city} onChange={(e) => setEventDefaults({ ...eventDefaults, city: e.target.value })} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={eventDefaults.state} onChange={(e) => setEventDefaults({ ...eventDefaults, state: e.target.value })} />
            </div>
            <div>
              <label className="label">Event Country</label>
              <select className="input" value={eventDefaults.country} onChange={(e) => setEventDefaults({ ...eventDefaults, country: e.target.value })}>
                <option value="India">India</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button>
            <button className="btn-primary" onClick={proceedToMapping}>Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 4: Column mapping */}
      {step === 4 && sheetRows && (
        <div className="card p-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tell us what each column in your sheet means. We've guessed a starting mapping — adjust anything that's wrong. Columns set to "Don't import" are skipped.
          </p>
          <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950/50">
                <tr>
                  <th className="table-th">Column</th>
                  <th className="table-th">Sample Value</th>
                  <th className="table-th">Maps To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sheetRows.headers.map((h) => (
                  <tr key={h}>
                    <td className="table-td font-medium">{h}</td>
                    <td className="table-td max-w-[220px] truncate text-gray-400" title={sheetRows.rows[0]?.[h]}>{sheetRows.rows[0]?.[h] || '—'}</td>
                    <td className="table-td">
                      <select
                        className="input"
                        value={mapping[h] ?? 'ignore'}
                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as TargetKey })}
                      >
                        {groupedFields.map(([group, fields]) => (
                          <optgroup key={group} label={group}>
                            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => setStep(3)}><ArrowLeft size={16} /> Back</button>
            <button className="btn-primary" onClick={proceedToReview}>Preview <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 5: Review & import */}
      {step === 5 && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className="badge bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200">{readyCount} ready</span>
            {errorCount > 0 && <span className="badge bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200">{errorCount} with errors</span>}
            {duplicateCount > 0 && <span className="badge bg-saffron-100 text-saffron-700 dark:bg-saffron-900/50 dark:text-saffron-200">{duplicateCount} possible duplicates</span>}
            <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{importedRows.length} total rows</span>
          </div>

          <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-lg max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950/50 sticky top-0">
                <tr>
                  <th className="table-th w-10"></th>
                  <th className="table-th">Row</th>
                  <th className="table-th">Exporter</th>
                  <th className="table-th">Buyer</th>
                  <th className="table-th">Country</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {importedRows.map((r) => (
                  <tr key={r.rowNumber} className={cn(!r.include && 'opacity-50')}>
                    <td className="table-td">
                      <input type="checkbox" checked={r.include} onChange={() => toggleInclude(r.rowNumber)} disabled={r.errors.length > 0} />
                    </td>
                    <td className="table-td text-gray-400">{r.rowNumber}</td>
                    <td className="table-td max-w-[160px] truncate" title={r.activity.exporter.exporterName}>{r.activity.exporter.exporterName || '—'}</td>
                    <td className="table-td max-w-[160px] truncate" title={r.activity.buyer.buyerName}>{r.activity.buyer.buyerName || '—'}</td>
                    <td className="table-td">{r.activity.buyer.country || '—'}</td>
                    <td className="table-td">
                      {r.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300" title={r.errors.map((e) => e.message).join('\n')}>
                          <AlertTriangle size={13} /> {r.errors.length} error{r.errors.length > 1 ? 's' : ''}
                        </span>
                      ) : r.duplicate ? (
                        <span className="inline-flex items-center gap-1 text-saffron-600 dark:text-saffron-300" title="Same office, date, exporter and buyer already exist.">
                          <AlertTriangle size={13} /> Possible duplicate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-300"><CheckCircle2 size={13} /> Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importing && (
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-fieo-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-gray-500">Importing {progress.done} / {progress.total}{progress.failed > 0 ? ` (${progress.failed} failed)` : ''}…</p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => setStep(4)} disabled={importing}><ArrowLeft size={16} /> Back</button>
            <button className="btn-primary" onClick={runImport} disabled={importing || readyCount === 0}>
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? 'Importing…' : `Import ${readyCount} Activit${readyCount === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Done */}
      {step === 6 && (
        <div className="card p-8">
          <EmptyState
            icon={<CheckCircle2 size={28} className="text-green-500" />}
            title="Import complete"
            message={`${progress.done - progress.failed} activities imported${progress.failed > 0 ? `, ${progress.failed} failed` : ''}. Head to the Activities page to review them.`}
            action={
              <div className="flex gap-2 justify-center">
                <button className="btn-secondary" onClick={reset}><RotateCcw size={16} /> Import Another File</button>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

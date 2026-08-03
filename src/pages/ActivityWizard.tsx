import type { Activity, Currency, DocumentKind, EventType, StoredDocument } from '@/types';
import { COUNTRIES, CURRENCIES, EVENT_TYPES, PRODUCT_CATEGORIES, REGIONAL_OFFICES } from '@/types';
import { useState, useEffect, useId, cloneElement, isValidElement, type ReactElement } from 'react';
import {
  CalendarDays, Building2, Users, Handshake, ShoppingCart, MessageSquare,
  Check, ChevronLeft, ChevronRight, Upload, FileText, X, Save, AlertCircle,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { nextActivityId, saveDraft, loadDraft } from '@/data/repository';
import { validateActivity, isDuplicateActivity, passportFormatHint } from '@/data/validation';

const STEPS = [
  { id: 1, label: 'Event Details', icon: CalendarDays },
  { id: 2, label: 'Exporter Details', icon: Building2 },
  { id: 3, label: 'Buyer Details', icon: Users },
  { id: 4, label: 'Outcome Tracking', icon: Handshake },
  { id: 5, label: 'Remarks & Documents', icon: MessageSquare },
];

function emptyActivity(id: string, createdBy: string, createdByName: string, role: 'admin' | 'regional', office: string): Activity {
  return {
    id,
    event: { regionalOffice: role === 'regional' ? office : '', bsmName: '', eventDate: '', venue: '', city: '', state: '', country: 'India', eventType: 'Buyer-Seller Meet', exporterCount: 0, buyerCount: 0 },
    exporter: { exporterName: '', iecNumber: '', companyName: '', productCategory: '', email: '', phone: '', website: '', address: '' },
    buyer: { buyerName: '', company: '', country: '', city: '', email: '', phone: '', interestedProducts: '', meetingCount: 1, passportNumber: '' },
    mou: { signed: false },
    orderInProcess: { active: false },
    orderPlaced: { placed: false },
    remarks: { general: '', challenges: '', successStory: '', followUpRequired: false },
    documents: [],
    status: 'Draft',
    createdBy,
    createdByName,
    createdByRole: role,
    createdByOffice: office,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface ActivityWizardProps {
  open: boolean;
  onClose: () => void;
  onSave: (a: Activity, removedDocumentIds?: string[]) => Promise<void>;
  editing?: Activity | null;
  all: Activity[];
}

export function ActivityWizard({ open, onClose, onSave, editing, all }: ActivityWizardProps) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [step, setStep] = useState(1);
  const [activity, setActivity] = useState<Activity>(() => editing ?? emptyActivity(nextActivityId(), user?.id ?? '', user?.name ?? '', (user?.role ?? 'admin'), user?.regionalOffice ?? ''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Documents present when this edit session opened. Only IDs from this set
  // that the user actively removes are deleted on save — see the comment on
  // persistDocuments() in repository.ts for why a full diff against the DB
  // isn't used (it can delete another user's concurrently-added document).
  const [initialDocIds, setInitialDocIds] = useState<Set<string>>(new Set());
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  // Tracks whether the Interested Products field is in free-text "Other" mode,
  // separate from the stored value itself (which may legitimately be empty
  // while the user is still typing their custom entry).
  const [buyerProductMode, setBuyerProductMode] = useState<'category' | 'other'>('category');

  // Reverse BSM collects Exporter Details / Outcome Tracking / Remarks & Documents.
  // Every other event type (Buyer-Seller Meet, Trade Delegation, Virtual BSM, Exhibition)
  // only collects Buyer Details. Event Details is always required.
  const isReverseBSM = activity.event.eventType === 'Reverse BSM';
  const activeStepIds = isReverseBSM ? [1, 2, 4, 5] : [1, 3];

  // If the event type changes such that the current step is no longer part of
  // the applicable flow (e.g. user was on Buyer Details and switched to
  // Reverse BSM), snap back to the first applicable step.
  useEffect(() => {
    if (!activeStepIds.includes(step)) setStep(activeStepIds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReverseBSM]);

  // Reset when opening with a different record.
  const [lastKey, setLastKey] = useState<string>('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (open && key !== lastKey) {
    setLastKey(key);
    const base = editing ?? emptyActivity(nextActivityId(), user?.id ?? '', user?.name ?? '', user?.role ?? 'admin', user?.regionalOffice ?? '');
    const draft = editing ? null : loadDraft();
    // Identity/audit fields (id, createdBy, etc.) must always reflect the
    // CURRENT session's user — never a cached draft. A stale draft saved
    // under an older app version (e.g. before createdBy held a UUID
    // instead of a display name) would otherwise silently reintroduce
    // exactly that bug by overwriting the freshly-computed correct value.
    // This also protects against a stale draft leaking one user's
    // identity into another user's session on a shared browser.
    const initial = draft
      ? {
          ...base,
          ...draft,
          id: base.id,
          createdBy: base.createdBy,
          createdByName: base.createdByName,
          createdByRole: base.createdByRole,
          createdByOffice: base.createdByOffice,
        }
      : base;
    setActivity(initial);
    setInitialDocIds(new Set(initial.documents.map((d) => d.id)));
    setRemovedDocumentIds([]);
    setBuyerProductMode(
      initial.buyer.interestedProducts && !PRODUCT_CATEGORIES.includes(initial.buyer.interestedProducts)
        ? 'other'
        : 'category',
    );
    setStep(1);
    setErrors({});
  }

  const update = (patch: Partial<Activity>) => {
    setActivity((prev) => {
      const next = { ...prev, ...patch };
      if (!editing) saveDraft(next); // auto-save draft
      return next;
    });
  };

  const validateStep = (s: number): boolean => {
    const all = validateActivity(activity);
    const stepFields: Record<number, string[]> = {
      1: ['event.regionalOffice', 'event.eventDate'],
      2: ['exporter.exporterName', 'exporter.productCategory', 'exporter.iecNumber', 'exporter.email', 'exporter.phone'],
      3: ['buyer.buyerName', 'buyer.country', 'buyer.phone', 'buyer.passportNumber'],
      4: [],
      5: [],
    };
    const relevant = all.filter((e) => stepFields[s].includes(e.field));
    if (relevant.length) {
      const map: Record<string, string> = {};
      relevant.forEach((e) => (map[e.field] = e.message));
      setErrors(map);
      return false;
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    const idx = activeStepIds.indexOf(step);
    const nextId = activeStepIds[idx + 1];
    if (nextId !== undefined) setStep(nextId);
  };
  const back = () => {
    const idx = activeStepIds.indexOf(step);
    const prevId = activeStepIds[idx - 1];
    if (prevId !== undefined) setStep(prevId);
  };
  const isFirstActiveStep = step === activeStepIds[0];
  const isLastActiveStep = step === activeStepIds[activeStepIds.length - 1];

  const submit = async () => {
    // Validate all steps
    const allErrs = validateActivity(activity);
    if (allErrs.length) {
      const map: Record<string, string> = {};
      allErrs.forEach((e) => (map[e.field] = e.message));
      setErrors(map);
      // jump to first errored step
      const firstField = allErrs[0].field;
      if (firstField.startsWith('event')) setStep(1);
      else if (firstField.startsWith('exporter')) setStep(2);
      else if (firstField.startsWith('buyer')) setStep(3);
      else if (firstField.startsWith('mou') || firstField.startsWith('order')) setStep(4);
      notify('Please fix the highlighted fields before saving.', 'error');
      return;
    }
    if (isDuplicateActivity(activity, all)) {
      notify('A duplicate activity with the same office, date, exporter and buyer already exists.', 'error');
      return;
    }
    setSaving(true);
    const status: Activity['status'] =
      activity.orderPlaced.placed ? 'Completed'
      : activity.orderInProcess.active ? 'In Process'
      : activity.remarks.followUpRequired ? 'Follow-up Required'
      : 'Completed';
    const toSave: Activity = { ...activity, status };
    try {
      await onSave(toSave, removedDocumentIds);
      if (!editing) saveDraft(null);
      notify(editing ? 'Activity updated successfully.' : 'Activity created successfully.');
      onClose();
    } catch (err) {
      console.error('ActivityWizard: failed to save activity', err);
      notify(err instanceof Error ? err.message : 'Failed to save activity. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const err = (field: string) => errors[field];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit Activity — ${editing.id}` : 'New Activity Entry'}
      subtitle="Multi-step Buyer-Seller Meet outcome form"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {editing ? 'Editing existing record' : 'Draft auto-saved'}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={isFirstActiveStep ? onClose : back}>
              <ChevronLeft size={16} /> {isFirstActiveStep ? 'Cancel' : 'Back'}
            </button>
            {!isLastActiveStep ? (
              <button className="btn-primary" onClick={next}>Next <ChevronRight size={16} /></button>
            ) : (
              <button className="btn-primary" onClick={submit} disabled={saving}>
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                {editing ? 'Update' : 'Save Activity'}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Stepper */}
      <ol className="flex items-center mb-6 overflow-x-auto pb-1">
        {STEPS.filter((s) => activeStepIds.includes(s.id)).map((s, i, visible) => {
          const done = step > s.id;
          const active = step === s.id;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition',
                  active ? 'bg-fieo-50 dark:bg-fieo-900/40 text-fieo-700 dark:text-fieo-200 font-medium'
                    : done ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500',
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition',
                  active ? 'border-fieo-600 bg-fieo-600 text-white'
                    : done ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-400',
                )}>
                  {done ? <Check size={14} /> : <Icon size={14} />}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < visible.length - 1 && <span className={cn('w-6 sm:w-10 h-px mx-1', done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700')} />}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-gray-400 -mt-4 mb-4">
        {isReverseBSM
          ? 'Reverse BSM: enter Exporter Details, Outcome Tracking and Remarks & Documents.'
          : 'Enter Buyer Details for this event.'}
      </p>

      <div className="animate-fade-in">
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Regional Office" required error={err('event.regionalOffice')}>
              <select className="input" value={activity.event.regionalOffice} onChange={(e) => update({ event: { ...activity.event, regionalOffice: e.target.value } })}>
                <option value="">Select office…</option>
                {REGIONAL_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="BSM Name">
              <input className="input" value={activity.event.bsmName} onChange={(e) => update({ event: { ...activity.event, bsmName: e.target.value } })} placeholder="e.g. BSM USA 2024" />
            </Field>
            <Field label="Event Date" required error={err('event.eventDate')}>
              <input type="date" className="input" value={activity.event.eventDate} onChange={(e) => update({ event: { ...activity.event, eventDate: e.target.value } })} />
            </Field>
            <Field label="Event Type">
              <select className="input" value={activity.event.eventType} onChange={(e) => update({ event: { ...activity.event, eventType: e.target.value as EventType } })}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Venue">
              <input className="input" value={activity.event.venue} onChange={(e) => update({ event: { ...activity.event, venue: e.target.value } })} placeholder="Convention centre / hotel" />
            </Field>
            <Field label="City">
              <input className="input" value={activity.event.city} onChange={(e) => update({ event: { ...activity.event, city: e.target.value } })} />
            </Field>
            <Field label="State">
              <input className="input" value={activity.event.state} onChange={(e) => update({ event: { ...activity.event, state: e.target.value } })} />
            </Field>
            <Field label="Country">
              <select className="input" value={activity.event.country} onChange={(e) => update({ event: { ...activity.event, country: e.target.value } })}>
                <option value="India">India</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="No. of Exporters">
              <input type="number" min="0" className="input" value={activity.event.exporterCount} onChange={(e) => update({ event: { ...activity.event, exporterCount: +e.target.value } })} />
            </Field>
            <Field label="No. of Buyers">
              <input type="number" min="0" className="input" value={activity.event.buyerCount} onChange={(e) => update({ event: { ...activity.event, buyerCount: +e.target.value } })} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Exporter Name" required error={err('exporter.exporterName')}>
              <input className="input" value={activity.exporter.exporterName} onChange={(e) => update({ exporter: { ...activity.exporter, exporterName: e.target.value } })} placeholder="Contact person" />
            </Field>
            <Field label="IEC Number" error={err('exporter.iecNumber')} hint="8–12 alphanumeric characters, no spaces or special characters">
              <input className="input" maxLength={12} value={activity.exporter.iecNumber} onChange={(e) => update({ exporter: { ...activity.exporter, iecNumber: e.target.value.replace(/[^A-Za-z0-9]/g, '') } })} placeholder="e.g. ABCD123456" />
            </Field>
            <Field label="Company Name">
              <input className="input" value={activity.exporter.companyName} onChange={(e) => update({ exporter: { ...activity.exporter, companyName: e.target.value } })} />
            </Field>
            <Field label="Product Category" required error={err('exporter.productCategory')}>
              <select className="input" value={activity.exporter.productCategory} onChange={(e) => update({ exporter: { ...activity.exporter, productCategory: e.target.value } })}>
                <option value="">Select category…</option>
                {PRODUCT_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Email" error={err('exporter.email')}>
              <input type="email" className="input" value={activity.exporter.email} onChange={(e) => update({ exporter: { ...activity.exporter, email: e.target.value } })} placeholder="name@company.in" />
            </Field>
            <Field label="Phone" error={err('exporter.phone')}>
              <input className="input" value={activity.exporter.phone} onChange={(e) => update({ exporter: { ...activity.exporter, phone: e.target.value } })} placeholder="+91 98XXXXXXXX" />
            </Field>
            <Field label="Website">
              <input className="input" value={activity.exporter.website} onChange={(e) => update({ exporter: { ...activity.exporter, website: e.target.value } })} placeholder="www.company.in" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <textarea className="input min-h-[72px]" value={activity.exporter.address} onChange={(e) => update({ exporter: { ...activity.exporter, address: e.target.value } })} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Buyer Name" required error={err('buyer.buyerName')}>
              <input className="input" value={activity.buyer.buyerName} onChange={(e) => update({ buyer: { ...activity.buyer, buyerName: e.target.value } })} placeholder="Contact person" />
            </Field>
            <Field label="Company Name">
              <input className="input" value={activity.buyer.company} onChange={(e) => update({ buyer: { ...activity.buyer, company: e.target.value } })} />
            </Field>
            <Field label="Country" required error={err('buyer.country')}>
              <select
                className="input"
                value={activity.buyer.country}
                onChange={(e) => update({ buyer: { ...activity.buyer, country: e.target.value } })}
              >
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Phone / WhatsApp Number" required error={err('buyer.phone')}>
              <input className="input" value={activity.buyer.phone} onChange={(e) => update({ buyer: { ...activity.buyer, phone: e.target.value } })} placeholder="+1 555XXXXXXX" />
            </Field>
            <Field
              label="Passport Number"
              required
              error={err('buyer.passportNumber')}
              hint={activity.buyer.country ? passportFormatHint(activity.buyer.country) : 'Select a country first'}
            >
              <input
                className="input uppercase"
                disabled={!activity.buyer.country}
                value={activity.buyer.passportNumber}
                onChange={(e) => update({ buyer: { ...activity.buyer, passportNumber: e.target.value.toUpperCase() } })}
                placeholder="e.g. A1234567"
              />
            </Field>
            <Field label="Interested Products" className="sm:col-span-2">
              <select
                className="input"
                value={buyerProductMode === 'other' ? 'Other' : activity.buyer.interestedProducts}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'Other') {
                    setBuyerProductMode('other');
                    update({ buyer: { ...activity.buyer, interestedProducts: '' } });
                  } else {
                    setBuyerProductMode('category');
                    update({ buyer: { ...activity.buyer, interestedProducts: v } });
                  }
                }}
              >
                <option value="">Select product category…</option>
                {PRODUCT_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {buyerProductMode === 'other' && (
                <input
                  className="input mt-2"
                  value={activity.buyer.interestedProducts}
                  onChange={(e) => update({ buyer: { ...activity.buyer, interestedProducts: e.target.value } })}
                  placeholder="Describe the products the buyer is interested in"
                  autoFocus
                />
              )}
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {/* MoU */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Toggle label="MoU Signed" checked={activity.mou.signed} onChange={(v) => update({ mou: { ...activity.mou, signed: v } })} icon={<Handshake size={16} />} />
              {activity.mou.signed && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <Field label="Expected Value">
                    <input type="number" min="0" className="input" value={activity.mou.expectedValue ?? ''} onChange={(e) => update({ mou: { ...activity.mou, expectedValue: +e.target.value || undefined } })} />
                  </Field>
                  <Field label="Currency">
                    <select className="input" value={activity.mou.currency ?? 'USD'} onChange={(e) => update({ mou: { ...activity.mou, currency: e.target.value as Currency } })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Expected Timeline">
                    <input className="input" value={activity.mou.expectedTimeline ?? ''} onChange={(e) => update({ mou: { ...activity.mou, expectedTimeline: e.target.value } })} placeholder="e.g. 3 months" />
                  </Field>
                </div>
              )}
            </div>

            {/* Order in process */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Toggle label="Order In Process" checked={activity.orderInProcess.active} onChange={(v) => update({ orderInProcess: { ...activity.orderInProcess, active: v } })} icon={<Package size={16} />} />
              {activity.orderInProcess.active && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <Field label="Estimated Value">
                    <input type="number" min="0" className="input" value={activity.orderInProcess.estimatedValue ?? ''} onChange={(e) => update({ orderInProcess: { ...activity.orderInProcess, estimatedValue: +e.target.value || undefined } })} />
                  </Field>
                  <Field label="Currency">
                    <select className="input" value={activity.orderInProcess.currency ?? 'USD'} onChange={(e) => update({ orderInProcess: { ...activity.orderInProcess, currency: e.target.value as Currency } })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Expected Closure Date">
                    <input type="date" className="input" value={activity.orderInProcess.expectedClosureDate ?? ''} onChange={(e) => update({ orderInProcess: { ...activity.orderInProcess, expectedClosureDate: e.target.value } })} />
                  </Field>
                  <Field label="Probability (%)" error={err('orderInProcess.probability')}>
                    <input type="number" min="0" max="100" className="input" value={activity.orderInProcess.probability ?? ''} onChange={(e) => update({ orderInProcess: { ...activity.orderInProcess, probability: +e.target.value || undefined } })} />
                  </Field>
                  <Field label="Remarks" className="lg:col-span-2">
                    <input className="input" value={activity.orderInProcess.remarks ?? ''} onChange={(e) => update({ orderInProcess: { ...activity.orderInProcess, remarks: e.target.value } })} />
                  </Field>
                </div>
              )}
            </div>

            {/* Order placed */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Toggle label="Order Placed" checked={activity.orderPlaced.placed} onChange={(v) => update({ orderPlaced: { ...activity.orderPlaced, placed: v } })} icon={<ShoppingCart size={16} />} />
              {activity.orderPlaced.placed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <Field label="Final Order Value">
                    <input type="number" min="0" className="input" value={activity.orderPlaced.finalValue ?? ''} onChange={(e) => update({ orderPlaced: { ...activity.orderPlaced, finalValue: +e.target.value || undefined } })} />
                  </Field>
                  <Field label="Currency">
                    <select className="input" value={activity.orderPlaced.currency ?? 'USD'} onChange={(e) => update({ orderPlaced: { ...activity.orderPlaced, currency: e.target.value as Currency } })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Purchase Order Number">
                    <input className="input" value={activity.orderPlaced.purchaseOrderNumber ?? ''} onChange={(e) => update({ orderPlaced: { ...activity.orderPlaced, purchaseOrderNumber: e.target.value } })} />
                  </Field>
                  <Field label="Order Date">
                    <input type="date" className="input" value={activity.orderPlaced.orderDate ?? ''} onChange={(e) => update({ orderPlaced: { ...activity.orderPlaced, orderDate: e.target.value } })} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <Field label="General Remarks">
                <textarea className="input min-h-[64px]" value={activity.remarks.general} onChange={(e) => update({ remarks: { ...activity.remarks, general: e.target.value } })} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Challenges Faced">
                  <textarea className="input min-h-[64px]" value={activity.remarks.challenges} onChange={(e) => update({ remarks: { ...activity.remarks, challenges: e.target.value } })} />
                </Field>
                <Field label="Success Story">
                  <textarea className="input min-h-[64px]" value={activity.remarks.successStory} onChange={(e) => update({ remarks: { ...activity.remarks, successStory: e.target.value } })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Toggle label="Future Follow-up Required" checked={activity.remarks.followUpRequired} onChange={(v) => update({ remarks: { ...activity.remarks, followUpRequired: v } })} icon={<CalendarDays size={16} />} />
                <Field label="Next Follow-up Date">
                  <input type="date" className="input" value={activity.remarks.nextFollowUpDate ?? ''} onChange={(e) => update({ remarks: { ...activity.remarks, nextFollowUpDate: e.target.value } })} disabled={!activity.remarks.followUpRequired} />
                </Field>
              </div>
            </div>

            {/* Documents */}
            <DocumentUploader
              documents={activity.documents}
              onChange={(documents) => update({ documents })}
              onRemove={(id) => {
                if (initialDocIds.has(id)) setRemovedDocumentIds((prev) => [...prev, id]);
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------- Small field primitives ----------

function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {child}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <span className="text-fieo-600 dark:text-fieo-300">{icon}</span>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative w-11 h-6 rounded-full transition', checked ? 'bg-fieo-600' : 'bg-gray-300 dark:bg-gray-700')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

// ---------- Document uploader ----------

const DOC_KINDS: DocumentKind[] = ['MoU', 'Purchase Order', 'Invoice', 'Photograph', 'Meeting Minutes', 'Other'];

function DocumentUploader({ documents, onChange, onRemove }: { documents: StoredDocument[]; onChange: (d: StoredDocument[]) => void; onRemove: (id: string) => void }) {
  const { notify } = useToast();

  const handleFiles = async (files: FileList, kind: DocumentKind) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const newDocs: StoredDocument[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        notify(`${file.name} exceeds 5 MB limit.`, 'warning');
        continue;
      }
      if (!allowed.includes(file.type) && !/\.(pdf|png|jpe?g|docx?|jpg)$/i.test(file.name)) {
        notify(`${file.name}: unsupported file type.`, 'warning');
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      newDocs.push({
        id: crypto.randomUUID(),
        kind,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        dataUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }
    onChange([...documents, ...newDocs]);
    if (newDocs.length) notify(`${newDocs.length} file(s) uploaded.`, 'success');
  };

  const remove = (id: string) => { onChange(documents.filter((d) => d.id !== id)); onRemove(id); };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <Upload size={16} className="text-fieo-600" /> Supporting Documents
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {DOC_KINDS.map((kind) => (
          <label key={kind} className="btn-secondary cursor-pointer justify-center text-xs py-2 hover:border-fieo-400">
            <Upload size={14} /> {kind}
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files, kind)} />
          </label>
        ))}
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No documents uploaded yet. MoU, PO, invoices, photos and minutes are supported (PDF, DOCX, PNG, JPG — max 5 MB).</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <span className="w-8 h-8 rounded-lg bg-fieo-100 dark:bg-fieo-900/50 text-fieo-600 dark:text-fieo-300 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{d.name}</p>
                <p className="text-[11px] text-gray-400">{d.kind} · {(d.size / 1024).toFixed(0)} KB</p>
              </div>
              <a href={d.dataUrl} download={d.name} className="btn-ghost p-1.5 rounded-md" aria-label={`Download ${d.name}`}>Download</a>
              <button onClick={() => remove(d.id)} className="btn-ghost p-1.5 rounded-md text-red-500" aria-label={`Remove ${d.name}`}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Local import to satisfy the Package icon used in step 4 toggle.
import { Package } from 'lucide-react';

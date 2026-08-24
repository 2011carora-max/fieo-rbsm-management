import { supabase, DOCUMENTS_BUCKET } from '@/lib/supabaseClient';
import { assertUuidOrNull, assertUuid } from '@/data/validation';
import { classifyOutcomeFromRemark } from '@/data/outcomeClassifier';
import type { Activity, AppSettings, StoredDocument, User } from '@/types';

// Repository — the single data-access surface for the app.
// Backed by Supabase (Postgres + Auth + Storage). All reads/writes go through
// here so the UI never touches the Supabase client directly.
//
// Activities are stored as a flat row in the `activities` table (see
// supabase/migrations) and mapped to/from the nested `Activity` shape here,
// so the rest of the app (forms, analytics, reports) is unaffected by the
// underlying table layout.

// ---------- row <-> Activity mapping ----------

interface ActivityRow {
  id: string;
  event_regional_office: string;
  event_bsm_name: string;
  event_date: string;
  event_venue: string;
  event_city: string;
  event_state: string;
  event_country: string;
  event_type: string;
  event_exporter_count: number;
  event_buyer_count: number;
  exporter_name: string;
  exporter_iec_number: string | null;
  exporter_company_name: string | null;
  exporter_product_category: string | null;
  exporter_email: string | null;
  exporter_phone: string | null;
  exporter_website: string | null;
  exporter_address: string | null;
  buyer_name: string;
  buyer_company: string | null;
  buyer_country: string;
  buyer_city: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_interested_products: string | null;
  buyer_meeting_count: number;
  buyer_passport_number: string | null;
  mou_signed: boolean;
  mou_expected_value: number | null;
  mou_currency: string | null;
  mou_expected_timeline: string | null;
  mou_document_id: string | null;
  order_in_process_active: boolean;
  order_in_process_estimated_value: number | null;
  order_in_process_currency: string | null;
  order_in_process_expected_closure_date: string | null;
  order_in_process_probability: number | null;
  order_in_process_remarks: string | null;
  order_placed: boolean;
  order_placed_final_value: number | null;
  order_placed_currency: string | null;
  order_placed_po_number: string | null;
  order_placed_order_date: string | null;
  order_placed_document_id: string | null;
  remarks_general: string | null;
  remarks_challenges: string | null;
  remarks_success_story: string | null;
  remarks_followup_required: boolean;
  remarks_next_followup_date: string | null;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
  created_by_role: string;
  created_by_office: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  activity_id: string;
  kind: string;
  name: string;
  mime: string;
  storage_path: string;
  size: number;
  uploaded_at: string;
}

async function signedUrlFor(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error || !data) return '';
  return data.signedUrl;
}

async function docRowToStoredDocument(d: DocumentRow, hydrateUrl: boolean): Promise<StoredDocument> {
  return {
    id: d.id,
    kind: d.kind as StoredDocument['kind'],
    name: d.name,
    mime: d.mime,
    // Generating a signed URL is a Storage API round-trip per document.
    // Skipped for bulk/metadata-only reads (see listActivities) so pages
    // that never render a document link (Dashboard, Reports, Analytics,
    // the Activities table) don't pay that cost on every load.
    dataUrl: hydrateUrl ? await signedUrlFor(d.storage_path) : '',
    size: d.size,
    uploadedAt: d.uploaded_at,
  };
}

async function rowToActivity(row: ActivityRow, docs: DocumentRow[], hydrateDocUrls: boolean): Promise<Activity> {
  const documents = await Promise.all(docs.map((d) => docRowToStoredDocument(d, hydrateDocUrls)));
  return {
    id: row.id,
    event: {
      regionalOffice: row.event_regional_office,
      bsmName: row.event_bsm_name,
      eventDate: row.event_date,
      venue: row.event_venue,
      city: row.event_city,
      state: row.event_state,
      country: row.event_country,
      eventType: row.event_type as Activity['event']['eventType'],
      exporterCount: row.event_exporter_count,
      buyerCount: row.event_buyer_count,
    },
    exporter: {
      exporterName: row.exporter_name,
      iecNumber: row.exporter_iec_number ?? '',
      companyName: row.exporter_company_name ?? '',
      productCategory: row.exporter_product_category ?? '',
      email: row.exporter_email ?? '',
      phone: row.exporter_phone ?? '',
      website: row.exporter_website ?? '',
      address: row.exporter_address ?? '',
    },
    buyer: {
      buyerName: row.buyer_name,
      company: row.buyer_company ?? '',
      country: row.buyer_country,
      city: row.buyer_city ?? '',
      email: row.buyer_email ?? '',
      phone: row.buyer_phone ?? '',
      interestedProducts: row.buyer_interested_products ?? '',
      meetingCount: row.buyer_meeting_count,
      passportNumber: row.buyer_passport_number ?? '',
    },
    mou: {
      signed: row.mou_signed,
      expectedValue: row.mou_expected_value ?? undefined,
      currency: (row.mou_currency as Activity['mou']['currency']) ?? undefined,
      expectedTimeline: row.mou_expected_timeline ?? undefined,
      documentId: row.mou_document_id ?? undefined,
    },
    orderInProcess: {
      active: row.order_in_process_active,
      estimatedValue: row.order_in_process_estimated_value ?? undefined,
      currency: (row.order_in_process_currency as Activity['orderInProcess']['currency']) ?? undefined,
      expectedClosureDate: row.order_in_process_expected_closure_date ?? undefined,
      probability: row.order_in_process_probability ?? undefined,
      remarks: row.order_in_process_remarks ?? undefined,
    },
    orderPlaced: {
      placed: row.order_placed,
      finalValue: row.order_placed_final_value ?? undefined,
      currency: (row.order_placed_currency as Activity['orderPlaced']['currency']) ?? undefined,
      purchaseOrderNumber: row.order_placed_po_number ?? undefined,
      orderDate: row.order_placed_order_date ?? undefined,
      documentId: row.order_placed_document_id ?? undefined,
    },
    remarks: {
      general: row.remarks_general ?? '',
      challenges: row.remarks_challenges ?? '',
      successStory: row.remarks_success_story ?? '',
      followUpRequired: row.remarks_followup_required,
      nextFollowUpDate: row.remarks_next_followup_date ?? undefined,
    },
    documents,
    status: row.status as Activity['status'],
    createdBy: row.created_by ?? '',
    createdByName: row.created_by_name ?? '',
    createdByRole: row.created_by_role as Activity['createdByRole'],
    createdByOffice: row.created_by_office ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function activityToRow(a: Activity): Omit<ActivityRow, 'created_at' | 'updated_at'> {
  return {
    id: a.id,
    event_regional_office: a.event.regionalOffice,
    event_bsm_name: a.event.bsmName,
    event_date: a.event.eventDate,
    event_venue: a.event.venue,
    event_city: a.event.city,
    event_state: a.event.state,
    event_country: a.event.country,
    event_type: a.event.eventType,
    event_exporter_count: a.event.exporterCount,
    event_buyer_count: a.event.buyerCount,
    exporter_name: a.exporter.exporterName,
    exporter_iec_number: a.exporter.iecNumber || null,
    exporter_company_name: a.exporter.companyName || null,
    exporter_product_category: a.exporter.productCategory || null,
    exporter_email: a.exporter.email || null,
    exporter_phone: a.exporter.phone || null,
    exporter_website: a.exporter.website || null,
    exporter_address: a.exporter.address || null,
    buyer_name: a.buyer.buyerName,
    buyer_company: a.buyer.company || null,
    buyer_country: a.buyer.country,
    buyer_city: a.buyer.city || null,
    buyer_email: a.buyer.email || null,
    buyer_phone: a.buyer.phone || null,
    buyer_interested_products: a.buyer.interestedProducts || null,
    buyer_meeting_count: a.buyer.meetingCount,
    buyer_passport_number: a.buyer.passportNumber || null,
    mou_signed: a.mou.signed,
    mou_expected_value: a.mou.expectedValue ?? null,
    mou_currency: a.mou.currency ?? null,
    mou_expected_timeline: a.mou.expectedTimeline ?? null,
    mou_document_id: assertUuidOrNull(a.mou.documentId, 'mou.documentId'),
    order_in_process_active: a.orderInProcess.active,
    order_in_process_estimated_value: a.orderInProcess.estimatedValue ?? null,
    order_in_process_currency: a.orderInProcess.currency ?? null,
    order_in_process_expected_closure_date: a.orderInProcess.expectedClosureDate ?? null,
    order_in_process_probability: a.orderInProcess.probability ?? null,
    order_in_process_remarks: a.orderInProcess.remarks ?? null,
    order_placed: a.orderPlaced.placed,
    order_placed_final_value: a.orderPlaced.finalValue ?? null,
    order_placed_currency: a.orderPlaced.currency ?? null,
    order_placed_po_number: a.orderPlaced.purchaseOrderNumber ?? null,
    order_placed_order_date: a.orderPlaced.orderDate ?? null,
    order_placed_document_id: assertUuidOrNull(a.orderPlaced.documentId, 'orderPlaced.documentId'),
    remarks_general: a.remarks.general || null,
    remarks_challenges: a.remarks.challenges || null,
    remarks_success_story: a.remarks.successStory || null,
    remarks_followup_required: a.remarks.followUpRequired,
    remarks_next_followup_date: a.remarks.nextFollowUpDate ?? null,
    status: a.status,
    created_by: assertUuidOrNull(a.createdBy, 'createdBy'),
    created_by_name: a.createdByName || null,
    created_by_role: a.createdByRole,
    created_by_office: a.createdByOffice || null,
  };
}

// ---------- Activities ----------

/**
 * Shared list used by useActivities() (Dashboard, Reports, Analytics, the
 * Activities table). Document metadata is included but dataUrl is left
 * empty — none of those pages render a document link, so there's no reason
 * to pay for a signed-URL round trip per document on every load. Pages
 * that do need real links call listActivitiesWithDocumentUrls() or
 * getActivity() instead (see below).
 */
export async function listActivities(): Promise<Activity[]> {
  return listActivitiesInternal(false);
}

/** Same as listActivities(), but with real signed document URLs. Used only
 * by DocumentsPage, which is the one place that renders every document's
 * thumbnail/download link across the whole visible activity set. */
export async function listActivitiesWithDocumentUrls(): Promise<Activity[]> {
  return listActivitiesInternal(true);
}

async function listActivitiesInternal(hydrateDocUrls: boolean): Promise<Activity[]> {
  const { data: rows, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select('*')
    .in('activity_id', rows.map((r) => r.id));
  if (docErr) throw docErr;

  const docsByActivity = new Map<string, DocumentRow[]>();
  for (const d of (docs ?? []) as DocumentRow[]) {
    const list = docsByActivity.get(d.activity_id) ?? [];
    list.push(d);
    docsByActivity.set(d.activity_id, list);
  }

  return Promise.all((rows as ActivityRow[]).map((r) => rowToActivity(r, docsByActivity.get(r.id) ?? [], hydrateDocUrls)));
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  const { data: row, error } = await supabase.from('activities').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!row) return undefined;

  const { data: docs, error: docErr } = await supabase.from('documents').select('*').eq('activity_id', id);
  if (docErr) throw docErr;

  return rowToActivity(row as ActivityRow, (docs ?? []) as DocumentRow[], true);
}

// New/changed documents (those with a dataUrl that isn't already a signed
// storage URL, i.e. freshly picked files) are uploaded to Storage first;
// existing documents are left as-is.
//
// removedDocumentIds must be an explicit list of IDs the user actually
// clicked "remove" on in this edit session — NOT inferred by diffing the
// incoming `documents` array against whatever's currently in the DB. Two
// people editing the same activity at once each hold a snapshot from when
// they opened it; if office A adds a document while office B is mid-edit,
// a diff-based approach would see B's (stale) snapshot as "missing" A's new
// document and delete it. Explicit removal tracking avoids that lost update.
async function persistDocuments(activityId: string, documents: StoredDocument[], removedDocumentIds: string[] = []): Promise<void> {
  if (removedDocumentIds.length) {
    const { data: toRemove } = await supabase.from('documents').select('storage_path').in('id', removedDocumentIds);
    if (toRemove && toRemove.length) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove(toRemove.map((d) => d.storage_path as string));
    }
    await supabase.from('documents').delete().in('id', removedDocumentIds);
  }

  const { data: existingRows } = await supabase.from('documents').select('id').eq('activity_id', activityId);
  const existingIds = new Set((existingRows ?? []).map((r) => r.id as string));

  for (const doc of documents) {
    if (existingIds.has(doc.id)) continue; // already persisted, storage file untouched

    // doc.dataUrl is a base64 data URL at this point (fresh upload from the wizard).
    const res = await fetch(doc.dataUrl);
    const blob = await res.blob();
    // Storage treats "/" as a folder separator and the RLS policy on
    // storage.objects parses the first path segment as the activity id —
    // strip slashes (and other path-unsafe chars) from the filename so a
    // document named e.g. "Q1/Q2 report.pdf" can't corrupt that structure.
    const safeName = doc.name.replace(/[/\\]/g, '_');
    const storagePath = `${activityId}/${doc.id}-${safeName}`;

    const { error: uploadErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storagePath, blob, {
      contentType: doc.mime,
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    const { error: insertErr } = await supabase.from('documents').insert({
      id: assertUuid(doc.id, 'document.id'),
      activity_id: activityId,
      kind: doc.kind,
      name: doc.name,
      mime: doc.mime,
      storage_path: storagePath,
      size: doc.size,
    });
    if (insertErr) throw insertErr;
  }
}

export async function saveActivity(activity: Activity, removedDocumentIds: string[] = []): Promise<Activity> {
  const row = activityToRow(activity);

  // mou_document_id / order_placed_document_id are FKs into `documents`.
  // If either points at a freshly-picked (not-yet-uploaded) document, the
  // referenced row won't exist yet — insert the activity row with those two
  // FKs nulled out first, then upload/insert the documents, then patch the
  // FKs in afterward. Three round-trips, but avoids a broken FK constraint
  // on brand-new records and keeps each step easy to reason about.
  const { mou_document_id, order_placed_document_id, ...rowWithoutDocRefs } = row;
  const { error: upsertErr } = await supabase
    .from('activities')
    .upsert({ ...rowWithoutDocRefs, mou_document_id: null, order_placed_document_id: null });
  if (upsertErr) {
    // 23505 = unique_violation. uq_activities_no_duplicate is the DB-level
    // backstop for isDuplicateActivity()'s client-side check, which can miss
    // a race between two concurrent submissions for the same office/date/
    // exporter/buyer. Surface a message the UI's existing catch/toast can show.
    if (upsertErr.code === '23505') {
      throw new Error('Another record with the same office, date, exporter and buyer was just saved by someone else. Please review the activity list before retrying.');
    }
    throw upsertErr;
  }

  await persistDocuments(activity.id, activity.documents, removedDocumentIds);

  if (mou_document_id || order_placed_document_id) {
    const { error: linkErr } = await supabase
      .from('activities')
      .update({ mou_document_id, order_placed_document_id })
      .eq('id', activity.id);
    if (linkErr) throw linkErr;
  }

  const saved = await getActivity(activity.id);
  if (!saved) throw new Error('Failed to reload saved activity');
  return saved;
}

/**
 * Fixes already-imported activities whose Order Placed / Order In Process
 * flags contradict what their remarks text actually says (e.g. a remark
 * saying "Good Supplied" or "Order Placed" while the record still shows
 * Order Placed = No). This is the same classifyOutcomeFromRemark heuristic
 * the importer applies to new rows — this just re-runs it against records
 * that were already saved (including ones imported before the classifier
 * existed, or before a since-added keyword like "supplied"/"delivered").
 *
 * Only touches records where the classifier gives a clear, confident
 * signal ('placed' or 'inProcess') AND that contradicts the stored flags;
 * everything else — including ambiguous or unrecognized remarks — is left
 * exactly as-is. Admin-only, triggered from Settings.
 */
export async function reclassifyOrderStatusFromRemarks(): Promise<{ checked: number; updated: number }> {
  const { data: rows, error } = await supabase
    .from('activities')
    .select('id, remarks_general, order_in_process_active, order_placed');
  if (error) throw error;
  if (!rows || rows.length === 0) return { checked: 0, updated: 0 };

  type Row = { id: string; remarks_general: string | null; order_in_process_active: boolean; order_placed: boolean };
  const updates: { id: string; order_placed: boolean; order_in_process_active: boolean }[] = [];

  for (const row of rows as Row[]) {
    const remark = row.remarks_general ?? '';
    if (!remark) continue;
    const outcome = classifyOutcomeFromRemark(remark);
    if (outcome === 'placed' && !row.order_placed) {
      updates.push({ id: row.id, order_placed: true, order_in_process_active: false });
    } else if (outcome === 'inProcess' && (row.order_placed || !row.order_in_process_active)) {
      updates.push({ id: row.id, order_placed: false, order_in_process_active: true });
    }
  }

  // Applied in small concurrent batches rather than all at once, to stay
  // gentle on Supabase when there are hundreds of records to correct.
  const BATCH = 20;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((u) =>
      supabase.from('activities').update({ order_placed: u.order_placed, order_in_process_active: u.order_in_process_active }).eq('id', u.id),
    ));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return { checked: rows.length, updated: updates.length };
}

export async function deleteActivity(id: string): Promise<void> {
  // Storage objects live under the `${id}/` prefix; remove them first since
  // deleting the activity row cascades the `documents` rows but not the files.
  const { data: docs } = await supabase.from('documents').select('storage_path').eq('activity_id', id);
  if (docs && docs.length) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove(docs.map((d) => d.storage_path as string));
  }
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Deletes every activity (and its documents/storage files) for the whole
 * organization — used only by the admin-only "Clear All Data" action in
 * Settings. Irreversible; the caller is responsible for confirming with the
 * user before calling this.
 */
export async function deleteAllActivities(): Promise<{ deleted: number }> {
  const { data: docs, error: docsErr } = await supabase.from('documents').select('storage_path');
  if (docsErr) throw docsErr;
  if (docs && docs.length) {
    // Storage removal is batched at 100 paths per call to stay well under
    // typical request-size limits on large datasets.
    const paths = docs.map((d) => d.storage_path as string);
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths.slice(i, i + 100));
    }
  }

  const { error: docsDeleteErr } = await supabase.from('documents').delete().not('id', 'is', null);
  if (docsDeleteErr) throw docsDeleteErr;

  const { data: deletedRows, error } = await supabase.from('activities').delete().not('id', 'is', null).select('id');
  if (error) throw error;
  return { deleted: deletedRows?.length ?? 0 };
}

// Generated client-side (not via a DB sequence/lookup) so it's synchronous and
// collision-safe across concurrent users in different regional offices —
// a "select max, add one" scheme would race when two offices create an
// activity at the same moment and silently overwrite one via upsert.
export function nextActivityId(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BSM-${year}-${Date.now().toString(36).toUpperCase()}${rand}`;
}

// ---------- Users (profiles) ----------
// Creating/deleting Auth accounts goes through the `admin-users` Edge
// Function (needs the service-role key, which never reaches the client).
// Editing an existing user's profile fields (role/office/active) is a plain
// table update, allowed for admins by RLS.

async function callAdminUsersFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    password: '', // never stored/returned client-side anymore
    role: p.role,
    regionalOffice: p.regional_office ?? undefined,
    active: p.active,
    createdAt: p.created_at,
  }));
}

/** Create a brand-new user (admin only). `user.password` is required here. */
export async function createUser(user: User): Promise<void> {
  await callAdminUsersFunction({
    action: 'create',
    email: user.email,
    password: user.password,
    name: user.name,
    role: user.role,
    regionalOffice: user.regionalOffice,
  });
}

/** Update an existing user's profile fields (not their password). */
export async function saveUser(user: User): Promise<User> {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: user.name,
      role: user.role,
      regional_office: user.regionalOffice ?? null,
      active: user.active,
    })
    .eq('id', user.id);
  if (error) throw error;
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await callAdminUsersFunction({ action: 'delete', userId: id });
}

// ---------- Settings ----------

const DEFAULT_SETTINGS_ROW = {
  organization_name: 'Federation of Indian Export Organisations',
  default_currency: 'USD' as const,
  pagination_size: 10,
};

function localTheme(): AppSettings['theme'] {
  return (localStorage.getItem('fieo.rbsm.theme') as AppSettings['theme']) ?? 'light'; // theme stays local/per-device
}

/**
 * Resilient by design: this runs during auth initialization, so it must
 * never throw in a way that leaves the caller hanging.
 * - Uses maybeSingle() (not single()) so 0 rows returns null instead of a
 *   406, whether that's because the row is genuinely missing or RLS hid it
 *   (e.g. called before a session exists).
 * - If the row is missing, attempts to create it — self-healing for a
 *   fresh database that hasn't been seeded yet.
 * - Any unexpected/RLS error is logged and swallowed, falling back to
 *   sane in-memory defaults so the settings screen still renders.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
      console.error('getSettings: query failed, falling back to defaults', error);
      return { theme: localTheme(), organizationName: DEFAULT_SETTINGS_ROW.organization_name, defaultCurrency: DEFAULT_SETTINGS_ROW.default_currency, paginationSize: DEFAULT_SETTINGS_ROW.pagination_size };
    }
    if (!data) {
      const { data: inserted, error: insertErr } = await supabase
        .from('settings')
        .insert({ id: 1, ...DEFAULT_SETTINGS_ROW })
        .select()
        .maybeSingle();
      if (insertErr || !inserted) {
        console.error('getSettings: settings row missing and could not be created', insertErr);
        return { theme: localTheme(), organizationName: DEFAULT_SETTINGS_ROW.organization_name, defaultCurrency: DEFAULT_SETTINGS_ROW.default_currency, paginationSize: DEFAULT_SETTINGS_ROW.pagination_size };
      }
      return { theme: localTheme(), organizationName: inserted.organization_name, defaultCurrency: inserted.default_currency, paginationSize: inserted.pagination_size };
    }
    return { theme: localTheme(), organizationName: data.organization_name, defaultCurrency: data.default_currency, paginationSize: data.pagination_size };
  } catch (err) {
    console.error('getSettings: unexpected error, falling back to defaults', err);
    return { theme: localTheme(), organizationName: DEFAULT_SETTINGS_ROW.organization_name, defaultCurrency: DEFAULT_SETTINGS_ROW.default_currency, paginationSize: DEFAULT_SETTINGS_ROW.pagination_size };
  }
}

export async function saveSettings(s: AppSettings): Promise<AppSettings> {
  localStorage.setItem('fieo.rbsm.theme', s.theme);
  const { error } = await supabase.from('settings').upsert({
    id: 1,
    organization_name: s.organizationName,
    default_currency: s.defaultCurrency,
    pagination_size: s.paginationSize,
  });
  if (error) throw error; // intentionally propagates — caller (SettingsPage) shows a toast on failure
  return s;
}

// ---------- Form draft (auto-save) ----------
// Left on localStorage: it's per-device scratch state, not shared data.

const DRAFT_KEY = 'fieo.rbsm.draft';

export function saveDraft(draft: Partial<Activity> | null): void {
  if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  else localStorage.removeItem(DRAFT_KEY);
}

export function loadDraft(): Partial<Activity> | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  return raw ? (JSON.parse(raw) as Partial<Activity>) : null;
}

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Moon, Sun, Building2, Save, Database, Trash2, Info } from 'lucide-react';
import { getSettings } from '@/data/repository';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CURRENCIES } from '@/types';
import type { AppSettings, Currency } from '@/types';

export function SettingsPage() {
  const { settings, updateSettings, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { notify } = useToast();
  const [form, setForm] = useState<AppSettings | null>(settings);
  const [wipeOpen, setWipeOpen] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  void getSettings; // ensure module import retained for future direct reads

  if (!form) return <div className="h-40 rounded-xl skeleton" />;

  const save = async () => {
    try {
      await updateSettings(form);
      notify('Settings saved.', 'success');
    } catch (err) {
      console.error('SettingsPage: failed to save settings', err);
      notify('Failed to save settings. You may not have permission to edit organization settings.', 'error');
    }
  };

  // Organization data (activities, users, documents) now lives in Supabase,
  // not the browser — clearing localStorage only removes this device's
  // cached theme preference and auth session, so it can't cause data loss.
  const wipeData = () => {
    localStorage.clear();
    notify('Local cache cleared. Signing out…', 'info');
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Application preferences and data management.</p>
      </div>

      {/* Appearance */}
      <div className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          <SettingsIcon size={16} className="text-fieo-600" /> Appearance
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Theme</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark mode.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme('light')} className={`btn-secondary ${theme === 'light' ? 'ring-2 ring-fieo-500' : ''}`}><Sun size={16} /> Light</button>
            <button onClick={() => setTheme('dark')} className={`btn-secondary ${theme === 'dark' ? 'ring-2 ring-fieo-500' : ''}`}><Moon size={16} /> Dark</button>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          <Building2 size={16} className="text-fieo-600" /> Organization
        </h3>
        {user?.role !== 'admin' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Only admins can change organization-wide settings.</p>
        )}
        <fieldset disabled={user?.role !== 'admin'} className="space-y-4 disabled:opacity-60">
          <div>
            <label className="label" htmlFor="settings-org-name">Organization Name</label>
            <input id="settings-org-name" className="input" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="settings-currency">Default Currency</label>
              <select id="settings-currency" className="input" value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value as Currency })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="settings-page-size">Table Page Size</label>
              <select id="settings-page-size" className="input" value={form.paginationSize} onChange={(e) => setForm({ ...form, paginationSize: +e.target.value })}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={save}><Save size={16} /> Save Settings</button>
        </fieldset>
      </div>

      {/* Data management */}
      <div className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          <Database size={16} className="text-fieo-600" /> Data Management
        </h3>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-fieo-50 dark:bg-fieo-900/30 text-xs text-fieo-700 dark:text-fieo-200 mb-4">
          <Info size={14} className="shrink-0 mt-0.5" />
          <p>Activities, users, and documents are stored in Supabase (Postgres + Storage) and shared across all offices and devices. Only your theme preference and sign-in session are cached in this browser.</p>
        </div>
        <button className="btn-danger" onClick={() => setWipeOpen(true)}><Trash2 size={16} /> Clear Local Cache &amp; Sign Out</button>
      </div>

      <ConfirmDialog
        open={wipeOpen}
        title="Clear local cache and sign out?"
        message="This will clear your cached theme preference and sign you out of this browser, then reload the app. It does not delete any activities, users, or documents — that data stays safely in Supabase."
        confirmLabel="Clear & Sign Out"
        danger
        onConfirm={wipeData}
        onCancel={() => setWipeOpen(false)}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { Activity } from '@/types';
import { listActivities, saveActivity, deleteActivity } from '@/data/repository';

// Shared activities store for the current session. All pages read from this
// hook so a save in the wizard immediately reflects on the dashboard / table.
export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await listActivities();
      setActivities(data.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    } catch (err) {
      // A stuck loading spinner is worse than showing an empty/error state —
      // always resolve loading, and surface the failure so the page can
      // show a retry affordance instead of an endless skeleton.
      console.error('useActivities: failed to load activities', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const upsert = useCallback(async (a: Activity, removedDocumentIds: string[] = []) => {
    const saved = await saveActivity(a, removedDocumentIds); // errors intentionally propagate — caller (ActivityWizard) shows a toast
    setActivities((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      const next = idx >= 0 ? [...prev.slice(0, idx), saved, ...prev.slice(idx + 1)] : [saved, ...prev];
      return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteActivity(id); // errors intentionally propagate — caller shows a toast
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { activities, loading, error, refresh, upsert, remove };
}

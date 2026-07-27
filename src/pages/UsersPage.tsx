import { useEffect, useMemo, useState } from 'react';
import { Users as UsersIcon, Plus, Pencil, Trash2, Shield, MapPin, Search, X } from 'lucide-react';
import { listUsers, saveUser, createUser, deleteUser } from '@/data/repository';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { REGIONAL_OFFICES, officeName } from '@/types';
import type { User, UserRole } from '@/types';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { notify } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const load = async () => {
    try {
      setUsers(await listUsers());
    } catch (err) {
      console.error('UsersPage: failed to load users', err);
      notify('Failed to load users.', 'error');
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter((u) => [u.name, u.email, u.role, officeName(u.regionalOffice)].join(' ').toLowerCase().includes(q));
  }, [users, query]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setOpen(true); };

  const onSave = async (u: User) => {
    try {
      if (editing) await saveUser(u);
      else await createUser(u);
      await load();
      notify(editing ? 'User updated.' : 'User created.', 'success');
      setOpen(false);
    } catch (err) {
      console.error('UsersPage: failed to save user', err);
      notify(err instanceof Error ? err.message : 'Failed to save user.', 'error');
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting.id);
      await load();
      notify('User deleted.', 'info');
      setDeleting(null);
    } catch (err) {
      console.error('UsersPage: failed to delete user', err);
      notify(err instanceof Error ? err.message : 'Failed to delete user.', 'error');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage Head Office administrators and regional office users.</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> New User</button>
      </div>

      <div className="card p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No users found" message="Create a user to grant access to the portal." icon={<UsersIcon size={28} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-950/50">
                <tr>{['Name', 'Email', 'Role', 'Office', 'Status', 'Created', 'Actions'].map((h) => <th key={h} className="table-th">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-fieo-600 text-white flex items-center justify-center text-xs font-semibold">{u.name.charAt(0)}</div>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                      </div>
                    </td>
                    <td className="table-td">{u.email}</td>
                    <td className="table-td">
                      <span className={`badge ${u.role === 'admin' ? 'bg-fieo-100 text-fieo-700 dark:bg-fieo-900/50 dark:text-fieo-200' : 'bg-saffron-100 text-saffron-700 dark:bg-saffron-900/50 dark:text-saffron-200'}`}>
                        {u.role === 'admin' ? <><Shield size={11} /> Admin</> : <><MapPin size={11} /> Regional</>}
                      </span>
                    </td>
                    <td className="table-td">{u.regionalOffice ? officeName(u.regionalOffice) : 'Head Office'}</td>
                    <td className="table-td">
                      <span className={`badge ${u.active ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-td text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost p-1.5 rounded-md" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}><Pencil size={15} /></button>
                        {u.id !== currentUser?.id && <button className="btn-ghost p-1.5 rounded-md text-red-500" onClick={() => setDeleting(u)} aria-label={`Delete ${u.name}`}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal open={open} onClose={() => setOpen(false)} onSave={onSave} editing={editing} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete user?"
        message={`This will permanently remove ${deleting?.name} (${deleting?.email}). They will no longer be able to sign in.`}
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function UserModal({ open, onClose, onSave, editing }: { open: boolean; onClose: () => void; onSave: (u: User) => void; editing: User | null }) {
  const [form, setForm] = useState<User>(() => editing ?? blank());
  const [lastKey, setLastKey] = useState('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (open && key !== lastKey) { setLastKey(key); setForm(editing ?? blank()); }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit User' : 'New User'} size="md"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" type="submit" form="user-form">{editing ? 'Update' : 'Create'}</button></>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="user-name">Full Name</label>
          <input id="user-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="user-email">Email</label>
          <input id="user-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="user-password">Password</label>
          <input id="user-password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="user-role">Role</label>
            <select id="user-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, regionalOffice: e.target.value === 'admin' ? undefined : form.regionalOffice })}>
              <option value="regional">Regional Office User</option>
              <option value="admin">Head Office Administrator</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="user-office">Regional Office</label>
            <select id="user-office" className="input" value={form.regionalOffice ?? ''} onChange={(e) => setForm({ ...form, regionalOffice: e.target.value || undefined })} disabled={form.role === 'admin'}>
              <option value="">—</option>
              {REGIONAL_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
          Active account
        </label>
      </form>
    </Modal>
  );
}

function blank(): User {
  return {
    id: `usr-${Date.now().toString(36)}`,
    name: '', email: '', password: '', role: 'regional', regionalOffice: undefined, active: true,
    createdAt: new Date().toISOString(),
  };
}

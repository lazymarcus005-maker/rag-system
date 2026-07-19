'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, getToken, getUser } from '@/lib/api';

interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const me = getUser();

  const refresh = useCallback(() => {
    api<UserRow[]>('/users').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!getToken() || getUser()?.role !== 'admin') {
      router.push('/login');
      return;
    }
    refresh();
  }, [router, refresh]);

  async function changeRole(id: string, role: 'admin' | 'user') {
    setError('');
    try {
      await api(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }

  async function remove(id: string, email: string) {
    if (!confirm(`ลบผู้ใช้ ${email}? บทสนทนาทั้งหมดของผู้ใช้จะถูกลบด้วย`)) return;
    setError('');
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">จัดการผู้ใช้</h1>
          <nav className="flex gap-1 rounded-lg border border-slate-800 p-1 text-sm">
            <button
              onClick={() => router.push('/admin')}
              className="rounded-md px-3 py-1 text-slate-400 hover:text-slate-100"
            >
              เอกสาร
            </button>
            <span className="rounded-md bg-slate-800 px-3 py-1">ผู้ใช้</span>
          </nav>
        </div>
        <button
          onClick={() => router.push('/chat')}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          ← กลับไปหน้าแชท
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">สมัครเมื่อ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-slate-500">(คุณ)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => changeRole(u.id, e.target.value as 'admin' | 'user')}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 disabled:opacity-50"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(u.id, u.email)}
                      disabled={isSelf}
                      className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-30"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

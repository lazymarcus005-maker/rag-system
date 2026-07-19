'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getUser } from '@/lib/api';

interface Doc {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress: number;
  error: string | null;
  chunkCount: number;
  sizeBytes: number;
  createdAt: string;
}

const STATUS_STYLE: Record<Doc['status'], string> = {
  pending: 'bg-slate-700 text-slate-300',
  processing: 'bg-amber-900 text-amber-300',
  ready: 'bg-emerald-900 text-emerald-300',
  failed: 'bg-red-900 text-red-300',
};

export default function AdminPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api<Doc[]>('/documents').then(setDocs).catch(() => {});
  }, []);

  useEffect(() => {
    if (getUser()?.role !== 'admin') {
      router.push('/login');
      return;
    }
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [router, refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api('/documents', { method: 'POST', body: form });
      }
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดล้มเหลว');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function reindex(id: string) {
    await api(`/documents/${id}/reindex`, { method: 'POST' });
    refresh();
  }

  async function remove(id: string) {
    if (!confirm('ลบเอกสารนี้และข้อมูล index ทั้งหมด?')) return;
    await api(`/documents/${id}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">จัดการเอกสาร</h1>
          <nav className="flex gap-1 rounded-lg border border-slate-800 p-1 text-sm">
            <span className="rounded-md bg-slate-800 px-3 py-1">เอกสาร</span>
            <button
              onClick={() => router.push('/admin/users')}
              className="rounded-md px-3 py-1 text-slate-400 hover:text-slate-100"
            >
              ผู้ใช้
            </button>
          </nav>
        </div>
        <button
          onClick={() => router.push('/chat')}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          ← กลับไปหน้าแชท
        </button>
      </div>

      <label className="mb-6 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-700 p-8 text-slate-400 hover:border-sky-600 hover:text-slate-200">
        <span>{uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่อเลือกไฟล์ (PDF, DOCX, MD, TXT)'}</span>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          disabled={uploading}
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">เอกสาร</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">Chunks</th>
              <th className="px-4 py-3">ขนาด</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  ยังไม่มีเอกสารในระบบ
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-t border-slate-800">
                <td className="px-4 py-3">
                  <div>{d.title}</div>
                  {d.error && <div className="text-xs text-red-400">{d.error}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLE[d.status]}`}>
                    {d.status === 'processing' ? `processing ${d.progress}%` : d.status}
                  </span>
                </td>
                <td className="px-4 py-3">{d.chunkCount}</td>
                <td className="px-4 py-3">{(d.sizeBytes / 1024).toFixed(1)} KB</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => reindex(d.id)}
                    className="mr-2 rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                  >
                    Re-index
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

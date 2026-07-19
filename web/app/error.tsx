'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
        <h1 className="text-lg font-semibold">เกิดข้อผิดพลาด</h1>
        <p className="text-sm text-slate-400">
          ระบบทำงานผิดพลาด กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ
        </p>
        <button
          onClick={reset}
          className="w-full rounded-lg bg-sky-600 py-2 font-medium hover:bg-sky-500"
        >
          ลองใหม่
        </button>
      </div>
    </main>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, authFetch, getUser, logout } from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
}

interface Source {
  ref: number;
  chunkId: string;
  documentTitle: string;
  page: number | null;
  section: string | null;
  snippet: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.push('/login');
      return;
    }
    setIsAdmin(getUser()?.role === 'admin');
    api<Conversation[]>('/conversations').then(setConversations).catch(() => {});
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    const msgs = await api<{ role: 'user' | 'assistant'; content: string }[]>(
      `/conversations/${id}/messages`,
    );
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
  }

  async function newConversation() {
    const convo = await api<Conversation>('/conversations', { method: 'POST' });
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setMessages([]);
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;

    let convoId = activeId;
    if (!convoId) {
      const convo = await api<Conversation>('/conversations', { method: 'POST' });
      setConversations((prev) => [convo, ...prev]);
      setActiveId(convo.id);
      convoId = convo.id;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await authFetch(`/conversations/${convoId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, sepIdx).trim();
          buffer = buffer.slice(sepIdx + 2);
          if (!raw.startsWith('data: ')) continue;
          const event = JSON.parse(raw.slice(6));
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            if (event.type === 'sources') last.sources = event.sources;
            if (event.type === 'token') last.content += event.token;
            if (event.type === 'error') last.content += `\n\n[Error] ${event.message}`;
            next[next.length - 1] = last;
            return next;
          });
        }
      }
      api<Conversation[]>('/conversations').then(setConversations).catch(() => {});
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // ผู้ใช้กดหยุดเอง — เก็บข้อความบางส่วนไว้
      } else {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: `[Error] ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`,
          };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function deleteConversation(id: string) {
    if (!confirm('ลบบทสนทนานี้?')) return;
    await api(`/conversations/${id}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between p-3">
          <span className="font-semibold">RAG Chat</span>
          <button
            onClick={newConversation}
            className="rounded-lg bg-sky-600 px-2 py-1 text-sm hover:bg-sky-500"
          >
            + ใหม่
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg hover:bg-slate-800 ${
                c.id === activeId ? 'bg-slate-800' : ''
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
              >
                {c.title}
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                title="ลบบทสนทนา"
                className="hidden px-2 text-slate-500 hover:text-red-400 group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-800 p-3 text-sm">
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800"
            >
              จัดการเอกสาร
            </button>
          )}
          <button
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-slate-400 hover:bg-slate-800"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <p className="pt-20 text-center text-slate-500">
                ถามคำถามจากเอกสารในระบบได้เลย
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    m.role === 'user' ? 'whitespace-pre-wrap bg-sky-700' : 'bg-slate-800'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {m.content ||
                          (streaming && i === messages.length - 1 ? '…' : '')}
                      </Markdown>
                    </div>
                  ) : (
                    m.content
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <details className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-400">
                      <summary className="cursor-pointer">
                        แหล่งอ้างอิง ({m.sources.length})
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {m.sources.map((s) => (
                          <li key={s.chunkId}>
                            [{s.ref}]{' '}
                            <span className="text-slate-300">
                              {s.documentTitle}
                              {s.page != null && ` (หน้า ${s.page})`}
                              {s.section && ` – ${s.section}`}
                            </span>{' '}
                            — {s.snippet}…
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="border-t border-slate-800 p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="พิมพ์คำถาม..."
              disabled={streaming}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-sky-500 disabled:opacity-50"
            />
            {streaming ? (
              <button
                onClick={stopStreaming}
                className="rounded-xl bg-red-700 px-5 font-medium hover:bg-red-600"
              >
                หยุด
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="rounded-xl bg-sky-600 px-5 font-medium hover:bg-sky-500 disabled:opacity-50"
              >
                ส่ง
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

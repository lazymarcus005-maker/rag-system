import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAG System',
  description: 'RAG + Document Management + Chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

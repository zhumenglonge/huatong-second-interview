import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Biomni Lab',
  description: 'AI-agent research workbench with a real Qoder Agent SDK backend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

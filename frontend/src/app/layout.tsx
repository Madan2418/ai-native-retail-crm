import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xeno CRM — AI-Native Campaign Platform',
  description: 'Reach shoppers intelligently. Segment, personalize, and engage at scale with AI-powered campaigns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

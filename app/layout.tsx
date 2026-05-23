import type { Metadata } from 'next';
import './globals.css';
import { getDir, getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Jaser Platform',
  description:
    'National academic–industry collaboration platform connecting students, professors, and companies.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const dir = getDir(locale);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

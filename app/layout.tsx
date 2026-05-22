import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jaser Platform',
  description:
    'National academic–industry collaboration platform connecting students, professors, and companies.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

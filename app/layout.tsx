import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DMS — Document Management System',
  description: 'Secure AI-powered document management with multi-step approval workflows',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

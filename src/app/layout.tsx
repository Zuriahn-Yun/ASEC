import type { Metadata } from 'next';
import './globals.css';
import { InsForgeProvider } from '@/components/InsForgeProvider';

export const metadata: Metadata = {
  title: 'ASEC - Autonomous Security Scanner',
  description: 'AI-powered security scanning and patching platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white">
        <InsForgeProvider>
          {children}
        </InsForgeProvider>
      </body>
    </html>
  );
}

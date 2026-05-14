import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ASTRA-IDE',
  description: 'Adaptive Scheduling & Telemetry-driven Resource-aware Cloud IDE',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

'use client';
import Navbar from './Navbar';

export { Avatar } from './AvatarInline';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="ambient" aria-hidden="true" />
      <Navbar variant="default" />
      <main id="main" className="flex-1">{children}</main>
    </div>
  );
}

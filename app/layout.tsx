import type { Metadata } from 'next';
import './globals.css';
import './refinement.css';
import './workspace.css';
import './event.css';
import AppShell from '@/components/AppShell';
export const metadata: Metadata = { title: 'MOONS', description: 'A space for your sparks and materials.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body><AppShell />{children}</body></html>; }

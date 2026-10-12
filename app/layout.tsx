import type { Metadata } from 'next';
import './globals.css';
import './refinement.css';
import './workspace.css';
import Moons from '@/components/Moons';
export const metadata: Metadata = { title: 'MOONS', description: 'A space for your sparks and materials.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Moons />{children}</body></html>; }

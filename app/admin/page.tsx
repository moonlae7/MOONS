import type {Metadata} from 'next';
import AdminPage from '@/components/event/AdminPage';

export const metadata: Metadata = {title: 'MOONS · 운영', robots: {index: false}};

export default function Page() { return <AdminPage/>; }

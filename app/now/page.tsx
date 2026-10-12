import type {Metadata, Viewport} from 'next';
import NowPage from '@/components/event/NowPage';
import {eventSpace} from '@/lib/server/event';

export const metadata: Metadata = {title: 'MOONS · 생각 넣기'};
export const viewport: Viewport = {width: 'device-width', initialScale: 1, viewportFit: 'cover'};

export default function Page() { return <NowPage questions={eventSpace.questions}/>; }

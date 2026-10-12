import type {Metadata} from 'next';
import LivePage from '@/components/event/LivePage';
import {eventSpace} from '@/lib/server/event';

export const metadata: Metadata = {title: 'MOONS · LIVE'};

export default function Page() { return <LivePage space={eventSpace}/>; }

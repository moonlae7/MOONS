import type {Metadata} from 'next';
import LivePage from '@/components/event/LivePage';
import {eventSpace} from '@/lib/server/event';

// The universe is the live screen: everyone's answers, in real time.
export const metadata: Metadata = {title: 'MOONS · 나의 우주'};

export default function Page() { return <LivePage space={eventSpace}/>; }

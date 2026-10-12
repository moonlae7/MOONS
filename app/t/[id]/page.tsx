import type {Metadata} from 'next';
import ThoughtPage from '@/components/event/ThoughtPage';

export const metadata: Metadata = {title: 'MOONS · 생각의 모양'};

export default async function Page({params}: PageProps<'/t/[id]'>) {
  const {id} = await params;
  return <ThoughtPage id={id}/>;
}

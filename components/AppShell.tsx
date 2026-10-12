'use client';
import {usePathname} from 'next/navigation';
import Moons from './Moons';

// Event screens (/now, /live, /t/:id, /admin) render on their own; everything else is personal MOONS.
const EVENT_ROUTES = /^\/(now|live|t|admin)(\/|$)/;

export default function AppShell() {
  const path = usePathname();
  return EVENT_ROUTES.test(path) ? null : <Moons/>;
}

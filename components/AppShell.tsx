'use client';
import {usePathname} from 'next/navigation';
import Moons from './Moons';

// Event screens (/now, /live, /universe, /t/:id, /admin) render on their own; everything else is personal MOONS.
// /universe and /live are the same shared universe.
const EVENT_ROUTES = /^\/(now|live|universe|t|admin)(\/|$)/;

export default function AppShell() {
  const path = usePathname();
  return EVENT_ROUTES.test(path) ? null : <Moons/>;
}

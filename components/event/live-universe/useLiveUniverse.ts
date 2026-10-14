'use client';
import {useEffect, useState} from 'react';
import {api} from '@/lib/client';
import type {UniverseDTO} from '@/lib/thought';

export function useLiveUniverse(spaceId: string) {
  const [data, setData] = useState<UniverseDTO | null>(null);
  const [error, setError] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    let seen: Set<string> | null = null;
    let poll: ReturnType<typeof setTimeout>;
    let arrival: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = await api<UniverseDTO>(`/api/spaces/${encodeURIComponent(spaceId)}/universe`, {signal: controller.signal});
        if (!alive) return;
        const ids = new Set(next.thoughts.filter(thought => thought.status !== 'held').map(thought => thought.id));
        const added = seen ? [...ids].filter(id => !seen!.has(id)) : [];
        if (added.length) {
          clearTimeout(arrival);
          setFresh(new Set(added));
          arrival = setTimeout(() => { if (alive) setFresh(new Set()); }, 2600);
        }
        seen = ids;
        setData(next);
        setError(false);
      } catch {
        if (alive) setError(true);
      } finally {
        // Schedule after completion, so slow responses cannot race newer snapshots.
        if (alive) poll = setTimeout(load, 2500);
      }
    };
    void load();
    return () => { alive = false; controller.abort(); clearTimeout(poll); clearTimeout(arrival); };
  }, [spaceId]);
  return {data, error, fresh};
}

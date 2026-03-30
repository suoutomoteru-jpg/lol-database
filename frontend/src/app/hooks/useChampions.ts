import { useState, useEffect } from 'react';
import { getLatestVersion, fetchChampionList, championImageUrl } from '../api/dataDragon';
import type { Champion, Role } from '../data/mock-data';

interface UseChampionsResult {
  champions: Champion[];
  version: string;
  loading: boolean;
  error: Error | null;
}

const VALID_ROLES: Role[] = ['Mage', 'Tank', 'Assassin', 'Fighter', 'Support', 'Marksman'];

function toRole(tag: string): Role {
  return VALID_ROLES.includes(tag as Role) ? (tag as Role) : 'Fighter';
}

export function useChampions(): UseChampionsResult {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const v = await getLatestVersion();
        const raw = await fetchChampionList(v);

        if (cancelled) return;

        const list: Champion[] = Object.values(raw)
          .map(c => ({
            id: c.id,
            name: c.name,
            role: toRole(c.tags[0] ?? 'Fighter'),
            icon: championImageUrl(v, c.id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setVersion(v);
        setChampions(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { champions, version, loading, error };
}

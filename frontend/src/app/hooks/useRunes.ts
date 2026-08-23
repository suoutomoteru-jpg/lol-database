import { useState, useEffect } from 'react';
import { getLatestVersion, fetchRuneTrees } from '../api/dataDragon';
import type { DDragonRuneTree } from '../types/ddragon';

interface UseRunesResult {
  trees: DDragonRuneTree[];
  version: string | null;
  loading: boolean;
  error: Error | null;
}

export function useRunes(): UseRunesResult {
  const [trees, setTrees] = useState<DDragonRuneTree[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const v = await getLatestVersion();
        const data = await fetchRuneTrees(v);
        if (cancelled) return;
        setVersion(v);
        setTrees(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { trees, version, loading, error };
}

import { useState, useEffect } from 'react';
import { fetchScalingData } from '../api/scalingData';
import type { ScalingData } from '../api/scalingData';

interface UseScalingDataResult {
  data: ScalingData | null;
  loading: boolean;
}

export function useScalingData(): UseScalingDataResult {
  const [data, setData] = useState<ScalingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchScalingData().then(d => {
      if (!cancelled) { setData(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

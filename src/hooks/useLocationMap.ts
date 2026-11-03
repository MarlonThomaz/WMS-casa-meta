import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLocationMapStats,
  searchLocationMapPage,
  type LocationMapItem,
  type LocationMapStats,
} from '../services/locations';
import type { DBLocation } from '../types';

const EMPTY_STATS: LocationMapStats = {
  totalLocations: 0,
  availableLocations: 0,
  occupiedLocations: 0,
  unavailableLocations: 0,
};

export function useLocationMap(
  query: string,
  status: DBLocation['status'] | null,
  page: number,
  pageSize = 50
) {
  const [locations, setLocations] = useState<LocationMapItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LocationMapStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      const [pageResult, statsResult] = await Promise.all([
        searchLocationMapPage(query, status, pageSize, (page - 1) * pageSize),
        getLocationMapStats(),
      ]);

      if (requestId !== requestIdRef.current) return;
      setLocations(pageResult.items);
      setTotal(pageResult.total);
      setStats(statsResult);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Erro ao carregar o mapa de endereços');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, pageSize, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [load]);

  return {
    locations,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats,
    loading,
    error,
    refresh: load,
  };
}

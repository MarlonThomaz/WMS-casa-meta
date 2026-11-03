import { useEffect, useState } from 'react';
import {
  getStockCounts,
  getStockCountById,
  getStockCountLinesWithDetails,
  type StockCount,
  type StockCountLineWithDetails,
  type StockCountWithLines,
} from '../services/stockCounts';

export function useStockCounts() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = async () => {
    try {
      setLoading(true);
      setError(null);
      setCounts(await getStockCounts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contagens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCounts();
  }, []);

  return { counts, loading, error, refresh: loadCounts };
}

export function useStockCount(countId: string | null) {
  const [count, setCount] = useState<StockCountWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCount = async () => {
    if (!countId) {
      setCount(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCount(await getStockCountById(countId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contagem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCount();
  }, [countId]);

  return { count, loading, error, refresh: loadCount };
}

export function useStockCountLines(countId: string) {
  const [lines, setLines] = useState<StockCountLineWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLines = async () => {
    try {
      setLoading(true);
      setError(null);
      setLines(await getStockCountLinesWithDetails(countId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar linhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLines();
  }, [countId]);

  return { lines, loading, error, refresh: loadLines };
}

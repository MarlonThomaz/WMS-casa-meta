import { useState, useEffect } from 'react';
import {
  getStockCounts,
  getStockCountById,
  getStockCountLinesWithDetails,
  type StockCount,
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
      const data = await getStockCounts();
      setCounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contagens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  return {
    counts,
    loading,
    error,
    refresh: loadCounts,
  };
}

export function useStockCount(countId: string | null) {
  const [count, setCount] = useState<StockCountWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCount = async () => {
    if (!countId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getStockCountById(countId);
      setCount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contagem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
  }, [countId]);

  return {
    count,
    loading,
    error,
    refresh: loadCount,
  };
}

export function useStockCountLines(countId: string) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLines = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStockCountLinesWithDetails(countId);
      setLines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar linhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLines();
  }, [countId]);

  return {
    lines,
    loading,
    error,
    refresh: loadLines,
  };
}

import { useState, useEffect } from 'react';
import { StockBalance, StockBalanceWithDetails, getProductStockBalances, getStockBalancesWithDetails, getStockSummary } from '../services/stock';

export function useStockByProduct(productId: string | null) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setBalances([]);
      return;
    }

    const loadBalances = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductStockBalances(productId);
        setBalances(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estoque');
        console.error('Erro ao carregar estoque:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [productId]);

  const totalStock = balances.reduce((sum, b) => sum + b.quantity, 0);
  const totalReserved = balances.reduce((sum, b) => sum + b.reserved_quantity, 0);
  const totalAvailable = balances.reduce((sum, b) => sum + b.available_quantity, 0);

  return {
    balances,
    loading,
    error,
    totalStock,
    totalReserved,
    totalAvailable,
  };
}

export function useStockWithDetails(filters?: {
  product_id?: string;
  location_id?: string;
  min_quantity?: number;
}) {
  const [balances, setBalances] = useState<StockBalanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBalances = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getStockBalancesWithDetails(filters);
        setBalances(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estoque');
        console.error('Erro ao carregar estoque:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [filters?.product_id, filters?.location_id, filters?.min_quantity]);

  return {
    balances,
    loading,
    error,
  };
}

export function useStockSummary() {
  const [summary, setSummary] = useState<{
    total_items: number;
    total_quantity: number;
    total_reserved: number;
    total_available: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getStockSummary();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar resumo');
        console.error('Erro ao carregar resumo:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  return {
    summary,
    loading,
    error,
  };
}

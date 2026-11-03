import { useEffect, useState } from 'react';
import { getStockBalancesWithDetails, type StockBalanceWithDetails } from '../services/stock';

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
        setBalances(await getStockBalancesWithDetails(filters));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar estoque');
        console.error('Erro ao carregar estoque:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadBalances();
  }, [filters?.product_id, filters?.location_id, filters?.min_quantity]);

  return { balances, loading, error };
}

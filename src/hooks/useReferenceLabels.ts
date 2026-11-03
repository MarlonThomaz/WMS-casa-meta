import { useEffect, useMemo, useState } from 'react';
import { getReferenceLabels, type ReferenceLabels } from '../services/referenceLabels';

const EMPTY_LABELS: ReferenceLabels = { products: {}, locations: {} };

export function useReferenceLabels(productIds: string[], locationIds: string[]) {
  const productKey = useMemo(
    () => [...new Set(productIds.filter(Boolean))].sort().join('|'),
    [productIds]
  );
  const locationKey = useMemo(
    () => [...new Set(locationIds.filter(Boolean))].sort().join('|'),
    [locationIds]
  );
  const [labels, setLabels] = useState<ReferenceLabels>(EMPTY_LABELS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const products = productKey ? productKey.split('|') : [];
      const locations = locationKey ? locationKey.split('|') : [];

      if (products.length === 0 && locations.length === 0) {
        setLabels(EMPTY_LABELS);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await getReferenceLabels(products, locations);
        if (active) setLabels(result);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar referências');
          setLabels(EMPTY_LABELS);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [locationKey, productKey]);

  return { labels, loading, error };
}

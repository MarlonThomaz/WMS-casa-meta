import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProduct,
  deactivateProduct,
  searchProductsPage,
  updateProduct,
} from '../services/products';
import type { DBProduct, ProductWithStock } from '../types';

export function useProductSearch(query: string, page: number, pageSize = 50) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadProducts = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      const result = await searchProductsPage(query, pageSize, (page - 1) * pageSize);
      if (requestId !== requestIdRef.current) return;
      setProducts(result.items);
      setTotal(result.total);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, pageSize, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const addProduct = async (product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await createProduct(product);
    await loadProducts();
    return created;
  };

  const editProduct = async (id: string, updates: Partial<DBProduct>) => {
    const updated = await updateProduct(id, updates);
    await loadProducts();
    return updated;
  };

  const removeProduct = async (id: string) => {
    await deactivateProduct(id);
    await loadProducts();
  };

  return {
    products,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    loading,
    error,
    refresh: loadProducts,
    addProduct,
    editProduct,
    removeProduct,
  };
}

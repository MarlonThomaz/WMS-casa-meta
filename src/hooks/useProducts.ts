import { useState, useEffect } from 'react';
import { getProductsWithStock, createProduct, updateProduct, deactivateProduct } from '../services/products';
import { ProductWithStock, DBProduct } from '../types';

export function useProducts() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProductsWithStock();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const addProduct = async (product: Omit<DBProduct, 'id' | 'created_at' | 'updated_at'>) => {
    const newProduct = await createProduct(product);
    await loadProducts();
    return newProduct;
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

  return { products, loading, error, refresh: loadProducts, addProduct, editProduct, removeProduct };
}

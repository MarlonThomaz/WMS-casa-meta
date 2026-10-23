import { useState, useEffect } from 'react';
import { Product, getProducts, getProductById, getProductBySku, createProduct, updateProduct, deactivateProduct } from '../services/products';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const refresh = async () => {
    await loadProducts();
  };

  const addProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);
      const newProduct = await createProduct(product);
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar produto');
      throw err;
    }
  };

  const editProduct = async (id: string, updates: Partial<Product>) => {
    try {
      setError(null);
      const updatedProduct = await updateProduct(id, updates);
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
      return updatedProduct;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto');
      throw err;
    }
  };

  const removeProduct = async (id: string) => {
    try {
      setError(null);
      await deactivateProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover produto');
      throw err;
    }
  };

  return {
    products,
    loading,
    error,
    refresh,
    addProduct,
    editProduct,
    removeProduct,
  };
}

export function useProduct(id: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      return;
    }

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductById(id);
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar produto');
        console.error('Erro ao carregar produto:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  return { product, loading, error };
}

export function useProductBySku(sku: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) {
      setProduct(null);
      return;
    }

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductBySku(sku);
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar produto');
        console.error('Erro ao carregar produto:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [sku]);

  return { product, loading, error };
}

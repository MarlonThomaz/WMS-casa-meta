import { useState, useCallback } from 'react';
import { 
  findProductByBarcode, 
  getProductDetailsByBarcode,
  createProductBarcode,
  updateProductBarcode,
  deleteProductBarcode,
  validateBarcode,
  type ProductBarcode,
  type ProductWithBarcode
} from '../services/barcodes';

// Hook para buscar produto por código de barras
export function useBarcodeLookup() {
  const [product, setProduct] = useState<ProductWithBarcode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupBarcode = useCallback(async (barcode: string) => {
    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const validation = validateBarcode(barcode);
      if (!validation.valid) {
        throw new Error('Código de barras inválido');
      }

      const result = await findProductByBarcode(barcode);
      setProduct(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar produto';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setProduct(null);
    setError(null);
  }, []);

  return {
    product,
    loading,
    error,
    lookupBarcode,
    clear
  };
}

// Hook para buscar detalhes completos do produto por código de barras
export function useBarcodeDetails() {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupDetails = useCallback(async (barcode: string) => {
    setLoading(true);
    setError(null);
    setDetails(null);

    try {
      const validation = validateBarcode(barcode);
      if (!validation.valid) {
        throw new Error('Código de barras inválido');
      }

      const result = await getProductDetailsByBarcode(barcode);
      setDetails(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar detalhes';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDetails(null);
    setError(null);
  }, []);

  return {
    details,
    loading,
    error,
    lookupDetails,
    clear
  };
}

// Hook para gerenciar códigos de barras
export function useBarcodeManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addBarcode = useCallback(async (barcode: {
    product_id: string;
    barcode: string;
    barcode_type?: string;
    packaging_type?: string;
    quantity_per_package?: number;
    is_primary?: boolean;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const validation = validateBarcode(barcode.barcode);
      if (!validation.valid) {
        throw new Error('Código de barras inválido');
      }

      const result = await createProductBarcode({
        ...barcode,
        barcode_type: barcode.barcode_type || validation.type
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar código';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const editBarcode = useCallback(async (id: string, updates: Partial<ProductBarcode>) => {
    setLoading(true);
    setError(null);

    try {
      const result = await updateProductBarcode(id, updates);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar código';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeBarcode = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      await deleteProductBarcode(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover código';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    addBarcode,
    editBarcode,
    removeBarcode
  };
}

// Hook para validação de código de barras
export function useBarcodeValidation() {
  const validate = useCallback((barcode: string) => {
    return validateBarcode(barcode);
  }, []);

  return { validate };
}
